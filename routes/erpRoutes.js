//importing modules
const express = require("express");
const controller = require("../controllers/erpController");
const erpAuth = require("../middleware/erpAuth");
const erpResolver = require("../connectionResolver/erpResolver");
const router = express.Router();

// ERP webhook to upsert leads
router
  .route("/lead")
  .post(erpAuth, erpResolver, controller.webhookUpsertLead);

router
  .route("/booking")
  .post(erpAuth, erpResolver, controller.webhookUpsertBooking);

router
  .route("/booking/status")
  .put(erpAuth, erpResolver, controller.webhookUpdateBookingStatus);

module.exports = router;


