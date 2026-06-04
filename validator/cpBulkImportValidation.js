const { responseError } = require("../helper/responce");

const hasImportPayload = (req) => {
    const body = req.body || {};
    if (Array.isArray(body.records) && body.records.length > 0) return true;
    if (Array.isArray(body.data) && body.data.length > 0) return true;
    if (typeof body.data === "string" && body.data.trim()) return true;
    if (typeof body.csv === "string" && body.csv.trim()) return true;
    if (req.files && Object.keys(req.files).length > 0) return true;
    return false;
};

const validateBulkImportCPRequest = async (req, res, next) => {
    const cpRoleId = Number(req.body?.cp_role_id ?? 3);
    if (!Number.isInteger(cpRoleId) || cpRoleId <= 0) {
        return responseError(req, res, "cp_role_id must be a valid positive number");
    }

    if (!hasImportPayload(req)) {
        return responseError(
            req,
            res,
            "Provide import dataset via records/data/csv in body or upload a CSV/JSON file"
        );
    }

    return next();
};

module.exports = {
    validateBulkImportCPRequest,
};
