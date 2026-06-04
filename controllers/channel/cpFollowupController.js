const { responseError, responseSuccess } = require("../../helper/responce");
const {
  CP_ACTIVITY_VALUES,
  recordCpFollowup,
  getCpFollowupHistory,
} = require("../../services/channel/cpFollowupService");

exports.getCpFollowupActivities = async (req, res) => {
  try {
    return await responseSuccess(req, res, "CP follow-up activities fetched successfully", {
      activities: CP_ACTIVITY_VALUES,
    });
  } catch (error) {
    logErrorToFile(error);
    console.error(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.recordCpFollowup = async (req, res) => {
  try {
    const result = await recordCpFollowup(req.config, req.user, req.body);
    if (!result.ok) return await responseError(req, res, result.message);
    return await responseSuccess(req, res, "CP follow-up recorded successfully", result.data);
  } catch (error) {
    logErrorToFile(error);
    console.error(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.getCpFollowupHistory = async (req, res) => {
  try {
    const user_id = req.query.user_id || req.params.user_id;
    const result = await getCpFollowupHistory(req.config, req.user, user_id);
    if (!result.ok) return await responseError(req, res, result.message);
    return await responseSuccess(req, res, "CP follow-up history fetched successfully", result.data);
  } catch (error) {
    logErrorToFile(error);
    console.error(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};
