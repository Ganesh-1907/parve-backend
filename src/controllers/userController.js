const User = require("../models/User");
const Product = require("../models/Product");

/* ================= DISCOUNT HELPER ================= */
const calculateDiscountedPrice = (product) => {
  const now = new Date();
  const { discount, price } = product;

  if (discount?.isYearly && discount?.percentage > 0) {
    return price - (price * discount.percentage) / 100;
  }

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

/* ================= GET CART ================= */
exports.getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("cart.productId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter out invalid products and add finalPrice
    const cartItems = user.cart
      .filter((item) => item.productId && item.productId.isActive)
      .map((item) => ({
        product: {
          ...item.productId._doc,
          finalPrice: calculateDiscountedPrice(item.productId),
        },
        quantity: item.quantity,
      }));

    res.status(200).json({ cart: cartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADD TO CART ================= */
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(req.user.userId);

    const existingItem = user.cart.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cart.push({ productId, quantity });
    }

    // Save and populate in one step
    await user.save();
    await user.populate("cart.productId");

    const cartItems = user.cart
      .filter((item) => item.productId && item.productId.isActive)
      .map((item) => ({
        product: { ...item.productId._doc, finalPrice: calculateDiscountedPrice(item.productId) },
        quantity: item.quantity,
      }));

    res.status(200).json({ message: "Added to cart", cart: cartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE CART ITEM ================= */
exports.updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Valid quantity is required" });
    }

    const user = await User.findById(req.user.userId);

    const cartItem = user.cart.find(
      (item) => item.productId.toString() === productId
    );

    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    cartItem.quantity = quantity;
    await user.save();
    await user.populate("cart.productId");

    const cartItems = user.cart
      .filter((item) => item.productId && item.productId.isActive)
      .map((item) => ({
        product: { ...item.productId._doc, finalPrice: calculateDiscountedPrice(item.productId) },
        quantity: item.quantity,
      }));

    res.status(200).json({ message: "Cart updated", cart: cartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= REMOVE FROM CART ================= */
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.userId);

    user.cart = user.cart.filter(
      (item) => item.productId.toString() !== productId
    );

    await user.save();
    await user.populate("cart.productId");

    const cartItems = user.cart
      .filter((item) => item.productId && item.productId.isActive)
      .map((item) => ({
        product: { ...item.productId._doc, finalPrice: calculateDiscountedPrice(item.productId) },
        quantity: item.quantity,
      }));

    res.status(200).json({ message: "Removed from cart", cart: cartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CLEAR CART ================= */
exports.clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.cart = [];
    await user.save();

    res.status(200).json({ message: "Cart cleared", cart: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET WISHLIST ================= */
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("wishlist");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter active products and add finalPrice
    const wishlistItems = user.wishlist
      .filter((product) => product && product.isActive)
      .map((product) => ({
        ...product._doc,
        finalPrice: calculateDiscountedPrice(product),
      }));

    res.status(200).json({ wishlist: wishlistItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADD TO WISHLIST ================= */
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(req.user.userId);

    if (user.wishlist && user.wishlist.some(id => id && id.toString() === productId)) {
      return res.status(400).json({ message: "Already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();
    await user.populate("wishlist");

    const wishlistItems = user.wishlist
      .filter((p) => p && p.isActive)
      .map((p) => ({ ...p._doc, finalPrice: calculateDiscountedPrice(p) }));

    res.status(200).json({ message: "Added to wishlist", wishlist: wishlistItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= REMOVE FROM WISHLIST ================= */
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.userId);

    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== productId
    );

    await user.save();
    await user.populate("wishlist");

    const wishlistItems = user.wishlist
      .filter((p) => p && p.isActive)
      .map((p) => ({ ...p._doc, finalPrice: calculateDiscountedPrice(p) }));

    res.status(200).json({ message: "Removed from wishlist", wishlist: wishlistItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PROFILE ================= */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
