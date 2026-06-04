const fs = require("fs");
const xlsx = require("xlsx");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const db = require("../../model");
const {
    mapImportRecordToEntities,
    normalizeClientRecord,
} = require("../../mappers/cpBulkImportMapper");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10,15}$/;
const CHANNEL_LICENSE_MIN_LIMIT = 10000;

const getUploadedFile = (files = {}) => {
    if (!files || !Object.keys(files).length) return null;
    const firstKey = Object.keys(files)[0];
    return files[firstKey];
};

const readUploadedFile = (file) => {
    if (!file) return null;
    if (file.data && file.data.length) return file.data;
    if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
        return fs.readFileSync(file.tempFilePath);
    }
    return null;
};

const parseCSVOrJSONRows = ({ buffer, fileName }) => {
    const lowerName = String(fileName || "").toLowerCase();
    if (lowerName.endsWith(".json")) {
        return JSON.parse(buffer.toString("utf8"));
    }

    const workbook = xlsx.read(buffer, { type: "buffer", raw: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
};

/** Remove client-supplied PKs so DB auto-increment / server IDs always apply. */
const stripServerOwnedIds = (row) => {
    if (!row || typeof row !== "object") return row;
    const out = { ...row };
    for (const key of Object.keys(out)) {
        const k = String(key).trim().toLowerCase();
        if (k === "cpl_id" || k === "user_id" || k === "cpl_d_id" || k === "lead_id") {
            delete out[key];
        }
    }
    return out;
};

const extractRecords = (req) => {
    const body = req.body || {};

    if (Array.isArray(body.records)) return body.records;
    if (Array.isArray(body.data)) return body.data;

    if (typeof body.data === "string" && body.data.trim()) {
        const parsed = JSON.parse(body.data);
        return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : []);
    }

    if (typeof body.csv === "string" && body.csv.trim()) {
        const workbook = xlsx.read(body.csv, { type: "string", raw: false });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) return [];
        return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
    }

    const uploadedFile = getUploadedFile(req.files);
    if (!uploadedFile) return [];
    const buffer = readUploadedFile(uploadedFile);
    if (!buffer) return [];

    const parsed = parseCSVOrJSONRows({ buffer, fileName: uploadedFile.name || "" });
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.records)) return parsed.records;
    return [];
};

const validateImportRow = (normalizedRecord) => {
    const errors = [];

    if (!normalizedRecord.email) {
        errors.push("email is required");
    } else if (!EMAIL_REGEX.test(normalizedRecord.email)) {
        errors.push("invalid email format");
    }

    if (!normalizedRecord.phone) {
        errors.push("phone is required");
    } else if (!PHONE_REGEX.test(normalizedRecord.phone)) {
        errors.push("invalid phone format, expected 10-15 digits");
    }

    return errors;
};

const filterColumnsBySchema = (payload, schemaColumns) => {
    const filtered = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (Object.prototype.hasOwnProperty.call(schemaColumns, key) && value !== undefined) {
            filtered[key] = value;
        }
    }
    return filtered;
};

const filterByModelAttributes = (payload, model) => {
    const allowed = Object.keys(model.rawAttributes || {});
    const filtered = {};
    for (const key of allowed) {
        if (payload[key] !== undefined) {
            filtered[key] = payload[key];
        }
    }
    return filtered;
};

const generateUserCode = () => `CP${Math.floor(10000000 + Math.random() * 90000000)}`;

const parsePlatformFlag = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

const buildImportSummary = (records, stats) => ({
    total_records: records.length,
    success_count: stats.success.length,
    failed_count: stats.failed.length,
    duplicate_count: stats.duplicates.length,
});

const parseOptionalId = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Resolves state_id / city_id from CSV (state_id, city_id) or from state / city
 * names via tenant db_states and db_cities (case-insensitive name match).
 */
const resolveStateCityIds = async (req, normalized, defaults) => {
    const { sequelize, states, city } = req.config;
    if (!states || !city) {
        return { error: "Tenant DB state/city models are not available on this connection" };
    }

    let stateId = parseOptionalId(normalized.state_id) ?? parseOptionalId(defaults.state_id);
    let cityId = parseOptionalId(normalized.city_id) ?? parseOptionalId(defaults.city_id);

    const stateName = normalized.state ? String(normalized.state).trim() : "";
    const cityName = normalized.city ? String(normalized.city).trim() : "";

    if (!stateId && stateName) {
        const stateRow = await states.findOne({
            where: sequelize.where(
                sequelize.fn("LOWER", sequelize.col("state_name")),
                stateName.toLowerCase()
            ),
            attributes: ["state_id"],
        });
        if (!stateRow) {
            return { error: `State not found for name: "${stateName}"` };
        }
        stateId = stateRow.state_id;
    }

    if (!cityId && cityName) {
        if (!stateId) {
            return {
                error: `City "${cityName}" needs a resolvable state (add state column, state_id, or default state_id in request)`,
            };
        }
        const cityRow = await city.findOne({
            where: {
                [Op.and]: [
                    { state_id: stateId },
                    sequelize.where(
                        sequelize.fn("LOWER", sequelize.col("city_name")),
                        cityName.toLowerCase()
                    ),
                ],
            },
            attributes: ["city_id"],
        });
        if (!cityRow) {
            return { error: `City not found for name: "${cityName}" under state_id ${stateId}` };
        }
        cityId = cityRow.city_id;
    }

    if (!stateId) {
        return { error: "state_id or state (name) is required" };
    }
    if (!cityId) {
        return { error: "city_id or city (name) is required" };
    }

    return { state_id: stateId, city_id: cityId };
};

const buildMasterClientPayload = ({
    clientAdmin,
    userName,
    email,
    contactNumber,
    passwordHash,
    userCode,
    dbName,
}) => {
    const adm = clientAdmin.dataValues || clientAdmin;
    return {
        user: userName,
        email,
        contact_number: contactNumber,
        password: passwordHash,
        db_name: dbName,
        isDB: false,
        user_status: true,
        doc_verification: 2,
        user_code: userCode,
        subscription_start_date: adm.subscription_start_date,
        subscription_end_date: adm.subscription_end_date,
        subscription_start_date_channel: adm.subscription_start_date_channel,
        subscription_end_date_channel: adm.subscription_end_date_channel,
        subscription_start_date_dms: adm.subscription_start_date_dms,
        subscription_end_date_dms: adm.subscription_end_date_dms,
        subscription_start_date_sales: adm.subscription_start_date_sales,
        subscription_end_date_sales: adm.subscription_end_date_sales,
        subscription_start_date_media: adm.subscription_start_date_media,
        subscription_end_date_media: adm.subscription_end_date_media,
        no_of_months: adm.no_of_months,
        domain: adm.domain,
        no_of_license: adm.no_of_license,
        no_of_channel_license: adm.no_of_channel_license,
        no_of_dms_license: adm.no_of_dms_license,
        no_of_sales_license: adm.no_of_sales_license,
        no_of_media_license: adm.no_of_media_license,
        sidebar_color: adm.sidebar_color,
        button_color: adm.button_color,
        text_color: adm.text_color,
        top_nav_color: adm.top_nav_color,
    };
};

const resolvePlatformFlags = (req, cpRoleId) => {
    const crmEnabled = parsePlatformFlag(req.body?.isCRM);
    const dmsEnabled = parsePlatformFlag(req.body?.isDMS);
    const salesEnabled = parsePlatformFlag(req.body?.isSALES);
    let channelEnabled = parsePlatformFlag(req.body?.isCHANNEL);
    const mediaEnabled = parsePlatformFlag(req.body?.isMEDIA);

    if (cpRoleId === 1 && req.body?.isCHANNEL === undefined) {
        channelEnabled = true;
    }

    return { crmEnabled, dmsEnabled, salesEnabled, channelEnabled, mediaEnabled };
};

const buildDuplicateReason = (duplicateMasterClient, duplicateUser) => {
    if (duplicateMasterClient && duplicateUser) {
        return "email already exists in master clients and tenant users tables";
    }
    if (duplicateMasterClient) {
        return "email already exists in master clients (db_clients) table";
    }
    return "email already exists in tenant users table";
};

const bulkImportChannelPartners = async (req) => {
    const cpRoleId = Number(req.body?.cp_role_id ?? 3);
    const updateOnDuplicate =
        req.body?.update_on_duplicate === undefined
            ? true
            : parsePlatformFlag(req.body?.update_on_duplicate);
    const records = extractRecords(req);
    const queryInterface = req.config.sequelize.getQueryInterface();
    const [leadColumns, userColumns] = await Promise.all([
        queryInterface.describeTable("db_channel_partner_leads"),
        queryInterface.describeTable("db_users"),
    ]);

    const clientAdmin = await db.clients.findOne({
        where: { db_name: req.user.db_name, isDB: true },
    });
    if (!clientAdmin) {
        throw new Error(`Client admin not found for db_name: ${req.user.db_name}`);
    }

    const stats = {
        success: [],
        updated: [],
        failed: [],
        duplicates: [],
    };

    const defaultTenantId = req.body?.tenant_id ?? req.body?.client_id ?? null;
    const defaultValues = {
        role_id: cpRoleId,
        country_id: req.body?.country_id ?? 101,
        state_id: req.body?.state_id ?? null,
        city_id: req.body?.city_id ?? null,
        report_to: req.body?.report_to ?? null,
        cp_category: req.body?.cp_category ?? null,
        tenant_id: defaultTenantId,
        client_id: defaultTenantId,
        db_name: req.user?.db_name || null,
    };

    const givePlatformCount = async (platformId) =>
        req.config.userPlatform.count({
            where: { platform_id: platformId, actions: true },
        });

    for (let index = 0; index < records.length; index += 1) {
        const rawRecord = records[index];
        const importRow = stripServerOwnedIds(rawRecord);
        const normalized = normalizeClientRecord(importRow);
        const rowErrors = validateImportRow(normalized);
        let processClient = null;
        let DBprocess = null;

        try {
            if (rowErrors.length) {
                stats.failed.push({
                    row_number: index + 1,
                    email: normalized.email || null,
                    reason: rowErrors.join(", "),
                    record: rawRecord,
                });
                continue;
            }

            const duplicateMasterClient = await db.clients.findOne({
                where: { email: normalized.email },
                paranoid: false,
                attributes: ["user_id", "email", "password", "user_code", "contact_number"],
            });
            const duplicateUser = await req.config.users.findOne({
                where: {
                    email: normalized.email,
                    deletedAt: { [Op.is]: null },
                },
                paranoid: false,
                attributes: ["user_id", "email", "password", "user_code", "contact_number"],
            });

        if ((duplicateMasterClient || duplicateUser) && !updateOnDuplicate) {
                stats.duplicates.push({
                    row_number: index + 1,
                    email: normalized.email,
                reason: buildDuplicateReason(duplicateMasterClient, duplicateUser),
                });
                continue;
            }

            const geo = await resolveStateCityIds(req, normalized, defaultValues);
            if (geo.error) {
                stats.failed.push({
                    row_number: index + 1,
                    email: normalized.email || null,
                    reason: geo.error,
                    record: rawRecord,
                });
                continue;
            }

            const rowDefaults = {
                ...defaultValues,
                state_id: geo.state_id,
                city_id: geo.city_id,
            };

            processClient = await req.config.sequelize.transaction();
            DBprocess = await db.sequelize.transaction();

            const { leadPayload, userPayload, metadataPayload } = mapImportRecordToEntities({
                record: importRow,
                defaults: rowDefaults,
            });

            const isDuplicate = Boolean(duplicateMasterClient || duplicateUser);
            if (isDuplicate) {
                const leadUpdatePayload = {
                    ...leadPayload,
                    ...metadataPayload,
                    source: "bulk_import",
                };
                delete leadUpdatePayload.cpl_id;
                const filteredLeadUpdate = filterColumnsBySchema(leadUpdatePayload, leadColumns);

                let existingLead = await req.config.channelPartnerLeads.findOne({
                    where: { email: normalized.email },
                    paranoid: false,
                    order: [["cpl_id", "DESC"]],
                    transaction: processClient,
                });

                if (!existingLead) {
                    existingLead = await req.config.channelPartnerLeads.create(filteredLeadUpdate, {
                        transaction: processClient,
                    });
                } else {
                    await existingLead.update(filteredLeadUpdate, { transaction: processClient });
                }

                const userUpdatePayload = {
                    ...userPayload,
                    ...metadataPayload,
                    onboarding_status: "completed",
                    isActive: 1,
                    source: "bulk_import",
                    cp_lead_id: existingLead.cpl_id,
                    cpl_id: existingLead.cpl_id,
                };
                delete userUpdatePayload.user_id;
                const filteredUserUpdate = filterColumnsBySchema(userUpdatePayload, userColumns);

                let existingTenantUser = duplicateUser;
                if (!existingTenantUser) {
                    existingTenantUser = await req.config.users.findOne({
                        where: { email: normalized.email },
                        paranoid: false,
                        transaction: processClient,
                    });
                }

                if (existingTenantUser) {
                    await existingTenantUser.update(filteredUserUpdate, { transaction: processClient });
                } else {
                    const fallbackUserCode = duplicateMasterClient?.user_code || generateUserCode();
                    const fallbackPasswordHash =
                        duplicateMasterClient?.password ||
                        (await bcrypt.hash(fallbackUserCode, 10));
                    await req.config.users.create(
                        {
                            ...filteredUserUpdate,
                            password: fallbackPasswordHash,
                            user_code: fallbackUserCode,
                        },
                        { transaction: processClient }
                    );
                }

                const displayUserName = [userPayload.user, userPayload.user_l_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || userPayload.user;

                const masterClientUpdatePayload = {
                    user: displayUserName,
                    email: normalized.email,
                    contact_number: normalized.phone ? Number(normalized.phone) : null,
                    user_status: true,
                    doc_verification: 2,
                };
                const filteredMasterClientUpdate = filterByModelAttributes(masterClientUpdatePayload, db.clients);

                let existingMasterClient = duplicateMasterClient;
                if (!existingMasterClient) {
                    existingMasterClient = await db.clients.findOne({
                        where: { email: normalized.email },
                        paranoid: false,
                        transaction: DBprocess,
                    });
                }

                if (existingMasterClient) {
                    await existingMasterClient.update(filteredMasterClientUpdate, {
                        transaction: DBprocess,
                    });
                } else {
                    const fallbackUserCode = existingTenantUser?.user_code || generateUserCode();
                    const fallbackPasswordHash =
                        existingTenantUser?.password ||
                        (await bcrypt.hash(fallbackUserCode, 10));
                    const masterClientPayload = buildMasterClientPayload({
                        clientAdmin,
                        userName: displayUserName,
                        email: normalized.email,
                        contactNumber: normalized.phone ? Number(normalized.phone) : null,
                        passwordHash: fallbackPasswordHash,
                        userCode: fallbackUserCode,
                        dbName: req.user.db_name,
                    });
                    const filteredMasterClient = filterByModelAttributes(masterClientPayload, db.clients);
                    await db.clients.create(filteredMasterClient, { transaction: DBprocess });
                }

                await processClient.commit();
                await DBprocess.commit();

                stats.updated.push({
                    row_number: index + 1,
                    email: normalized.email,
                    cp_lead_id: existingLead?.cpl_id || null,
                    reason: "existing record updated from import row",
                });
                continue;
            }

            const leadInsert = {
                ...leadPayload,
                ...metadataPayload,
                source: "bulk_import",
            };
            delete leadInsert.cpl_id;
            const filteredLeadInsert = filterColumnsBySchema(leadInsert, leadColumns);

            const createdLead = await req.config.channelPartnerLeads.create(filteredLeadInsert, {
                transaction: processClient,
            });

            if (req.config.cplDetails) {
                await req.config.cplDetails.create(
                    {
                        cpl_id: createdLead.cpl_id,
                        stage: "ONBOARDED",
                        follow_up_date: null,
                        remarks: "Imported via bulk import",
                        status: true,
                    },
                    { transaction: processClient }
                );
            }

            const userCode = generateUserCode();
            const passwordHash = await bcrypt.hash(userCode, 10);

            const displayUserName = [userPayload.user, userPayload.user_l_name]
                .filter(Boolean)
                .join(" ")
                .trim() || userPayload.user;

            const masterClientPayload = buildMasterClientPayload({
                clientAdmin,
                userName: displayUserName,
                email: normalized.email,
                contactNumber: Number(normalized.phone),
                passwordHash,
                userCode,
                dbName: req.user.db_name,
            });
            const filteredMasterClient = filterByModelAttributes(masterClientPayload, db.clients);
            await db.clients.create(filteredMasterClient, { transaction: DBprocess });

            const userInsert = {
                ...userPayload,
                ...metadataPayload,
                password: passwordHash,
                onboarding_status: "completed",
                isActive: 1,
                cp_lead_id: createdLead.cpl_id,
                cpl_id: createdLead.cpl_id,
                source: "bulk_import",
                user_code: userCode,
            };
            delete userInsert.user_id;
            const filteredUserInsert = filterColumnsBySchema(userInsert, userColumns);

            const createdUser = await req.config.users.create(filteredUserInsert, {
                transaction: processClient,
            });

            const { crmEnabled, dmsEnabled, salesEnabled, channelEnabled, mediaEnabled } =
                resolvePlatformFlags(req, cpRoleId);

            const checkLicense = async (platformId, limit, label) => {
                const normalizedLimit = Number(limit) || 0;
                const used = await givePlatformCount(platformId);
                if (used >= normalizedLimit) {
                    throw new Error(
                        `Cannot add user: ${label} license limit reached (${normalizedLimit})`
                    );
                }
            };

            if (crmEnabled) {
                await checkLicense(1, clientAdmin.no_of_license, "CRM");
            }
            if (dmsEnabled) {
                await checkLicense(2, clientAdmin.no_of_dms_license, "DMS");
            }
            if (salesEnabled) {
                await checkLicense(3, clientAdmin.no_of_sales_license, "SALES");
            }
            if (channelEnabled) {
                const effectiveChannelLimit = Math.max(
                    Number(clientAdmin.no_of_channel_license || 0),
                    CHANNEL_LICENSE_MIN_LIMIT
                );
                await checkLicense(4, effectiveChannelLimit, "CHANNEL");
            }
            if (mediaEnabled) {
                await checkLicense(5, clientAdmin.no_of_media_license, "MEDIA");
            }

            if (req.config.userPlatform) {
                const userPTdata = {
                    CRM: crmEnabled,
                    DMS: dmsEnabled,
                    SALES: salesEnabled,
                    CHANNEL: channelEnabled,
                    MEDIA: mediaEnabled,
                };
                const entries = Object.entries(userPTdata);
                for (const [idx, [, value]] of entries.entries()) {
                    await req.config.userPlatform.create(
                        {
                            actions: value,
                            platform_id: idx + 1,
                            user_id: createdUser.user_id,
                        },
                        { transaction: processClient }
                    );
                }
            }

            await processClient.commit();
            await DBprocess.commit();

            stats.success.push({
                row_number: index + 1,
                email: normalized.email,
                user_id: createdUser.user_id,
                cp_lead_id: createdLead.cpl_id,
                user_code: userCode,
            });
        } catch (error) {
            if (processClient) {
                await processClient.rollback().catch(() => {});
            }
            if (DBprocess) {
                await DBprocess.rollback().catch(() => {});
            }
            stats.failed.push({
                row_number: index + 1,
                email: normalized.email || null,
                reason: error?.message || "failed to import record",
                record: rawRecord,
            });
        }
    }

    return {
        summary: {
            ...buildImportSummary(records, stats),
            updated_count: stats.updated.length,
        },
        success_records: stats.success,
        updated_records: stats.updated,
        duplicate_records: stats.duplicates,
        failed_records: stats.failed,
    };
};

module.exports = {
    bulkImportChannelPartners,
};
