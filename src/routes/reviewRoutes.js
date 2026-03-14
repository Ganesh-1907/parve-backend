const express = require("express");
const router = express.Router();
const {
  addReview,
  getPublicReviews,
  getAdminReviews,
  getReviewById,
  updateReviewStatus,
} = require("../controllers/reviewController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const uploadReviewImages = require("../middlewares/reviewMiddleware");

// Public routes
router.get("/", getPublicReviews);

// Protected routes (User)
router.post("/add", protect, uploadReviewImages, addReview);

// Admin routes
router.get("/admin", protect, adminOnly, getAdminReviews);
router.get("/:id", protect, adminOnly, getReviewById);
router.put("/status/:id", protect, adminOnly, updateReviewStatus);

module.exports = router;
