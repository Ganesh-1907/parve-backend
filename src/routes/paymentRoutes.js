const express = require("express");
const router = express.Router();

const {
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKey,
} = require("../controllers/paymentController");

const { protect } = require("../middlewares/authMiddleware");

// Get Razorpay key
router.get("/key", getRazorpayKey);

// Create Razorpay order (requires auth)
router.post("/create-order", protect, createRazorpayOrder);

// Verify payment and create order (requires auth)
router.post("/verify", protect, verifyPayment);

module.exports = router;
