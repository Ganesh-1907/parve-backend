const express = require("express");
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  updateOrderStatus,
  getMyOrders,
} = require("../controllers/orderController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

router.post("/checkout", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/admin", protect, adminOnly, getAllOrders);
router.put("/admin/status/:id", protect, adminOnly, updateOrderStatus);


module.exports = router;
