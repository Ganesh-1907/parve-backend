const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const PaymentTransaction = require("../models/PaymentTransaction");
const { sendOrderConfirmation, sendAdminNotification } = require("../services/emailService");

const SUCCESS_PAYMENT_STATUSES = new Set(["authorized", "captured"]);
const PENDING_TRANSACTION_STATUSES = ["created", "payment_authorized", "payment_captured"];

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

const getTransactionStatusFromPayment = (paymentStatus) => {
  if (paymentStatus === "captured") return "payment_captured";
  if (paymentStatus === "authorized") return "payment_authorized";
  return "created";
};

const populateOrderById = async (orderId) =>
  Order.findById(orderId)
    .populate("items.product", "productName images")
    .populate("user", "name email phone");

const loadOrderForTransaction = async (transaction) => {
  if (transaction.order) {
    const linkedOrder = await populateOrderById(transaction.order);
    if (linkedOrder) {
      return linkedOrder;
    }
  }

  if (transaction.razorpayPaymentId) {
    const existingByPayment = await Order.findOne({
      razorpayPaymentId: transaction.razorpayPaymentId,
    });
    if (existingByPayment) {
      return populateOrderById(existingByPayment._id);
    }
  }

  if (transaction.razorpayOrderId) {
    const existingByOrder = await Order.findOne({
      razorpayOrderId: transaction.razorpayOrderId,
    });
    if (existingByOrder) {
      return populateOrderById(existingByOrder._id);
    }
  }

  return null;
};

const ensureOrderNotifications = async (order, user) => {
  if (!user) {
    return order;
  }

  const updates = {};

  if (!order.customerEmailSentAt && user.email) {
    const customerEmailSent = await sendOrderConfirmation(order, user);
    if (customerEmailSent) {
      updates.customerEmailSentAt = new Date();
    }
  }

  if (!order.adminNotificationSentAt) {
    const adminEmailSent = await sendAdminNotification(order, user);
    if (adminEmailSent) {
      updates.adminNotificationSentAt = new Date();
    }
  }

  if (Object.keys(updates).length === 0) {
    return order;
  }

  await Order.findByIdAndUpdate(order._id, { $set: updates });
  return populateOrderById(order._id);
};

const syncOrderPostCreation = async (transaction) => {
  const tasks = [
    User.findByIdAndUpdate(transaction.user, { cart: [] }).catch((error) => {
      console.error("Failed to clear cart after payment:", error.message);
    }),
  ];

  for (const item of transaction.items) {
    tasks.push(
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      }).catch((error) => {
        console.error(`Failed to update stock for ${item.product}:`, error.message);
      })
    );
  }

  await Promise.all(tasks);
};

const finalizeTransactionOrder = async (transaction, options = {}) => {
  const {
    razorpayOrderId = transaction.razorpayOrderId,
    razorpayPaymentId = transaction.razorpayPaymentId,
    paymentStatus = transaction.paymentStatus || "captured",
    paymentCapturedAt = transaction.paymentCapturedAt || new Date(),
    signatureVerified = transaction.signatureVerified,
  } = options;

  let existingOrder = await loadOrderForTransaction(transaction);
  let createdNewOrder = false;

  if (!existingOrder) {
    const orderId = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    try {
      const order = await Order.create({
        orderId,
        user: transaction.user,
        items: transaction.items,
        totalAmount: transaction.totalAmount,
        address: transaction.address,
        paymentMethod: "razorpay",
        paymentStatus: "paid",
        razorpayOrderId,
        razorpayPaymentId,
        status: "processing",
        paymentConfirmedAt: paymentCapturedAt,
      });

      existingOrder = await populateOrderById(order._id);
      createdNewOrder = true;
    } catch (error) {
      if (error?.code === 11000) {
        existingOrder = await Order.findOne({
          $or: [
            razorpayPaymentId ? { razorpayPaymentId } : null,
            razorpayOrderId ? { razorpayOrderId } : null,
          ].filter(Boolean),
        });

        if (!existingOrder) {
          throw error;
        }

        existingOrder = await populateOrderById(existingOrder._id);
      } else {
        throw error;
      }
    }
  }

  const transactionUpdates = {
    order: existingOrder._id,
    razorpayOrderId,
    razorpayPaymentId,
    paymentStatus,
    signatureVerified,
    paymentCapturedAt,
    orderCreatedAt: existingOrder.createdAt || new Date(),
    status: "completed",
    failureReason: null,
    lastReconciledAt: new Date(),
  };

  await PaymentTransaction.findByIdAndUpdate(transaction._id, {
    $set: transactionUpdates,
  });

  if (createdNewOrder) {
    await syncOrderPostCreation(transaction);
  }

  const orderUser =
    existingOrder.user && typeof existingOrder.user === "object" && existingOrder.user.email
      ? existingOrder.user
      : await User.findById(existingOrder.user);

  return ensureOrderNotifications(existingOrder, orderUser);
};

const reconcileTransactionWithRazorpay = async (transaction) => {
  if (!transaction.razorpayOrderId) {
    return null;
  }

  const paymentsResponse = await getRazorpay().orders.fetchPayments(transaction.razorpayOrderId);
  const payments = Array.isArray(paymentsResponse?.items) ? paymentsResponse.items : [];
  const successfulPayment = payments.find((payment) => SUCCESS_PAYMENT_STATUSES.has(payment.status));

  await PaymentTransaction.findByIdAndUpdate(transaction._id, {
    $set: { lastReconciledAt: new Date() },
  });

  if (!successfulPayment) {
    return null;
  }

  await PaymentTransaction.findByIdAndUpdate(transaction._id, {
    $set: {
      razorpayPaymentId: successfulPayment.id,
      paymentStatus: successfulPayment.status,
      paymentCapturedAt: successfulPayment.captured_at
        ? new Date(successfulPayment.captured_at * 1000)
        : new Date(),
      status: getTransactionStatusFromPayment(successfulPayment.status),
      failureReason: null,
      lastReconciledAt: new Date(),
    },
  });

  const latestTransaction = await PaymentTransaction.findById(transaction._id);
  return finalizeTransactionOrder(latestTransaction, {
    razorpayPaymentId: successfulPayment.id,
    paymentStatus: successfulPayment.status,
    paymentCapturedAt: successfulPayment.captured_at
      ? new Date(successfulPayment.captured_at * 1000)
      : new Date(),
    signatureVerified: latestTransaction.signatureVerified,
  });
};

const retryMissingOrderNotificationsForUser = async (userId) => {
  const recentPaidOrders = await Order.find({
    user: userId,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    $or: [{ customerEmailSentAt: null }, { adminNotificationSentAt: null }],
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("items.product", "productName images")
    .populate("user", "name email phone");

  let retriedCount = 0;

  for (const order of recentPaidOrders) {
    const beforeCustomerSentAt = order.customerEmailSentAt;
    const beforeAdminSentAt = order.adminNotificationSentAt;
    const refreshedOrder = await ensureOrderNotifications(order, order.user);

    if (
      (!beforeCustomerSentAt && refreshedOrder.customerEmailSentAt) ||
      (!beforeAdminSentAt && refreshedOrder.adminNotificationSentAt)
    ) {
      retriedCount += 1;
    }
  }

  return retriedCount;
};

// CREATE RAZORPAY ORDER
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { items, address } = req.body;
    const userId = req.user.userId;

    if (!items || items.length === 0 || !address) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    let totalAmount = 0;
    const orderItems = [];
    const transactionRef = "PAY-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const receipt = `receipt_${Date.now()}_${transactionRef}`;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for: ${product.productName}` });
      }

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

    const shippingCost = totalAmount >= 500 ? 0 : 50;
    const finalAmount = totalAmount + shippingCost;

    const razorpayOrder = await getRazorpay().orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt,
      notes: {
        userId,
        address,
        transactionRef,
      },
    });

    const transaction = await PaymentTransaction.create({
      transactionRef,
      user: userId,
      items: orderItems,
      address,
      subtotal: totalAmount,
      shippingCost,
      totalAmount: finalAmount,
      currency: "INR",
      receipt,
      razorpayOrderId: razorpayOrder.id,
      status: "created",
      paymentStatus: "created",
    });

    const user = await User.findById(userId);

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID,
      amount: finalAmount,
      subtotal: totalAmount,
      shippingCost,
      transactionId: transaction._id,
      transactionRef,
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

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature.",
      });
    }

    let transaction = await PaymentTransaction.findOne({
      razorpayOrderId: razorpay_order_id,
      user: userId,
    });

    if (!transaction) {
      const transactionRef = "PAY-" + crypto.randomBytes(5).toString("hex").toUpperCase();
      transaction = await PaymentTransaction.create({
        transactionRef,
        user: userId,
        items: orderItems || [],
        address,
        subtotal: totalAmount,
        shippingCost: 0,
        totalAmount,
        currency: "INR",
        receipt: `receipt_fallback_${Date.now()}_${transactionRef}`,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "payment_captured",
        paymentStatus: "captured",
        signatureVerified: true,
        paymentCapturedAt: new Date(),
      });
    } else {
      await PaymentTransaction.findByIdAndUpdate(transaction._id, {
        $set: {
          razorpayPaymentId: razorpay_payment_id,
          paymentStatus: "captured",
          signatureVerified: true,
          paymentCapturedAt: new Date(),
          status: "payment_captured",
          failureReason: null,
          lastReconciledAt: new Date(),
        },
      });
      transaction = await PaymentTransaction.findById(transaction._id);
    }

    const order = await finalizeTransactionOrder(transaction, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentStatus: "captured",
      paymentCapturedAt: new Date(),
      signatureVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Payment verified and order placed successfully!",
      order,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

exports.handleRazorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Razorpay webhook secret is not configured.");
    return res.status(503).json({ message: "Webhook secret not configured" });
  }

  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody;

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!signature || signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity || null;
    const orderEntity = req.body?.payload?.order?.entity || null;
    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id || null;
    const razorpayPaymentId = paymentEntity?.id || null;

    if (!razorpayOrderId) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const transaction = await PaymentTransaction.findOne({ razorpayOrderId });

    if (!transaction) {
      console.warn(`Received webhook for unknown Razorpay order ${razorpayOrderId}`);
      return res.status(200).json({ success: true, ignored: true });
    }

    if (event === "payment.failed") {
      await PaymentTransaction.findByIdAndUpdate(transaction._id, {
        $set: {
          status: "failed",
          paymentStatus: paymentEntity?.status || "failed",
          razorpayPaymentId,
          lastWebhookEvent: event,
          failureReason: paymentEntity?.error_description || "Payment failed",
          lastReconciledAt: new Date(),
        },
      });

      return res.status(200).json({ success: true });
    }

    if (event === "payment.authorized" || event === "payment.captured" || event === "order.paid") {
      await PaymentTransaction.findByIdAndUpdate(transaction._id, {
        $set: {
          razorpayPaymentId,
          paymentStatus: paymentEntity?.status || "captured",
          paymentCapturedAt: paymentEntity?.captured_at
            ? new Date(paymentEntity.captured_at * 1000)
            : new Date(),
          status: getTransactionStatusFromPayment(paymentEntity?.status || "captured"),
          lastWebhookEvent: event,
          failureReason: null,
          lastReconciledAt: new Date(),
        },
      });

      const latestTransaction = await PaymentTransaction.findById(transaction._id);
      await finalizeTransactionOrder(latestTransaction, {
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: paymentEntity?.status || "captured",
        paymentCapturedAt: paymentEntity?.captured_at
          ? new Date(paymentEntity.captured_at * 1000)
          : new Date(),
        signatureVerified: latestTransaction.signatureVerified,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

exports.reconcilePendingPayments = async (req, res) => {
  try {
    const userId = req.user.userId;

    const pendingTransactions = await PaymentTransaction.find({
      user: userId,
      order: null,
      status: { $in: PENDING_TRANSACTION_STATUSES },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(10);

    const recoveredOrders = [];

    for (const transaction of pendingTransactions) {
      try {
        const order = await reconcileTransactionWithRazorpay(transaction);
        if (order) {
          recoveredOrders.push(order);
        }
      } catch (error) {
        console.error(
          `Failed to reconcile transaction ${transaction.transactionRef}:`,
          error.message
        );
      }
    }

    const retriedNotificationCount = await retryMissingOrderNotificationsForUser(userId);

    res.status(200).json({
      success: true,
      checked: pendingTransactions.length,
      recoveredCount: recoveredOrders.length,
      retriedNotificationCount,
      recoveredOrders,
    });
  } catch (error) {
    console.error("Pending payment reconciliation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reconcile pending payments",
      error: error.message,
    });
  }
};

// GET RAZORPAY KEY (for frontend)
exports.getRazorpayKey = async (req, res) => {
  res.status(200).json({
    key: process.env.RAZORPAY_KEY_ID,
  });
};
