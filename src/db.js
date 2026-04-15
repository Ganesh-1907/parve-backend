const mongoose = require("mongoose");
const PaymentTransaction = require("./models/PaymentTransaction");
const Order = require("./models/Order");

const repairPaymentIndexes = async () => {
  // Older documents may have stored null in these fields, which clashes with unique indexes.
  await Promise.all([
    PaymentTransaction.updateMany(
      { razorpayPaymentId: null },
      { $unset: { razorpayPaymentId: "" } },
      { strict: false }
    ),
    PaymentTransaction.updateMany(
      { razorpayOrderId: null },
      { $unset: { razorpayOrderId: "" } },
      { strict: false }
    ),
    Order.updateMany(
      { razorpayPaymentId: null },
      { $unset: { razorpayPaymentId: "" } },
      { strict: false }
    ),
    Order.updateMany(
      { razorpayOrderId: null },
      { $unset: { razorpayOrderId: "" } },
      { strict: false }
    ),
  ]);

  await Promise.all([PaymentTransaction.syncIndexes(), Order.syncIndexes()]);
  console.log("✅ Payment indexes repaired");
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,          // keep up to 10 connections open (avoids reconnect delay)
      minPoolSize: 2,           // always keep 2 warm connections ready
      socketTimeoutMS: 45000,   // close idle sockets after 45s
      serverSelectionTimeoutMS: 5000, // fail fast if mongo is down
      heartbeatFrequencyMS: 10000,    // check server health every 10s
    });
    console.log("✅ MongoDB connected");
    await repairPaymentIndexes();
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
