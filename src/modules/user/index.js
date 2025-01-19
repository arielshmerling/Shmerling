const express = require("express");
const userController = require("./controller");
const router = express.Router();

router.get("/", userController.showLoginPage);
router.get("/login", userController.showLoginPage);
router.post("/login", userController.login);
router.get("/logout", userController.logout);


router.get("/register", userController.showRegistrationPage);
router.post("/register", userController.register);


module.exports = router;