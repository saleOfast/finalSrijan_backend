//importing modules
const express = require("express");
const contactController = require("../controllers/contactUsController");
const { resolver } = require("../connectionResolver/resolver");
const { protect, rolePermission } = require("../middleware/authController");
const { userValidationRules, validate, superValidate } = require('../validator/validation');
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
    .route("/getLeadDetails")
    .get(resolver, rolePermission, contactController.getLeadDetails)

module.exports = router;