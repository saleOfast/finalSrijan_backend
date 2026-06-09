//importing modules
const express = require("express");
const fieldController = require("../controllers/fieldController");
const {resolver} = require("../connectionResolver/resolver");
const {protect , rolePermission ,} = require("../middleware/authController")
const router = express.Router();


//admin routes
router
    .route("/")
        .post(resolver,  fieldController.storeField)
        .get(resolver,  fieldController.getField)
        .delete(resolver,  fieldController.deleteField)

module.exports = router;