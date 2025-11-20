//importing modules
const express = require("express");
const controller = require("../../controllers/channel/channelReportController");
const {resolver} = require("../../connectionResolver/resolver");
const router = express.Router();

// Leads Generated Report Routes
router
    .route("/leads-generated")
    .get(resolver, controller.getLeadsGeneratedReport)

router
    .route("/leads-generated/download")
    .get(resolver, controller.downloadLeadsGeneratedExcel)

// Visits Created Report Routes
router
    .route("/visits-created")
    .get(resolver, controller.getVisitsCreatedReport)

router
    .route("/visits-created/download")
    .get(resolver, controller.downloadVisitsCreatedExcel)

// Visits Completed Report Routes
router
    .route("/visits-completed")
    .get(resolver, controller.getVisitsCompletedReport)

router
    .route("/visits-completed/download")
    .get(resolver, controller.downloadVisitsCompletedExcel)

// Bookings Completed Report Routes
router
    .route("/bookings-completed")
    .get(resolver, controller.getBookingsCompletedReport)

router
    .route("/bookings-completed/download")
    .get(resolver, controller.downloadBookingsCompletedExcel)

module.exports = router;

