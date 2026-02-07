const express = require("express");
const router = express.Router();

const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  updateProfile,
} = require("../controllers/userController");

const { protect } = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(protect);

// Cart routes
router.get("/cart", getCart);
router.post("/cart", addToCart);
router.put("/cart/:productId", updateCartItem);
router.delete("/cart/:productId", removeFromCart);
router.delete("/cart", clearCart);

// Wishlist routes
router.get("/wishlist", getWishlist);
router.post("/wishlist", addToWishlist);
router.delete("/wishlist/:productId", removeFromWishlist);

// Profile routes
router.put("/profile", updateProfile);

module.exports = router;
