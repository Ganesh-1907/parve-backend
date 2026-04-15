const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
  {
    transactionRef: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    address: {
      type: String,
      required: true,
      trim: true,
    },

    subtotal: {
      type: Number,
      required: true,
    },

    shippingCost: {
      type: Number,
      required: true,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    receipt: {
      type: String,
      required: true,
      unique: true,
    },

    razorpayOrderId: {
      type: String,
    },

    razorpayPaymentId: {
      type: String,
    },

    status: {
      type: String,
      enum: [
        "created",
        "payment_authorized",
        "payment_captured",
        "completed",
        "failed",
        "abandoned",
      ],
      default: "created",
    },

    paymentStatus: {
      type: String,
      default: "created",
    },

    signatureVerified: {
      type: Boolean,
      default: false,
    },

    paymentCapturedAt: {
      type: Date,
      default: null,
    },

    orderCreatedAt: {
      type: Date,
      default: null,
    },

    lastReconciledAt: {
      type: Date,
      default: null,
    },

    lastWebhookEvent: {
      type: String,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentTransactionSchema.index({ user: 1, createdAt: -1 });
paymentTransactionSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayOrderId: { $type: "string" } },
  }
);
paymentTransactionSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
  }
);

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
