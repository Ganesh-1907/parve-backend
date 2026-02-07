const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Total Orders
    const totalOrders = await Order.countDocuments();

    // 2. Total Revenue (only from non-cancelled orders usually, but let's see user req)
    // We'll exclude 'cancelled' status for revenue calculation
    const revenueAggregation = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
    ]);
    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

    // 3. Orders by Status (Pie Chart)
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // 4. Products by Category (Pie Chart)
    const productsByCategory = await Product.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    // 5. Total Users (Optional but good for dashboard)
    const totalUsers = await User.countDocuments({ role: "user" });

    res.status(200).json({
      totalOrders,
      totalRevenue,
      totalUsers,
      ordersByStatus: ordersByStatus.map(item => ({ name: item._id, value: item.count })),
      productsByCategory: productsByCategory.map(item => ({ name: item._id, value: item.count })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching dashboard stats" });
  }
};
