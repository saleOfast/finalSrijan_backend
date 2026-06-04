const { responseError, responseSuccess } = require("../../helper/responce");
const { bulkImportChannelPartners } = require("../../services/channel/cpBulkImportService");

exports.bulkImportCP = async (req, res) => {
    try {
        const result = await bulkImportChannelPartners(req);
        return responseSuccess(req, res, "CP bulk import completed", result);
    } catch (error) {
        console.error("CP bulk import failed:", error);
        return responseError(req, res, "Failed to process CP bulk import", error?.message || error);
    }
};
