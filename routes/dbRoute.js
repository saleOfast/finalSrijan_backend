//importing modules
const express = require("express");
const dbCreateController = require("../controllers/dbCreateController");
const { resolver } = require("../connectionResolver/resolver");
const { userValidationRules, validate, superValidate } = require('../validator/validation');
const { supreProtect, adminOrSuperProtect } = require('../middleware/authController')
const router = express.Router();

//admin routes
router
	.route("/")
	.post(supreProtect, userValidationRules('registerClientUser'), superValidate, dbCreateController.db_creater);

router
	.route("/login")
	.post(userValidationRules('login'), superValidate, dbCreateController.db_login)
	.get(dbCreateController.downloadExcelData)
	.put(dbCreateController.getClientByUrl)

router
	.route("/admin")
	.get(supreProtect, dbCreateController.getClients)
	.post(userValidationRules('login'), superValidate, dbCreateController.admin)
	.put(supreProtect, userValidationRules('editClientUser'), superValidate, dbCreateController.clientUpdate)
	.delete(supreProtect, dbCreateController.clientDelete);

router
	.route("/admin/profile")
	.get(supreProtect, dbCreateController.getSuperAdminDetail)
	.post(supreProtect, userValidationRules("editAdminProfile"), superValidate, dbCreateController.editAdminProfile)
	.put(supreProtect, userValidationRules("editAdminProfileIMG"), superValidate, dbCreateController.editAdminProfileIMG);

router
	.route("/admin/country")
	.get(dbCreateController.getCountry)
	.post(supreProtect, dbCreateController.storeCountry)
	.put(supreProtect, dbCreateController.editCountry)
	.delete(supreProtect, dbCreateController.deleteCountry);

router
	.route("/admin/state")
	.get(dbCreateController.getState)
	.post(supreProtect, dbCreateController.storeStates)
	.put(supreProtect, dbCreateController.editStates)
	.delete(supreProtect, dbCreateController.deleteStates);

router
	.route("/admin/state/available")
	.get(dbCreateController.getAvailableStates);
router
	.route("/admin/state/list")
	.get(dbCreateController.getAllStatesWithAvailability);
router
	.route("/admin/state/toggle-availability")
	.put(adminOrSuperProtect, dbCreateController.toggleStateAvailability);

router
	.route("/admin/city/by-state")
	.get(dbCreateController.getCitiesByState);

router
	.route("/admin/city")
	.get(dbCreateController.getCityAndDistrict)
	.post(supreProtect, dbCreateController.storeCity)
	.put(supreProtect, dbCreateController.editCity)
	.delete(supreProtect, dbCreateController.deleteCity);


router
	.route("/admin/permission")
	.post(supreProtect, dbCreateController.givePermission)
	.get(supreProtect, dbCreateController.ViewPermissionOfClients)

router
	.route("/admin/menu")
	.get(dbCreateController.viewMenu)
	.post(dbCreateController.addMenuInSuperAdmin)
	.put(dbCreateController.updateMenu)

router
	.route("/admin/menu/icon")
	.post(dbCreateController.addMenuIconInSuperAdmin)
router
	.route("/admin/platform")
	.get(supreProtect, dbCreateController.getPlatformPermissionByAdmin)

router
	.route("/admin/url").post(dbCreateController.getClientByUrl)
router
	.route("/admin/getClientDataByUrl").post(resolver, dbCreateController.getClientDataByUrl)

router
	.route("/admin/userplatformhistory").get(dbCreateController.userplatformhistory)

router
	.route("/checkToken").get(dbCreateController.checkToken)

module.exports = router;
