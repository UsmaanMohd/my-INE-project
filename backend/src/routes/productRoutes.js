const express = require("express");

const {
  getTrackedProducts,
  getTrackedProduct,
  addTrackedProduct,
  getPriceHistory,
  getLatestPrice,
  getScrapeLogs,
  manualScrape
} = require("../controllers/productController");

const router = express.Router();


// ============================================
// GET ALL PRODUCTS
// GET /api/products
// ============================================

router.get(
  "/",
  getTrackedProducts
);


// ============================================
// ADD PRODUCT
// POST /api/products
// ============================================

router.post(
  "/",
  addTrackedProduct
);


// ============================================
// GET PRICE HISTORY
// GET /api/products/:id/history
// ============================================

router.get(
  "/:id/history",
  getPriceHistory
);


// ============================================
// GET LATEST SUCCESSFUL PRICE
// GET /api/products/:id/latest
// ============================================

router.get(
  "/:id/latest",
  getLatestPrice
);


// ============================================
// GET SCRAPE LOGS
// GET /api/products/:id/logs
// ============================================

router.get(
  "/:id/logs",
  getScrapeLogs
);


// ============================================
// MANUAL SCRAPE
// POST /api/products/:id/scrape
// ============================================

router.post(
  "/:id/scrape",
  manualScrape
);


// ============================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// ============================================

router.get(
  "/:id",
  getTrackedProduct
);


module.exports = router;