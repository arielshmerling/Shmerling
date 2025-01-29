const express = require("express");

const { requireLogin } = require("./../../utils.js");
const gameManagerController = require("./controller");
const router = express.Router();
router.get("/lobby", requireLogin, gameManagerController.showLobby);
router.get("/list", requireLogin, gameManagerController.showList);
router.delete("/list/:id", requireLogin, gameManagerController.delete);
router.get("/generateState", requireLogin, gameManagerController.generateState);
module.exports = router;