const express = require("express");
const router = express.Router();

const {
  addProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
} = require("../controllers/productController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const uploadProductImages = require("../middlewares/uploadMiddleware");

// ✅ CORRECT ORDER: protect → admin → multer → controller
router.post(
  "/add",
  protect,
  adminOnly,
  uploadProductImages,
  addProduct
);

router.put("/update/:id", protect, adminOnly, uploadProductImages, updateProduct);
router.delete("/delete/:id", protect, adminOnly, deleteProduct);

router.get("/category/:category", getProductsByCategory);
router.get("/", getAllProducts);
router.get("/:id", getSingleProduct);

module.exports = router;
