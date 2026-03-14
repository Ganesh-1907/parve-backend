const Review = require("../models/Review");

/* ================= ADD REVIEW (USER) ================= */
exports.addReview = async (req, res) => {
  try {
    const { rating, comment, productType } = req.body;
    const { _id: userId, name: userName, email: userEmail } = req.user;

    if (!rating || !comment || !productType) {
      return res.status(400).json({ message: "Rating, comment, and product type are required" });
    }

    // Process images if uploaded
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/reviews/${file.filename}`);
    }

    const review = await Review.create({
      userId,
      userName,
      userEmail,
      rating,
      comment,
      productType,
      images,
    });

    res.status(201).json({
      success: true,
      message: "Review submitted successfully! It will be visible after admin approval.",
      review,
    });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET PUBLIC REVIEWS ================= */
exports.getPublicReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ status: "public" }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("Get public reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ADMIN REVIEWS ================= */
exports.getAdminReviews = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("Get admin reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE REVIEW STATUS (ADMIN) ================= */
exports.updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["public", "private"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'public' or 'private'." });
    }

    const review = await Review.findByIdAndUpdate(id, { status }, { new: true });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({
      success: true,
      message: `Review marked as ${status}`,
      review,
    });
  } catch (error) {
    console.error("Update review status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET REVIEW BY ID (ADMIN) ================= */
exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Get review by id error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
