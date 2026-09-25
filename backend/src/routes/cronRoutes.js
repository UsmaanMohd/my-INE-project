const express = require("express");

const {
  runScheduledScrape
} = require("../controllers/cronController");

const router = express.Router();

// ============================================
// RUN SCHEDULED SCRAPE
// POST /api/cron/scrape
// ============================================

router.post(
  "/scrape",
  runScheduledScrape
);

module.exports = router;