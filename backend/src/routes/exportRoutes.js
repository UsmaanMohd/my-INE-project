const express = require("express");

const {
  exportProductHistory
} = require("../controllers/exportController");

const router = express.Router();

// ============================================
// EXPORT PRODUCT HISTORY
// GET /api/products/:id/export
// ============================================

router.get(
  "/:id/export",
  exportProductHistory
);

module.exports = router;