const express = require("express");
const cors = require("cors");

const supabase = require("./config/supabase");

const catalogRoutes = require("./routes/catalogRoutes");


const productRoutes =
  require("./routes/productRoutes");

const exportRoutes =
  require("./routes/exportRoutes");

const cronRoutes =
  require("./routes/cronRoutes");

const app = express();


// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());

app.use(express.json());


// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "INE Price Tracker Backend is running"
  });
});


// ============================================
// DATABASE TEST
// ============================================

app.get("/api/test-db", async (req, res) => {
  const {
    data,
    error
  } = await supabase
    .from("tracked_products")
    .select("id")
    .limit(1);

  if (error) {
    return res.status(500).json({
      success: false,
      message:
        "Database connection failed",
      error: error.message
    });
  }

  res.json({
    success: true,
    message:
      "Supabase database connection is working",
    data
  });
});


// ============================================
// PRODUCT ROUTES
// ============================================

app.use(
  "/api/products",
  productRoutes
);


app.use("/api/catalog", catalogRoutes);

// ============================================
// EXPORT ROUTES
// ============================================

app.use(
  "/api/products",
  exportRoutes
);


// ============================================
// CRON ROUTES
// ============================================

app.use(
  "/api/cron",
  cronRoutes
);


// ============================================
// 404
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});


module.exports = app;