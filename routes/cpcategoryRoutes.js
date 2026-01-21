//importing modules
const express = require("express");
const userController = require("../controllers/userController");
const { resolver } = require("../connectionResolver/resolver");
const { rolePermission } = require("../middleware/authController");
const router = express.Router();

//admin routes
router
  .route("/")
  .post(resolver, rolePermission, userController.addCustomerPartnerType)
  .put(resolver, rolePermission, userController.editCustomerPartnerType)
  .get(resolver, rolePermission, userController.getCustomerPartnerType)
  .delete(resolver, rolePermission, userController.deleteCustomerPartnerType);

module.exports = router;

