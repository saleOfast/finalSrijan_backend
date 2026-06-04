const cron = require('node-cron');
const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require("../helper/responce");
const db = require("../model");
const sendEmail = require("../common/mailer");
const { date } = require("joi");
const path = require('path');
const fs = require('fs');
const { sendSMS } = require("../common/sms");
const { assignProjectsToCpLead, getLeadProjects, getLeadBstAssignment } = require("../services/channel/cpLeadProjectService");

// In-memory OTP store keyed by `${db_name}:${cpl_id}`
// Value: { otp: string, expiresAt: number }
const CP_VISIT_OTP_STORE = new Map();

function generateFourDigitOTP() {
    return String(Math.floor(1000 + Math.random() * 9000));
}

// Generate and send OTP to CP mobile for stage change to VISIT
exports.sendVisitOTP = async (req, res) => {
    try {
        const { db_name, cpl_id } = req.body;
        if (!db_name) return responseError(req, res, "Client Database Name is Required");
        if (!cpl_id) return responseError(req, res, "CPL ID is Required");

        // Fetch lead to get contact number
        const getLeadQuery = `
            SELECT cpl_id, first_name, last_name, contact
            FROM ${db_name}.db_channel_partner_leads
            WHERE cpl_id = :cpl_id AND deletedAt IS NULL
        `;

        const [lead] = await db.sequelize.query(getLeadQuery, {
            replacements: { cpl_id },
            type: db.sequelize.QueryTypes.SELECT
        });

        if (!lead) return responseError(req, res, "No Lead Found with the Provided CPL ID");
        if (!lead.contact) return responseError(req, res, "Lead does not have a valid contact number");

        const otp = generateFourDigitOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        const key = makeOtpKey(db_name, cpl_id);
        CP_VISIT_OTP_STORE.set(key, { otp, expiresAt });

        const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Partner';
        const message = `Dear ${name}, your verification OTP is ${otp}. It is valid for 10 minutes.`;
        await sendSMS(lead.contact, message);

        // Optional debug log for testing without SMS creds
        console.log('[OTP DEBUG]', { db_name, cpl_id, otp });

        return responseSuccess(req, res, "OTP sent successfully to the registered mobile number");
    } catch (error) {
        logErrorToFile(error);
        console.error(error);
        return responseError(req, res, "Failed to send OTP");
    }
}

function makeOtpKey(dbName, cplId) {
    return `${dbName}:${cplId}`;
}

/**
 * Assigns CP Lead to BST based on state_id and city_id matching (ID-based)
 * Uses round-robin logic if multiple BSTs match
 * @param {string} db_name - Database name
 * @param {number} cpl_id - CP Lead ID
 * @param {number} state_id - Lead state ID
 * @param {number} city_id - Lead city ID
 */
async function assignCPLeadToBST(db_name, cpl_id, state_id, city_id) {
    try {
        // If state_id is not provided, skip assignment
        if (!state_id) {
            console.log(`Skipping BST assignment for lead ${cpl_id}: state_id not provided`);
            return;
        }

        // Find BST users (role_id = 2) matching both state_id AND city_id
        let bstUsers = [];
        let matchedBy = 'state_id and city_id';

        if (city_id) {
            const bstUsersQuery = `
                SELECT user_id, user, email, state_id, city_id, user_status, createdAt
                FROM ${db_name}.db_users
                WHERE role_id = 2 
                AND user_status = true 
                AND deletedAt IS NULL
                AND state_id = :state_id 
                AND city_id = :city_id
                ORDER BY createdAt ASC
            `;

            bstUsers = await db.sequelize.query(bstUsersQuery, {
                replacements: { state_id, city_id },
                type: db.sequelize.QueryTypes.SELECT
            });
        }

        // If no BST matches both state_id and city_id, fallback to state_id-only matching
        if (bstUsers.length === 0) {
            console.log(`No BST users found for state_id: ${state_id} and city_id: ${city_id}. Trying state_id-only match...`);
            
            // Fallback: Match by state_id only
            const bstUsersStateQuery = `
                SELECT user_id, user, email, state_id, city_id, user_status, createdAt
                FROM ${db_name}.db_users
                WHERE role_id = 2 
                AND user_status = true 
                AND deletedAt IS NULL
                AND state_id = :state_id
                ORDER BY createdAt ASC
            `;

            const bstUsersStateOnly = await db.sequelize.query(bstUsersStateQuery, {
                replacements: { state_id },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (bstUsersStateOnly.length === 0) {
                console.log(`No BST users found for state_id: ${state_id}. Lead ${cpl_id} will remain unassigned.`);
                return;
            }

            // Use state_id-only matched BSTs
            bstUsers = bstUsersStateOnly;
            matchedBy = 'state_id only';
            console.log(`Found ${bstUsers.length} BST user(s) matching state_id: ${state_id} (fallback)`);
        }

        // If only one BST matches, assign directly
        if (bstUsers.length === 1) {
            const bstUserId = bstUsers[0].user_id;
            await db.sequelize.query(`
                UPDATE ${db_name}.db_channel_partner_leads 
                SET asssigned_to = :bst_user_id, updatedAt = NOW()
                WHERE cpl_id = :cpl_id
            `, {
                replacements: { bst_user_id: bstUserId, cpl_id },
                type: db.sequelize.QueryTypes.UPDATE
            });
            console.log(`Assigned CP Lead ${cpl_id} to BST ${bstUserId} (matched by ${matchedBy})`);
            return;
        }

        // Multiple BSTs found - use round-robin logic
        // Count leads assigned to each BST
        const bstWithLeadCounts = await Promise.all(bstUsers.map(async (bst) => {
            const leadCountQuery = `
                SELECT COUNT(*) as lead_count
                FROM ${db_name}.db_channel_partner_leads
                WHERE asssigned_to = :user_id AND deletedAt IS NULL
            `;
            const result = await db.sequelize.query(leadCountQuery, {
                replacements: { user_id: bst.user_id },
                type: db.sequelize.QueryTypes.SELECT
            });
            const leadCount = result && result[0] ? parseInt(result[0].lead_count) || 0 : 0;
            return {
                ...bst,
                leadCount
            };
        }));

        // Sort by lead count (ascending), then by createdAt (ascending) for tie-breaking
        bstWithLeadCounts.sort((a, b) => {
            if (a.leadCount === b.leadCount) {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
            return a.leadCount - b.leadCount;
        });

        // Assign to BST with least leads
        const selectedBST = bstWithLeadCounts[0];
        await db.sequelize.query(`
            UPDATE ${db_name}.db_channel_partner_leads 
            SET asssigned_to = :bst_user_id, updatedAt = NOW()
            WHERE cpl_id = :cpl_id
        `, {
            replacements: { bst_user_id: selectedBST.user_id, cpl_id },
            type: db.sequelize.QueryTypes.UPDATE
        });
        console.log(`Assigned CP Lead ${cpl_id} to BST ${selectedBST.user_id} (round-robin from ${bstUsers.length} BSTs, matched by ${matchedBy})`);
    } catch (error) {
        console.error('Error assigning CP Lead to BST:', error);
        // Don't throw error - assignment failure shouldn't break lead creation
    }
}

exports.addChannelPartnerLead = async (req, res) => {
    try {
        const {
            db_name, first_name, last_name, contact, email, state, city, state_id, city_id,
            cpl_id, project_ids, bst_id, asssigned_to,
        } = req.body;
        if (!db_name) return responseError(req, res, "Client Not Found");

        // Project + BST assignment mode:
        // POST with cpl_id and/or project_ids and/or bst_id updates mappings and asssigned_to.
        if (
            cpl_id !== undefined
            || project_ids !== undefined
            || bst_id !== undefined
            || asssigned_to !== undefined
        ) {
            const assignment = await assignProjectsToCpLead(db.sequelize, {
                db_name,
                cpl_id,
                project_ids,
                bst_id,
                asssigned_to,
            });
            if (!assignment.ok) return responseError(req, res, assignment.message);
            return responseSuccess(req, res, "Projects and BST assigned to CP lead successfully", assignment.data);
        }

        // Frontend now sends state_id and city_id, so prioritize those
        let finalStateId = state_id ? parseInt(state_id) : null;
        let finalCityId = city_id ? parseInt(city_id) : null;
        let finalStateName = null;
        let finalCityName = null;

        // Validate state_id: Frontend should send state_id, but support legacy state name for backward compatibility
        if (finalStateId && !isNaN(finalStateId)) {
            // Fetch state name from database using state_id
            const [stateRecord] = await db.sequelize.query(`
                SELECT state_id, state_name FROM ${db_name}.db_states 
                WHERE state_id = :state_id LIMIT 1`, {
                replacements: { state_id: finalStateId },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (!stateRecord) {
                return responseError(req, res, `State with state_id ${finalStateId} not found in database`);
            }
            finalStateName = stateRecord.state_name;
        } else if (state) {
            // Backward compatibility: If state_id not provided but state name is, try to convert (for legacy support)
            const stateName = state.trim();
            const [stateRecordLegacy] = await db.sequelize.query(`
                SELECT state_id, state_name FROM ${db_name}.db_states 
                WHERE state_name = :state_name LIMIT 1`, {
                replacements: { state_name: stateName },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (stateRecordLegacy) {
                finalStateId = stateRecordLegacy.state_id;
                finalStateName = stateRecordLegacy.state_name;
            } else {
                return responseError(req, res, `State "${stateName}" not found in database. Please provide state_id instead.`);
            }
        } else {
            return responseError(req, res, "state_id is required");
        }

        // Handle city_id: Frontend should send city_id, but support legacy city name for backward compatibility
        if (finalCityId && !isNaN(finalCityId)) {
            // Fetch city name from database using city_id
            const [cityRecord] = await db.sequelize.query(`
                SELECT city_id, city_name FROM ${db_name}.db_cities 
                WHERE city_id = :city_id AND state_id = :state_id LIMIT 1`, {
                replacements: { city_id: finalCityId, state_id: finalStateId },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (cityRecord) {
                finalCityName = cityRecord.city_name;
            } else {
                console.log(`City with city_id ${finalCityId} not found in database for state_id ${finalStateId}, proceeding without city`);
                // Continue without city - will fallback to state_id-only matching
                finalCityId = null;
            }
        } else if (city && finalStateId) {
            // Backward compatibility: If city_id not provided but city name is, try to convert (for legacy support)
            const cityName = city.trim();
            const [cityRecordLegacy] = await db.sequelize.query(`
                SELECT city_id, city_name FROM ${db_name}.db_cities 
                WHERE city_name = :city_name AND state_id = :state_id LIMIT 1`, {
                replacements: { city_name: cityName, state_id: finalStateId },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (cityRecordLegacy) {
                finalCityId = cityRecordLegacy.city_id;
                finalCityName = cityRecordLegacy.city_name;
        } else {
            console.log(`City "${cityName}" not found in database for state_id ${finalStateId}, proceeding without city_id`);
            }
        }
        
        // Validate city_id: City is mandatory for CP leads
        if (!finalCityId) {
            return responseError(req, res, "city_id is required. Please provide city_id or a valid city name.");
        }

        const stage = 'OPEN';
        const status = true;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const createdAt = updatedAt = now;

        // Fetch admin details
        const admin = await db.clients.findOne({ where: { db_name, isDB: 1 } });
        if (!admin) return responseError(req, res, "Admin Not Found");

        const AdminMail = admin.email;

        // Check if the lead already exists
        const existingRecord = await db.sequelize.query(`
            SELECT 1 FROM ${db_name}.db_channel_partner_leads 
            WHERE email = :email OR contact = :contact
            LIMIT 1`, {
            replacements: { email, contact },
            type: db.sequelize.QueryTypes.SELECT
        });

        if (existingRecord.length > 0) {
            return responseSuccess(req, res, "You Have Already Registered with Same Email or Mobile Number.");
        }

        // Fetch organization name
        const [orgRecord] = await db.sequelize.query(`
            SELECT company_name FROM ${db_name}.db_organisation_infos LIMIT 1`, {
            type: db.sequelize.QueryTypes.SELECT
        });
        const organisationName = orgRecord?.company_name || "Srijan Bandhan";

        // Fetch or use default email template
        let [templateRecord] = await db.sequelize.query(`
            SELECT template FROM ${db_name}.db_email_templates WHERE template_id = 9 LIMIT 1`, {
            type: db.sequelize.QueryTypes.SELECT
        });

        if (!templateRecord) {
            const templatePath = path.join(__dirname, "..", "mail", "cp", "newCPLead.html");
            try {
                templateRecord = { template: fs.readFileSync(templatePath, "utf-8") };
            } catch (err) {
                templateRecord = { template: "Welcome to {{CompanyName}},\nThank you for showing interest in our channel partner programme." };
            }
        }

        // Customize the template
        let htmlContent = templateRecord.template
            .replace(/{{UsersName}}/g, `${first_name} ${last_name}`)
            .replace(/{{Name}}/g, `${first_name} ${last_name}`)
            .replace(/{{BDName}}/g, `${first_name} ${last_name}`)
            .replace(/{{PhoneNo}}/g, contact)
            .replace(/{{EmailID}}/g, email)
            .replace(/{{CompanyName}}/g, organisationName);

        // Send email
        const emailOptions = {
            email: AdminMail,
            subject: "New Channel Partner Lead",
            message: htmlContent,
        };
        await sendEmail(emailOptions);

        // Insert the new lead into the db_channel_partner_leads table with state_id and city_id only
        const [newLead] = await db.sequelize.query(`
            INSERT INTO ${db_name}.db_channel_partner_leads 
            (first_name, last_name, contact, email, state_id, city_id, query, stage, status, createdAt, updatedAt)
            VALUES (:first_name, :last_name, :contact, :email, :state_id, :city_id, :query, :stage, :status, :createdAt, :updatedAt)`, {
            replacements: { 
                first_name, 
                last_name, 
                contact, 
                email, 
                state_id: finalStateId,
                city_id: finalCityId,
                query: null, 
                stage, 
                status, 
                createdAt, 
                updatedAt 
            },
            type: db.sequelize.QueryTypes.INSERT
        });

        // After inserting the lead, add a corresponding entry to db_channel_partner_lead_details
        const insertDetailsQuery = `
            INSERT INTO ${db_name}.db_channel_partner_lead_details 
            (cpl_id, stage, follow_up_date, remarks, status, createdAt, updatedAt)
            VALUES (:cpl_id, :stage, :follow_up_date, :remarks, :status, :createdAt, :updatedAt)`;

        await db.sequelize.query(insertDetailsQuery, {
            replacements: {
                cpl_id: newLead, // Use the newly created lead's ID
                stage: 'OPEN',
                follow_up_date: null, // Set follow-up date to null
                remarks: null, // Set remarks to null
                status: true,
                createdAt,
                updatedAt,
            },
            type: db.sequelize.QueryTypes.INSERT
        });

        // Automatically assign BST based on state_id and city_id (ID-based round-robin assignment)
        // await assignCPLeadToBST(db_name, newLead, finalStateId, finalCityId);

        return responseSuccess(req, res, "You Have Registered Successfully");

    } catch (error) {
        logErrorToFile(error);
        console.error("Error adding channel partner lead:", error);
        return responseError(req, res, "Something Went Wrong");
    }
};

exports.getCpLeadSelectedProjects = async (req, res) => {
    try {
        const { db_name, cpl_id } = req.query;

        if (!db_name) {
            return await responseError(req, res, "Client Database Name is Required");
        }
        if (!/^[A-Za-z0-9_]+$/.test(String(db_name).trim())) {
            return await responseError(req, res, "Invalid db_name");
        }

        const parsedCplId = Number(cpl_id);
        if (!Number.isInteger(parsedCplId) || parsedCplId <= 0) {
            return await responseError(req, res, "cpl_id is required and must be a valid number");
        }

        const lead = await db.sequelize.query(
            `
                SELECT cpl_id
                FROM ${db_name}.db_channel_partner_leads
                WHERE cpl_id = :cpl_id
                  AND deletedAt IS NULL
                LIMIT 1
            `,
            {
                replacements: { cpl_id: parsedCplId },
                type: db.sequelize.QueryTypes.SELECT,
            }
        );

        if (!lead[0]) {
            return await responseError(req, res, "No Lead Found with the Provided CPL ID");
        }

        const dbPrefix = `${db_name}.`;
        const assigned_projects = await getLeadProjects(db.sequelize, parsedCplId, dbPrefix);
        const bstAssignment = await getLeadBstAssignment(db.sequelize, dbPrefix, parsedCplId);
        return await responseSuccess(req, res, "CP lead selected projects fetched successfully", {
            cpl_id: parsedCplId,
            project_ids: assigned_projects.map((p) => Number(p.project_id)),
            assigned_projects,
            asssigned_to: bstAssignment.asssigned_to,
            assigned_bst: bstAssignment.assigned_bst,
        });
    } catch (error) {
        logErrorToFile(error);
        console.error(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getCpLeadProjectOptions = async (req, res) => {
    try {
        const { db_name, cpl_id } = req.query;
        const parseBstIds = (raw) => {
            if (raw === undefined || raw === null || raw === "") return [];
            let values = raw;
            if (typeof values === "string") {
                const trimmed = values.trim();
                if (!trimmed) return [];
                try {
                    values = JSON.parse(trimmed);
                } catch (_e) {
                    values = trimmed.split(",");
                }
            }
            if (!Array.isArray(values)) values = [values];
            return [...new Set(
                values
                    .map((v) => Number(String(v).trim()))
                    .filter((n) => Number.isInteger(n) && n > 0)
            )];
        };

        if (!db_name) {
            return await responseError(req, res, "Client Database Name is Required");
        }
        if (!/^[A-Za-z0-9_]+$/.test(String(db_name).trim())) {
            return await responseError(req, res, "Invalid db_name");
        }

        const projects = await db.sequelize.query(
            `
                SELECT project_id, project, state_id, city_id, zone, bst
                FROM ${db_name}.db_channel_projects
                WHERE deletedAt IS NULL
                ORDER BY project ASC
            `,
            { type: db.sequelize.QueryTypes.SELECT }
        );

        let selectedProjectIds = [];
        let parsedCplId = null;

        if (cpl_id !== undefined && cpl_id !== null && cpl_id !== "") {
            parsedCplId = Number(cpl_id);
            if (!Number.isInteger(parsedCplId) || parsedCplId <= 0) {
                return await responseError(req, res, "cpl_id must be a valid number");
            }

            const lead = await db.sequelize.query(
                `
                    SELECT cpl_id, asssigned_to
                    FROM ${db_name}.db_channel_partner_leads
                    WHERE cpl_id = :cpl_id
                      AND deletedAt IS NULL
                    LIMIT 1
                `,
                {
                    replacements: { cpl_id: parsedCplId },
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );

            if (!lead[0]) {
                return await responseError(req, res, "No Lead Found with the Provided CPL ID");
            }

            const selectedRows = await db.sequelize.query(
                `
                    SELECT project_id
                    FROM ${db_name}.cp_lead_projects
                    WHERE cpl_id = :cpl_id
                      AND deletedAt IS NULL
                `,
                {
                    replacements: { cpl_id: parsedCplId },
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );

            selectedProjectIds = selectedRows
                .map((row) => Number(row.project_id))
                .filter((id) => Number.isInteger(id) && id > 0);
        }

        const stateIds = [...new Set(
            projects
                .map((project) => Number(project.state_id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];
        const cityIds = [...new Set(
            projects
                .map((project) => Number(project.city_id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];
        const allBstIds = [...new Set(
            projects.flatMap((project) => parseBstIds(project.bst))
        )];

        const [stateRows, cityRows, bstUsers] = await Promise.all([
            stateIds.length
                ? db.sequelize.query(
                    `
                        SELECT state_id, state_name
                        FROM ${db_name}.db_states
                        WHERE state_id IN (:state_ids)
                    `,
                    {
                        replacements: { state_ids: stateIds },
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                : [],
            cityIds.length
                ? db.sequelize.query(
                    `
                        SELECT city_id, city_name
                        FROM ${db_name}.db_cities
                        WHERE city_id IN (:city_ids)
                    `,
                    {
                        replacements: { city_ids: cityIds },
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                : [],
            allBstIds.length
                ? db.sequelize.query(
                    `
                        SELECT user_id, user, user_l_name, state_id, city_id, zone
                        FROM ${db_name}.db_users
                        WHERE user_id IN (:bst_ids)
                          AND role_id = 2
                          AND deletedAt IS NULL
                    `,
                    {
                        replacements: { bst_ids: allBstIds },
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                )
                : [],
        ]);

        const stateMap = new Map(
            stateRows.map((row) => [Number(row.state_id), row.state_name || null])
        );
        const cityMap = new Map(
            cityRows.map((row) => [Number(row.city_id), row.city_name || null])
        );

        // Also resolve BST state/city names using BST user profile state_id/city_id.
        const bstStateIds = [...new Set(
            bstUsers
                .map((user) => Number(user.state_id))
                .filter((id) => Number.isInteger(id) && id > 0 && !stateMap.has(id))
        )];
        const bstCityIds = [...new Set(
            bstUsers
                .map((user) => Number(user.city_id))
                .filter((id) => Number.isInteger(id) && id > 0 && !cityMap.has(id))
        )];

        if (bstStateIds.length || bstCityIds.length) {
            const [extraStateRows, extraCityRows] = await Promise.all([
                bstStateIds.length
                    ? db.sequelize.query(
                        `
                            SELECT state_id, state_name
                            FROM ${db_name}.db_states
                            WHERE state_id IN (:state_ids)
                        `,
                        {
                            replacements: { state_ids: bstStateIds },
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    : [],
                bstCityIds.length
                    ? db.sequelize.query(
                        `
                            SELECT city_id, city_name
                            FROM ${db_name}.db_cities
                            WHERE city_id IN (:city_ids)
                        `,
                        {
                            replacements: { city_ids: bstCityIds },
                            type: db.sequelize.QueryTypes.SELECT,
                        }
                    )
                    : [],
            ]);

            extraStateRows.forEach((row) => {
                stateMap.set(Number(row.state_id), row.state_name || null);
            });
            extraCityRows.forEach((row) => {
                cityMap.set(Number(row.city_id), row.city_name || null);
            });
        }

        const bstMap = new Map();
        bstUsers.forEach((user) => {
            const id = Number(user.user_id);
            if (!Number.isInteger(id) || id <= 0) return;
            const name = [user.user, user.user_l_name].filter(Boolean).join(" ").trim() || null;
            bstMap.set(id, {
                user_id: id,
                name,
                state: stateMap.get(Number(user.state_id)) || null,
                city: cityMap.get(Number(user.city_id)) || null,
                zone: user.zone || null,
            });
        });

        const selectedSet = new Set(selectedProjectIds);
        const project_options = projects.map((project) => {
            const ids = parseBstIds(project.bst);
            const bst_users = ids
                .map((id) => bstMap.get(Number(id)))
                .filter(Boolean);
            const bst_names = bst_users
                .map((user) => user.name)
                .filter(Boolean);
            const { bst: _bstOmit, ...projectData } = project;
            return {
                ...projectData,
                state_name: stateMap.get(Number(project.state_id)) || null,
                city_name: cityMap.get(Number(project.city_id)) || null,
                is_selected: selectedSet.has(Number(project.project_id)),
                bst_ids: ids,
                bst_names,
                bst_users,
            };
        });

        let asssigned_to = null;
        let assigned_bst = null;
        if (parsedCplId) {
            const bstAssignment = await getLeadBstAssignment(db.sequelize, `${db_name}.`, parsedCplId);
            asssigned_to = bstAssignment.asssigned_to;
            assigned_bst = bstAssignment.assigned_bst;
        }

        return await responseSuccess(req, res, "CP lead project options fetched successfully", {
            cpl_id: parsedCplId,
            project_ids: selectedProjectIds,
            asssigned_to,
            assigned_bst,
            project_options,
        });
    } catch (error) {
        logErrorToFile(error);
        console.error(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getChannelPartnerLeads = async (req, res) => {
    try {
        let { db_name, cpl_id, bst_id, f_date, t_date, status_id } = req.query;
        let leads;
        if (t_date) {
            t_date = new Date(req.query.t_date);   // End Date (00:00:00 by default)
            t_date = new Date(t_date.setDate(t_date.getDate() + 1));
        }
        console.log("t_date====>>", t_date)
        if (!db_name) {
            return await responseError(req, res, "Client Database Name is Required");
        }

        // Define date filters
        let dateFilter = '';
        if (f_date && t_date) {
            dateFilter = ` AND leads.createdAt BETWEEN :f_date AND :t_date `;
        } else if (f_date) {
            dateFilter = ` AND leads.createdAt >= :f_date `;
        } else if (t_date) {
            dateFilter = ` AND leads.createdAt <= :t_date `;
        }

        // Define status filter
        let statusFilter = '';
        if (status_id) {
            statusFilter = ` AND leads.stage = :status_id `;
        }

        // Handle role_id == 3 logic (Director/Supervisor)
        if (req.user.role_id == 3) {
            // Use recursive query to get all users under the Director (including BST users)
            const getUserHierarchyQuery = `
                WITH RECURSIVE user_hierarchy AS (
                    SELECT user_id, report_to, user
                    FROM ${db_name}.db_users
                    WHERE user_id = :user_id
                    UNION
                    SELECT u.user_id, u.report_to, u.user
                    FROM ${db_name}.db_users u
                    INNER JOIN user_hierarchy uh ON u.report_to = uh.user_id
                )
                SELECT user_id, user FROM user_hierarchy;
            `;

            const allUsersUnderDirector = await db.sequelize.query(getUserHierarchyQuery, {
                replacements: { user_id: req.user.user_id },
                type: db.sequelize.QueryTypes.SELECT
            });

            const userIds = allUsersUnderDirector.map(user => user.user_id);

            // If no users found in hierarchy, fallback to showing all BST users
            if (userIds.length === 0 || userIds.length === 1) {
                // Fallback: Get all BST users (role_id = 2) if no hierarchy exists
                const getAllBSTUsersQuery = `
                    SELECT user_id, user
                    FROM ${db_name}.db_users
                    WHERE role_id = 2 AND user_status = true AND deletedAt IS NULL
                `;
                const bstUsers = await db.sequelize.query(getAllBSTUsersQuery, {
                    type: db.sequelize.QueryTypes.SELECT
                });
                userIds.length = 0; // Clear array
                userIds.push(...bstUsers.map(user => user.user_id));
            }

            // Fetch leads assigned to all users under Director (or all BST users if no hierarchy)
            const getLeadsQuery = `
                SELECT leads.*, users.user_id, users.user, users.user_status
                FROM ${db_name}.db_channel_partner_leads as leads
                LEFT JOIN ${db_name}.db_users as users
                ON leads.asssigned_to = users.user_id
                WHERE leads.asssigned_to IN (:user_ids) AND leads.deletedAt IS NULL ${statusFilter} ${dateFilter}
                ORDER BY leads.createdAt DESC
            `;

            leads = await db.sequelize.query(getLeadsQuery, {
                replacements: { user_ids: userIds, f_date, t_date, status_id },
                type: db.sequelize.QueryTypes.SELECT
            });
        }
        else if (cpl_id) {
            // Fetch the specific lead with the provided cpl_id
            const getSingleLeadQuery = `
                SELECT leads.*, users.user_id, users.user, users.user_status 
                FROM ${db_name}.db_channel_partner_leads as leads
                LEFT JOIN ${db_name}.db_users as users
                ON leads.asssigned_to = users.user_id
                WHERE leads.cpl_id = :cpl_id ${statusFilter} ${dateFilter}
            `;

            const singleLead = await db.sequelize.query(getSingleLeadQuery, {
                replacements: { cpl_id, f_date, t_date, status_id },
                type: db.sequelize.QueryTypes.SELECT
            });

            if (singleLead.length === 0) {
                return await responseError(req, res, "No Lead Found with the Provided CPL ID");
            }

            leads = singleLead;
        }
        else if (bst_id) {
            // Leads explicitly assigned to this BST, OR leads tied to a project that lists this BST in project.bst
            let getAllLeadsQuery = `
                SELECT DISTINCT leads.*, users.user_id, users.user, users.user_status
                FROM ${db_name}.db_channel_partner_leads AS leads
                LEFT JOIN ${db_name}.db_users AS users ON leads.asssigned_to = users.user_id
                LEFT JOIN ${db_name}.cp_lead_projects AS clp ON clp.cpl_id = leads.cpl_id AND clp.deletedAt IS NULL
                LEFT JOIN ${db_name}.db_channel_projects AS p ON p.project_id = clp.project_id AND p.deletedAt IS NULL
                WHERE leads.deletedAt IS NULL ${statusFilter} ${dateFilter}
                  AND (
                    leads.asssigned_to = :bst_id
                    OR JSON_CONTAINS(
                      COALESCE(NULLIF(p.bst, ''), '[]'),
                      CAST(:bst_id AS JSON),
                      '$'
                    )
                  )
                ORDER BY leads.createdAt DESC
            `;

            leads = await db.sequelize.query(getAllLeadsQuery, {
                replacements: { bst_id, f_date, t_date, status_id },
                type: db.sequelize.QueryTypes.SELECT
            });
        }
        else {
            let getAllLeadsQuery;

            if (req.user.isDB) {
                getAllLeadsQuery = `
                    SELECT leads.*, users.user_id, users.user, users.user_status
                    FROM ${db_name}.db_channel_partner_leads as leads
                    LEFT JOIN ${db_name}.db_users as users
                    ON leads.asssigned_to = users.user_id
                    WHERE 1=1 AND leads.deletedAt IS NULL ${statusFilter} ${dateFilter}
                    ORDER BY leads.createdAt DESC
                `;

            } else if (Number(req.user.role_id) === 2) {
                // BST: see leads assigned to them OR any lead with a mapped project that includes this BST in project.bst
                getAllLeadsQuery = `
                    SELECT DISTINCT leads.*, users.user_id, users.user, users.user_status
                    FROM ${db_name}.db_channel_partner_leads AS leads
                    LEFT JOIN ${db_name}.db_users AS users ON leads.asssigned_to = users.user_id
                    LEFT JOIN ${db_name}.cp_lead_projects AS clp ON clp.cpl_id = leads.cpl_id AND clp.deletedAt IS NULL
                    LEFT JOIN ${db_name}.db_channel_projects AS p ON p.project_id = clp.project_id AND p.deletedAt IS NULL
                    WHERE leads.deletedAt IS NULL ${statusFilter} ${dateFilter}
                      AND (
                        leads.asssigned_to = :user_id
                        OR JSON_CONTAINS(
                          COALESCE(NULLIF(p.bst, ''), '[]'),
                          CAST(:user_id AS JSON),
                          '$'
                        )
                      )
                    ORDER BY leads.createdAt DESC
                `;
            } else {
                getAllLeadsQuery = `
                    SELECT leads.*, users.user_id, users.user, users.user_status  
                    FROM ${db_name}.db_channel_partner_leads as leads
                    LEFT JOIN ${db_name}.db_users as users
                    ON leads.asssigned_to = users.user_id
                    WHERE leads.asssigned_to = :user_id AND leads.deletedAt IS NULL ${statusFilter} ${dateFilter} 
                    ORDER BY leads.createdAt DESC
                `;
            }

            leads = await db.sequelize.query(getAllLeadsQuery, {
                replacements: { user_id: req.user.user_id, f_date, t_date, status_id },
                type: db.sequelize.QueryTypes.SELECT
            });
        }

        // Enrich CP leads with assigned project list from cp_lead_projects mapping.
        if (Array.isArray(leads) && leads.length) {
            const cplIds = [...new Set(
                leads
                    .map((lead) => Number(lead.cpl_id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )];

            if (cplIds.length) {
                const leadProjects = await db.sequelize.query(
                    `
                        SELECT
                            clp.cpl_id,
                            p.project_id,
                            p.project,
                            p.state_id,
                            p.city_id,
                            p.zone
                        FROM ${db_name}.cp_lead_projects clp
                        INNER JOIN ${db_name}.db_channel_projects p
                            ON p.project_id = clp.project_id
                            AND p.deletedAt IS NULL
                        WHERE clp.cpl_id IN (:cpl_ids)
                          AND clp.deletedAt IS NULL
                        ORDER BY p.project ASC
                    `,
                    {
                        replacements: { cpl_ids: cplIds },
                        type: db.sequelize.QueryTypes.SELECT,
                    }
                );

                const projectMap = new Map();
                leadProjects.forEach((row) => {
                    const key = Number(row.cpl_id);
                    if (!projectMap.has(key)) projectMap.set(key, []);
                    projectMap.get(key).push({
                        project_id: row.project_id,
                        project: row.project,
                        state_id: row.state_id,
                        city_id: row.city_id,
                        zone: row.zone,
                    });
                });

                leads = leads.map((lead) => ({
                    ...lead,
                    assigned_projects: projectMap.get(Number(lead.cpl_id)) || [],
                }));
            } else {
                leads = leads.map((lead) => ({ ...lead, assigned_projects: [] }));
            }
        }

        return await responseSuccess(req, res, "Leads Retrieved Successfully", leads);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.updateChannelPartnerLeads = async (req, res) => {
    try {
        const { db_name, cpl_id, stage, follow_up_date, remarks, status, asssigned_to, otp } = req.body;
        const now = new Date();
        const updatedAt = now.toISOString().slice(0, 19).replace('T', ' ');

        if (!db_name) {
            return responseError(req, res, "Client Database Name is Required");
        }

        if (!cpl_id) {
            return responseError(req, res, "CPL ID is Required");
        }

        // Check if the lead with the provided cpl_id exists
        const checkLeadQuery = `
            SELECT * FROM ${db_name}.db_channel_partner_leads 
            WHERE cpl_id = :cpl_id
        `;

        const existingLead = await db.sequelize.query(checkLeadQuery, {
            replacements: { cpl_id },
            type: db.sequelize.QueryTypes.SELECT
        });

        if (existingLead.length === 0) {
            return responseError(req, res, "No Lead Found with the Provided CPL ID");
        }
        // Enforce OTP when changing stage to 'VISIT'
        if (stage && String(stage).toUpperCase() === 'VISIT') {
            // If role info is available, restrict to Admin/Manager (role_id 2 or 3). Otherwise, still enforce OTP.
            const isAdminOrBST =
                req?.user?.isDB === true ||
                req?.user?.role_id === 2 ||
                req?.user?.role_id === 3 ||
                typeof req?.user?.role_id === 'undefined';
            if (!isAdminOrBST) {
                return responseError(req, res, "Only Admin or BST can update stage to VISIT");
            }

            const key = makeOtpKey(db_name, cpl_id);
            const record = CP_VISIT_OTP_STORE.get(key);
            const nowMs = Date.now();
            if (!otp) {
                return responseError(req, res, "OTP is required to change stage to VISIT");
            }
            if (!record) {
                return responseError(req, res, "No OTP found. Please generate OTP first");
            }
            if (record.expiresAt < nowMs) {
                CP_VISIT_OTP_STORE.delete(key);
                return responseError(req, res, "OTP expired. Please generate a new OTP");
            }
            if (String(record.otp) !== String(otp)) {
                return responseError(req, res, "Invalid OTP");
            }
            // OTP verified; clear it so it can't be reused
            CP_VISIT_OTP_STORE.delete(key);
        }

        // Update the lead data in the db_channel_partner_leads table
        const updateLeadQuery = `
            UPDATE ${db_name}.db_channel_partner_leads 
            SET stage = :stage, updatedAt = :updatedAt,
            follow_up_date = :follow_up_date, remarks= :remarks,
            asssigned_to = :asssigned_to
            WHERE cpl_id = :cpl_id
        `;

        await db.sequelize.query(updateLeadQuery, {
            replacements: {
                stage,
                updatedAt,
                cpl_id,
                follow_up_date: (typeof follow_up_date !== 'undefined' ? follow_up_date : null),
                remarks: (typeof remarks !== 'undefined' ? remarks : null),
                asssigned_to: (typeof asssigned_to !== 'undefined' ? asssigned_to : null)
            },
            type: db.sequelize.QueryTypes.UPDATE
        });

        // Insert a new entry into db_channel_partner_lead_details with the provided follow_up_date and remarks
        const insertDetailsQuery = `
            INSERT INTO ${db_name}.db_channel_partner_lead_details 
            (cpl_id, stage, follow_up_date, remarks, status, createdAt, updatedAt)
            VALUES (:cpl_id, :stage, :follow_up_date, :remarks, :status, :createdAt, :updatedAt)
        `;

        await db.sequelize.query(insertDetailsQuery, {
            replacements: {
                cpl_id,
                stage,
                follow_up_date: follow_up_date || null, // Use provided follow_up_date, or null if not provided
                remarks: remarks || null,               // Use provided remarks, or null if not provided
                status: status !== undefined ? status : true,  // Use provided status, default to true if not provided
                createdAt: updatedAt,
                updatedAt
            },
            type: db.sequelize.QueryTypes.INSERT
        });

        return responseSuccess(req, res, "Lead Updated Successfully");

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return responseError(req, res, "Something Went Wrong");
    }
};

exports.deleteChannelPartnerLead = async (req, res) => {
    try {
        const { cpl_id } = req.query;

        if (!cpl_id) {
            return await responseError(req, res, "CPL ID is Required");
        }

        const cpl = await req.config.channelPartnerLeads.findOne({ where: { cpl_id: cpl_id } })

        if (!cpl) {
            return await responseError(req, res, "Channel Partner Lead not found");
        }

        await cpl.destroy()
        return await responseSuccess(req, res, "Lead Deleted Successfully");

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
}

exports.assignLeadsRoundRobin = async (req) => {
    try {
        // Fetch all unassigned leads (assumed to have `asssigned_to = null`)
        const unassignedLeads = await req.channelPartnerLeads.findAll({
            where: { asssigned_to: null, stage: 'OPEN', status: true }
        });

        if (unassignedLeads.length === 0) {
            console.log('No unassigned leads found.');
            return;
        }

        // Fetch all accounts with role_id = 2, sorted by createdAt
        const accounts = await req.users.findAll({
            where: { role_id: 2, user_status: true, deletedAt: null },
            order: [['createdAt', 'ASC']] // Sort accounts by createdAt (ascending)
        });

        if (accounts.length === 0) {
            console.log('No accounts found with role_id = 2');
            return;
        }

        // Total number of leads and accounts
        const totalLeads = unassignedLeads.length;
        const totalAccounts = accounts.length;

        // Fetch number of leads already assigned to each account
        const accountLeadCount = await Promise.all(accounts.map(async account => {
            const assignedLeadsCount = await req.channelPartnerLeads.count({ where: { asssigned_to: account.user_id } });
            return { account, assignedLeadsCount };
        }));
        // Sort accounts by their existing assigned leads, then by createdAt
        accountLeadCount.sort((a, b) => {
            if (a.assignedLeadsCount === b.assignedLeadsCount) {
                return new Date(a.account.createdAt) - new Date(b.account.createdAt);
            }
            return a.assignedLeadsCount - b.assignedLeadsCount;
        });
        console.log("accountLeadCount=============>>", accountLeadCount)

        // Divide leads among accounts
        const baseLeadsPerAccount = Math.floor(totalLeads / totalAccounts);
        let remainderLeads = totalLeads % totalAccounts; // Extra leads

        // Assign leads to each account in sorted order
        let leadIndex = 0;
        for (const { account } of accountLeadCount) {
            const leadsToAssign = baseLeadsPerAccount + (remainderLeads > 0 ? 1 : 0); // Extra leads to be fairly distributed

            // Assign the calculated number of leads to each account
            for (let i = 0; i < leadsToAssign && leadIndex < totalLeads; i++) {
                const lead = unassignedLeads[leadIndex];
                await lead.update({ asssigned_to: account.user_id });
                leadIndex++;
            }

            // Reduce the remainder leads after each assignment
            if (remainderLeads > 0) {
                remainderLeads--;
            }
        }
        console.log('Leads assigned successfully.');
        return
    } catch (error) {
        console.error('Error assigning leads:', error);
    }
}

async function assignLeadsRoundRobins(req) {
    try {
        // Fetch all unassigned leads (assumed to have `asssigned_to = null`)
        const unassignedLeads = await req.channelPartnerLeads.findAll({
            where: { asssigned_to: null, stage: 'OPEN', status: true }
        });

        if (unassignedLeads.length === 0) {
            console.log('No unassigned leads found.');
            return;
        }

        // Fetch all accounts with role_id = 2, sorted by createdAt
        const accounts = await req.users.findAll({
            where: { role_id: 2 },
            order: [['createdAt', 'ASC']] // Sort accounts by createdAt (ascending)
        });

        if (accounts.length === 0) {
            console.log('No accounts found with role_id = 2');
            return;
        }

        // Total number of leads and accounts
        const totalLeads = unassignedLeads.length;
        const totalAccounts = accounts.length;

        // Fetch number of leads already assigned to each account
        const accountLeadCount = await Promise.all(accounts.map(async account => {
            const assignedLeadsCount = await req.channelPartnerLeads.count({ where: { asssigned_to: account.user_id } });
            return { account, assignedLeadsCount };
        }));
        console.log("accountLeadCount=============>>", accountLeadCount)
        // Sort accounts by their existing assigned leads, then by createdAt
        accountLeadCount.sort((a, b) => {
            if (a.assignedLeadsCount === b.assignedLeadsCount) {
                return new Date(a.account.createdAt) - new Date(b.account.createdAt);
            }
            return a.assignedLeadsCount - b.assignedLeadsCount;
        });
        console.log("accountLeadCount=============>>", accountLeadCount)

        // Divide leads among accounts
        const baseLeadsPerAccount = Math.floor(totalLeads / totalAccounts);
        let remainderLeads = totalLeads % totalAccounts; // Extra leads

        // Assign leads to each account in sorted order
        let leadIndex = 0;
        for (const { account } of accountLeadCount) {
            const leadsToAssign = baseLeadsPerAccount + (remainderLeads > 0 ? 1 : 0); // Extra leads to be fairly distributed

            // Assign the calculated number of leads to each account
            for (let i = 0; i < leadsToAssign && leadIndex < totalLeads; i++) {
                const lead = unassignedLeads[leadIndex];
                await lead.update({ asssigned_to: account.user_id });
                leadIndex++;
            }

            // Reduce the remainder leads after each assignment
            if (remainderLeads > 0) {
                remainderLeads--;
            }
        }
        console.log('Leads assigned successfully.');
        return
    } catch (error) {
        console.error('Error assigning leads:', error);
    }
}

exports.assignLeads = async (req, res) => {
    try {
        await assignLeadsRoundRobins(req)
        return await responseSuccess(req, res, "Leads assigned successfully");

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
}

exports.getLeadDetails = async (req, res) => {
    try {
        const { db_name, cpl_id } = req.query;

        if (!db_name) {
            return responseError(req, res, "Client Database Name is Required");
        }

        if (!cpl_id) {
            return responseError(req, res, "CPL ID is Required");
        }

        // Query to fetch all lead details based on cpl_id
        const leadDetailsQuery = `
            SELECT * FROM ${db_name}.db_channel_partner_lead_details
            WHERE cpl_id = :cpl_id
            ORDER BY createdAt DESC
        `;

        const leadDetails = await db.sequelize.query(leadDetailsQuery, {
            replacements: { cpl_id },
            type: db.sequelize.QueryTypes.SELECT
        });

        if (leadDetails.length === 0) {
            return responseError(req, res, "No Lead Details Found for the Provided CPL ID");
        }

        return responseSuccess(req, res, "Lead Details Retrieved Successfully", leadDetails);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return responseError(req, res, "Something Went Wrong");
    }
};
