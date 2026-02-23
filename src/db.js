const mongoose = require("mongoose");

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
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
