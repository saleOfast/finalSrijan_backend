//importing modules
const express = require("express");
const contactController = require("../controllers/contactUsController");
const cpBulkImportController = require("../controllers/channel/cpBulkImportController");
const { resolver } = require("../connectionResolver/resolver");
const { protect, rolePermission } = require("../middleware/authController");
const { userValidationRules, validate, superValidate } = require('../validator/validation');
const { validateBulkImportCPRequest } = require("../validator/cpBulkImportValidation");
const router = express.Router();

//admin routes
router
    .route("/")
    .post(contactController.addChannelPartnerLead)
    .get(resolver, contactController.getChannelPartnerLeads)
    .put(resolver, contactController.updateChannelPartnerLeads)
    .delete(resolver, contactController.deleteChannelPartnerLead)

router
    .route("/sendVisitOTP")
    .post(resolver, rolePermission, contactController.sendVisitOTP)

router
    .route("/assignLeads")
    .post(resolver, rolePermission, contactController.assignLeads)

router
    .route("/projects")
    .get(resolver, contactController.getCpLeadSelectedProjects)

router
    .route("/projects/options")
    .get(resolver, contactController.getCpLeadProjectOptions)

router
    .route("/getLeadDetails")
    .get(resolver, rolePermission, contactController.getLeadDetails)

router
    .route("/bulk-import-cp")
    .post(
        resolver,
        rolePermission,
        validateBulkImportCPRequest,
        cpBulkImportController.bulkImportCP
    );

module.exports = router;
