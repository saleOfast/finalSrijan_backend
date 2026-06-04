const express = require("express");
const controller = require("../../controllers/channel/projectMasterController");
const { resolver } = require("../../connectionResolver/resolver");
const router = express.Router();

router.get("/states", resolver, controller.getStatePicklist);
router.get("/cities", resolver, controller.getCityPicklist);

router
  .route("/")
  .post(resolver, controller.createProjectMaster)
  .put(resolver, controller.updateProjectMaster)
  .get(resolver, controller.getProjectMaster)
  .delete(resolver, controller.deleteProjectMaster);

module.exports = router;
