//importing modules
const express = require("express");
const roleController = require("../controllers/roleController");
const {resolver} = require("../connectionResolver/resolver");
const { rolePermission} = require("../middleware/authController")
const router = express.Router();


//admin routes
router
    .route("/")
        .post( resolver,  rolePermission, roleController.storeRole)
        .put(resolver,  rolePermission, roleController.editRole)
        .get(resolver,  rolePermission, roleController.getRole)
        .delete(resolver,  rolePermission, roleController.deleteRole)

router
    .route("/one")
        .get(resolver, rolePermission, roleController.getRoleOne)

// Role Management Routes for Frontend Interface
router
    .route("/platforms")
        .get(resolver, rolePermission, roleController.getPlatforms)

router
    .route("/menus/:platform_type")
        .get(resolver, rolePermission, roleController.getMenusByPlatform)

router
    .route("/permissions/:role_id")
        .get(resolver, rolePermission, roleController.getRolePermissions)

router
    .route("/create-with-permissions")
        .post(resolver, rolePermission, roleController.createRoleWithPermissions)

router
    .route("/update-permissions")
        .put(resolver, rolePermission, roleController.updateRolePermissions)

module.exports = router;