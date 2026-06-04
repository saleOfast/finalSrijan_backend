//importing modules
const express = require("express");
const userController = require("../controllers/userController");
const cpFollowupController = require("../controllers/channel/cpFollowupController");
const { resolver } = require("../connectionResolver/resolver");
const { rolePermission } = require("../middleware/authController");
const router = express.Router();
const {
  userValidationRules,
  validate,
  superValidate,
} = require("../validator/validation");

//admin routes
router
  .route("/")
  .post(
    resolver,
    rolePermission,
    userValidationRules("registerUser"),
    validate,
    userController.createUser
  )
  .get(resolver, rolePermission, userController.getAllUsers)
  .put(
    resolver,
    rolePermission,
    userValidationRules("editUser"),
    validate,
    userController.updateUser
  )
  .delete(
    resolver,
    rolePermission,
    userValidationRules("deleteUser"),
    validate,
    userController.deleteUser
  );

router.route("/uploads").post(resolver, userController.uploadsUserImages);

router.route("/checkplatform").post(resolver, userController.checkplatformPermission);

router
  .route("/owner")
  .get(resolver, userController.getOwnerList)
  .post(resolver, userController.registerBulkUser)
  .put(
    resolver,
    rolePermission,
    userValidationRules("editInDbClientUser"),
    validate,
    userController.updateUser
  );

router
  .route("/forget")
  .post(userController.forgotpassword)
  .put(userController.resetPassword);



router.route("/count").post(resolver, userController.totalUser);
//=========================== Channel Partner Routes ===============================================
router.route("/cp/completeRegistration").put(userValidationRules("registerCP"), validate, userController.cpCompleteRegistration);
router.route("/cp/registrationToken/verification").post(userValidationRules("registerCPTokenVerify"), validate, userController.registrationTokenVerification);
router.route("/cp/getPendingVerificationUser").get(resolver, userController.getPendingVerificationUser);

router
  .route("/cp/send")
  .post(userController.sendOtp)

// Retry pushing CP data to ERP manually
router
  .route("/cp/retryErpPush")
  .post(resolver, userController.retryPushCPToERP);

router
  .route("/rolewise")
  .get(resolver, userController.getUsersByRoleID)

router
  .route("/bst/active")
  .get(resolver, userController.getActiveBSTList)

router
  .route("/projects/options")
  .get(resolver, userController.getChannelPartnerProjectOptions)

router
  .route("/cp-followup/activities")
  .get(resolver, rolePermission, cpFollowupController.getCpFollowupActivities);

router
  .route("/cp-followup")
  .post(resolver, rolePermission, cpFollowupController.recordCpFollowup);

router
  .route("/cp-followup/history")
  .get(resolver, rolePermission, cpFollowupController.getCpFollowupHistory);

router
  .route("/delete")
  .put(resolver, userController.deleteUserByID)


router
  .route("/cp/verify")
  .post(userController.otpVerification)
  .put(userController.resetChannelPassword);

router
  .route("/channelPartnerType")
  .get(resolver, userController.getCustomerPartnerType)
  .delete(resolver, userController.deleteCustomerPartnerType)
  .post(
    resolver,
    userController.addCustomerPartnerType
  )
  .put(resolver, userController.editCustomerPartnerType);

router
  .route("/field").post(resolver, userController.storeExtraUser)

router
  .route("/resendEmailToPendingUser").post(resolver, userController.resendEmailToPendingUser)

// ======================== DMS DISTRIBUTOR VERIFICATION ==============================  
router.
  route("/dms/verification").post(userValidationRules("registerCPTokenVerify"), validate, userController.dmsRegistrationTokenVerification);

router.
  route("/dms/getPendingVerificationDistrubutors").get(resolver, userController.getPendingVerificationMasturbators);

router.route("/dms/uploads").post(resolver, userController.uploadsUserImagesDMS);

router.route("/dms/completeRegistration").put(validate, userController.dmsCompleteRegistration);

module.exports = router;
