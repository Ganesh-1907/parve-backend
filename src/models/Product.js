const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    stock: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      enum: ["facewash", "serums", "creams"],
      required: true,
    },

    unit: {
      type: String,
      required: true,
    },

    // ✅ MULTIPLE IMAGES (1–5)
    images: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return value.length >= 1 && value.length <= 5;
        },
        message: "You must upload between 1 and 5 images",
      },
    },

    discount: {
      percentage: {
        type: Number,
        default: 0,
      },
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      isYearly: {
        type: Boolean,
        default: false,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
