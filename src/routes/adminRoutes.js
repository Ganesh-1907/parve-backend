const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/dashboardController");

// Ideally this should be protected by admin middleware
// router.get("/dashboard", protect, admin, getDashboardStats);
router.get("/dashboard", getDashboardStats);

module.exports = router;
