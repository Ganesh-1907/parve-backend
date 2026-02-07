const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  sendOtp,
  verifyOtp,
  resetPassword,
  getMe,
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.get("/me", getMe);


module.exports = router;
