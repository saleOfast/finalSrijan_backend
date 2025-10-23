const { responseError } = require("../helper/responce");

// Simple shared-secret authentication for ERP webhooks
module.exports = async function erpAuth(req, res, next) {
  try {
    const providedKey = req.headers["x-api-key"] || req.query.api_key;
    const expectedKey = process.env.ERP_WEBHOOK_SECRET;

    if (!expectedKey) {
      return responseError(req, res, "Server misconfigured: ERP_WEBHOOK_SECRET not set");
    }

    if (!providedKey || providedKey !== expectedKey) {
      return responseError(req, res, "Unauthorized: invalid API key");
    }

    next();
  } catch (error) {
    logErrorToFile(error);
    return responseError(req, res, "Unauthorized");
  }
}


