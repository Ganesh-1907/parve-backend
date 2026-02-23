const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db");
const cors = require("cors");

// Always resolve .env from backend root regardless of where server is started from
dotenv.config({ path: path.resolve(__dirname, "../", ".env") });

// Warn early if critical env vars are missing
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️  WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in .env!");
}

const app = express();

/* ✅ FIXED CORS */
app.use(
  cors({
    origin: true, // allow all origins (dev only)
    credentials: true,
  })
);

app.use(express.json());

// DB
connectDB();

// Routes

app.use("/uploads", express.static("uploads"));


app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

app.get("/", (req, res) => {
  res.send("Server running & DB connected 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
