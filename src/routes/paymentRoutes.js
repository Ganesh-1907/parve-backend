const express = require("express");
const router = express.Router();

const {
  createRazorpayOrder,
  verifyPayment,
  handleRazorpayWebhook,
  reconcilePendingPayments,
  getRazorpayKey,
} = require("../controllers/paymentController");

const { protect } = require("../middlewares/authMiddleware");

// Get Razorpay key
router.get("/key", getRazorpayKey);
router.post("/webhook", handleRazorpayWebhook);

// Create Razorpay order (requires auth)
router.post("/create-order", protect, createRazorpayOrder);

// Verify payment and create order (requires auth)
router.post("/verify", protect, verifyPayment);
router.post("/reconcile-pending", protect, reconcilePendingPayments);

module.exports = router;
