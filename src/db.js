const mongoose = require("mongoose");
const PaymentTransaction = require("./models/PaymentTransaction");
const Order = require("./models/Order");

const INITIAL_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
let connectionListenersRegistered = false;

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const registerConnectionListeners = () => {
  if (connectionListenersRegistered) {
    return;
  }

  connectionListenersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.error("❌ MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✅ MongoDB reconnected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("❌ MongoDB runtime error");
    console.error(error.message);
  });
};

const connectDB = async () => {
  registerConnectionListeners();

  for (let attempt = 1; attempt <= INITIAL_CONNECT_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 10,               // keep up to 10 connections open
        minPoolSize: 2,                // keep a small warm pool ready
        socketTimeoutMS: 45000,        // close idle sockets after 45s
        serverSelectionTimeoutMS: 10000, // allow slower VPS startups before failing
        heartbeatFrequencyMS: 10000,   // check server health every 10s
      });
      console.log("✅ MongoDB connected");
      await repairPaymentIndexes();
      return;
    } catch (error) {
      console.error(
        `❌ MongoDB connection failed (attempt ${attempt}/${INITIAL_CONNECT_RETRIES})`
      );
      console.error(error.message);

      if (attempt === INITIAL_CONNECT_RETRIES) {
        throw error;
      }

      console.log(`⏳ Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
      await wait(RETRY_DELAY_MS);
    }
  }
};

module.exports = connectDB;
