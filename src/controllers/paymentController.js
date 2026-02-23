const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { sendOrderConfirmation, sendAdminNotification } = require("../services/emailService");

// Lazy-initialize Razorpay so env vars are guaranteed to be loaded first
let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay keys are not set in environment variables!");
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// CREATE RAZORPAY ORDER
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { items, address } = req.body;
    const userId = req.user.userId;

    if (!items || items.length === 0 || !address) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for: ${product.productName}` });
      }

      // Calculate discounted price
      let itemPrice = product.price;
      const now = new Date();
      
      if (product.discount?.isYearly && product.discount?.percentage > 0) {
        itemPrice = product.price - (product.price * product.discount.percentage) / 100;
      } else if (
        product.discount?.startDate &&
        product.discount?.endDate &&
        product.discount?.percentage > 0 &&
        now >= new Date(product.discount.startDate) &&
        now <= new Date(product.discount.endDate)
      ) {
        itemPrice = product.price - (product.price * product.discount.percentage) / 100;
      }

      totalAmount += itemPrice * item.quantity;
      orderItems.push({
        product: item.productId,
        quantity: item.quantity,
        price: Math.round(itemPrice),
      });
    }

    totalAmount = Math.round(totalAmount);

    // Apply shipping cost (matches frontend: free above ₹500, else ₹50)
    const shippingCost = totalAmount >= 500 ? 0 : 50;
    const finalAmount = totalAmount + shippingCost;

    // Create Razorpay order
    const razorpayOrder = await getRazorpay().orders.create({
      amount: finalAmount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: userId,
        address: address,
      },
    });

    // Get user details
    const user = await User.findById(userId);

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID,
      amount: finalAmount,
      subtotal: totalAmount,
      shippingCost,
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      orderItems,
      address,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ message: "Failed to create payment order", error: error.message });
  }
};

// VERIFY PAYMENT AND CREATE ORDER
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderItems,
      address,
      totalAmount,
    } = req.body;
    const userId = req.user.userId;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed. Invalid signature." 
      });
    }

    // Create order in database
    const orderId = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const order = await Order.create({
      orderId,
      user: userId,
      items: orderItems,
      totalAmount,
      address,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      status: "processing",
    });

    // Populate product details for emails
    const populatedOrder = await Order.findById(order._id).populate("items.product", "productName");

    // Get user details
    const user = await User.findById(userId);

    // Clear user's cart after successful order
    await User.findByIdAndUpdate(userId, { cart: [] });

    // UPDATE STOCK
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    // Send emails (async, don't wait)
    if (user) {
      sendOrderConfirmation(populatedOrder, user);
      sendAdminNotification(populatedOrder, user);
    }

    res.status(201).json({
      success: true,
      message: "Payment verified and order placed successfully!",
      order: populatedOrder,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Payment verification failed", 
      error: error.message 
    });
  }
};

// GET RAZORPAY KEY (for frontend)
exports.getRazorpayKey = async (req, res) => {
  res.status(200).json({
    key: process.env.RAZORPAY_KEY_ID,
  });
};
