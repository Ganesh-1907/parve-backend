const Product = require("../models/Product");

/* ================= DISCOUNT HELPER ================= */
const calculateDiscountedPrice = (product) => {
  const now = new Date();
  const { discount, price } = product;

  // Yearly discount
  if (discount?.isYearly && discount?.percentage > 0) {
    return price - (price * discount.percentage) / 100;
  }

  // Date based discount
  if (
    discount?.startDate &&
    discount?.endDate &&
    discount?.percentage > 0 &&
    now >= discount.startDate &&
    now <= discount.endDate
  ) {
    return price - (price * discount.percentage) / 100;
  }

  return price;
};

/* ================= ADD PRODUCT (ADMIN) ================= */
exports.addProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      offerTag,
      price,
      stock,
      category,
      unit,
      discountPercentage,
      discountStartDate,
      discountEndDate,
      isYearlyDiscount,
    } = req.body;

    if (!productName || !description || !price || !stock || !category || !unit) {
      return res
        .status(400)
        .json({ message: "All required fields are mandatory" });
    }

    // ✅ IMAGES FROM MULTER
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one product image is required" });
    }

    // Convert files to image paths
    const images = req.files.map(
      (file) => `/uploads/products/${file.filename}`
    );

    const normalizedOfferTag = offerTag?.trim();
    const productData = {
      productName,
      description,
      price,
      stock,
      category,
      unit,
      images, // ✅ SAVED HERE
      discount: {
        percentage: discountPercentage || 0,
        startDate: isYearlyDiscount === "true" ? null : discountStartDate || null,
        endDate: isYearlyDiscount === "true" ? null : discountEndDate || null,
        isYearly: isYearlyDiscount === "true",
      },
    };

    if (normalizedOfferTag) {
      productData.offerTag = normalizedOfferTag;
    }

    const product = await Product.create(productData);

    res.status(201).json({
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/* ================= GET ALL PRODUCTS ================= */
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });

    const updatedProducts = products.map((product) => ({
      ...product._doc,
      finalPrice: calculateDiscountedPrice(product),
    }));

    res.status(200).json({
      count: updatedProducts.length,
      products: updatedProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET SINGLE PRODUCT ================= */
exports.getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      ...product._doc,
      finalPrice: calculateDiscountedPrice(product),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PRODUCT (ADMIN) ================= */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      productName,
      description,
      offerTag,
      price,
      stock,
      category,
      unit,
      discountPercentage,
      discountStartDate,
      discountEndDate,
      isYearlyDiscount,
    } = req.body;

    const normalizedOfferTag = offerTag?.trim();
    const updateData = {
      productName,
      description,
      price,
      stock,
      category,
      unit,
      discount: {
        percentage: discountPercentage || 0,
        startDate: isYearlyDiscount === "true" ? null : discountStartDate || null,
        endDate: isYearlyDiscount === "true" ? null : discountEndDate || null,
        isYearly: isYearlyDiscount === "true",
      },
    };

    if (normalizedOfferTag) {
      updateData.offerTag = normalizedOfferTag;
    }

    // If new images are uploaded, update them
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(
        (file) => `/uploads/products/${file.filename}`
      );
    }

    const updateOperation = normalizedOfferTag
      ? { $set: updateData }
      : { $set: updateData, $unset: { offerTag: 1 } };

    const updatedProduct = await Product.findByIdAndUpdate(id, updateOperation, {
      new: true,
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DELETE PRODUCT (SOFT DELETE) ================= */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET PRODUCTS BY CATEGORY ================= */
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const products = await Product.find({
      category,
      isActive: true,
    });

    const updatedProducts = products.map((product) => ({
      ...product._doc,
      finalPrice: calculateDiscountedPrice(product),
    }));

    res.status(200).json({
      count: updatedProducts.length,
      products: updatedProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
