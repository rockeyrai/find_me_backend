const express = require("express");
const { googleLogin, getMe, logout } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/google", googleLogin);
router.get("/me", protect, getMe);
router.post("/logout", logout);

module.exports = router;
