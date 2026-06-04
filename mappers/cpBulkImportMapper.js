const normalizeSpaces = (value) => String(value || "").trim().replace(/\s+/g, " ");

const normalizePhone = (value) => {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\D/g, "");
};

const normalizeEmail = (value) => normalizeSpaces(value).toLowerCase();

const FIELD_ALIASES = {
    name: ["name", "full_name", "fullName", "cp_name", "cpName"],
    first_name: ["first_name", "firstname", "firstName", "f_name", "fname"],
    last_name: ["last_name", "lastname", "lastName", "l_name", "lname", "surname"],
    email: ["email", "email_id", "mail", "emailAddress"],
    phone: ["phone", "mobile", "contact", "contact_number", "phone_number"],
    company_name: ["company_name", "company", "organisation", "organization", "companyName"],
    rera_id: ["rera_id", "rera", "rera_no", "rera_number"],
    address: ["address", "full_address", "location", "addr"],
    state_id: ["state_id", "stateId"],
    city_id: ["city_id", "cityId"],
    state: ["state", "state_name", "stateName"],
    city: ["city", "city_name", "cityName"],
    tenant_id: ["tenant_id", "tenantId"],
    client_id: ["client_id", "clientId"],
};

const pickValue = (record, keys = []) => {
    const keyMap = new Map(
        Object.keys(record || {}).map((key) => [String(key).trim().toLowerCase(), record[key]])
    );

    for (const key of keys) {
        const found = keyMap.get(String(key).toLowerCase());
        if (found !== undefined) return found;
    }
    return undefined;
};

const splitName = (name = "") => {
    const cleanName = normalizeSpaces(name);
    if (!cleanName) return { first_name: "", last_name: "" };
    const [first_name, ...rest] = cleanName.split(" ");
    return {
        first_name,
        last_name: rest.join(" ").trim(),
    };
};

const normalizeClientRecord = (record = {}) => {
    const normalized = {};
    for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
        normalized[targetField] = pickValue(record, aliases);
    }

    normalized.name = normalizeSpaces(normalized.name);
    normalized.email = normalizeEmail(normalized.email);
    normalized.phone = normalizePhone(normalized.phone);
    normalized.company_name = normalizeSpaces(normalized.company_name);
    normalized.rera_id = normalizeSpaces(normalized.rera_id);
    normalized.address = normalizeSpaces(normalized.address);
    normalized.state = normalizeSpaces(normalized.state);
    normalized.city = normalizeSpaces(normalized.city);

    return normalized;
};

const mapImportRecordToEntities = ({
    record,
    defaults = {},
}) => {
    const normalized = normalizeClientRecord(record);
    const split = splitName(normalized.name);
    const first_name = normalizeSpaces(normalized.first_name) || split.first_name;
    const last_name = normalizeSpaces(normalized.last_name) || split.last_name;

    const leadPayload = {
        first_name,
        last_name,
        email: normalized.email || null,
        contact: normalized.phone || null,
        query: normalized.rera_id || null,
        stage: "ONBOARDED",
        status: true,
        state_id: normalized.state_id ? Number(normalized.state_id) : (defaults.state_id ?? null),
        city_id: normalized.city_id ? Number(normalized.city_id) : (defaults.city_id ?? null),
        state: normalized.state || null,
        city: normalized.city || null,
    };

    const userPayload = {
        user: normalized.name || first_name || "Channel Partner",
        user_l_name: last_name || null,
        email: normalized.email || null,
        contact_number: normalized.phone || null,
        organisation: normalized.company_name || null,
        address: normalized.address || null,
        role_id: Number(defaults.role_id),
        isDB: false,
        user_status: true,
        doc_verification: 2,
        bst_approval: true,
        bst_response: true,
        director_approval: true,
        director_response: true,
        onboarding_date: new Date(),
        country_id: defaults.country_id ?? 101,
        state_id: leadPayload.state_id,
        city_id: leadPayload.city_id,
        report_to: defaults.report_to ?? null,
        cp_category: defaults.cp_category ?? null,
        db_name: defaults.db_name || null,
    };

    const metadataPayload = {
        tenant_id: normalized.tenant_id ?? defaults.tenant_id ?? null,
        client_id: normalized.client_id ?? defaults.client_id ?? null,
    };

    return {
        normalized,
        leadPayload,
        userPayload,
        metadataPayload,
    };
};

module.exports = {
    normalizeClientRecord,
    mapImportRecordToEntities,
};
