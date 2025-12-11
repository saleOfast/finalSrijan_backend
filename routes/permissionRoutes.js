//importing modules
const express = require("express");
const permissionController = require("../controllers/permissionController");
const { resolver } = require("../connectionResolver/resolver");
const { rolePermission, } = require("../middleware/authController")
const router = express.Router();


//admin routes
router
    .route("/")
    .post(resolver, rolePermission, permissionController.givePermission)
    .get(resolver, rolePermission, permissionController.ViewPermissionRoleWise)

router
    .route("/roleWise")
    .get( permissionController.permissionCheckAtLogin)

router
    .route("/nav")
    .get(resolver, permissionController.getDynamicDashboardNav)
    .put(resolver, permissionController.updateMenuNav)

router
    .route("/admin-nav")
    .get(resolver, permissionController.getDynamicDashboardAdminNav)

router
    .route("/filtered")
    .get(resolver, permissionController.getRolePermissionsFiltered)

module.exports = router