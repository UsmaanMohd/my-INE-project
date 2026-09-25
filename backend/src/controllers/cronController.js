const supabase = require("../config/supabase");
const { scrapeAndSave } = require("../services/scrapeService");

// ============================================
// RUN SCRAPE FOR ALL TRACKED PRODUCTS
// POST /api/cron/scrape
// ============================================

async function runScheduledScrape(req, res) {
  try {
    // --------------------------------------------
    // CRON SECRET CHECK
    // --------------------------------------------

    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = req.headers["x-cron-secret"];

    if (
      !cronSecret ||
      requestSecret !== cronSecret
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized cron request"
      });
    }

    // --------------------------------------------
    // GET ALL TRACKED PRODUCTS
    // --------------------------------------------

    const {
      data: products,
      error
    } = await supabase
      .from("tracked_products")
      .select("*")
      .order("id", {
        ascending: true
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch tracked products",
        error: error.message
      });
    }

    if (!products || products.length === 0) {
      return res.json({
        success: true,
        message: "No tracked products found",
        count: 0,
        results: []
      });
    }

    // --------------------------------------------
    // SCRAPE PRODUCTS ONE BY ONE
    // --------------------------------------------

    const results = [];

    for (const product of products) {
      console.log(
        `\nScheduled scrape started for: ${product.product_name}`
      );

      try {
        const result =
          await scrapeAndSave(product);

        results.push({
          product_id: product.id,
          store_product_id:
            product.store_product_id,
          product_name:
            product.product_name,
          selected_option:
            product.selected_option,
          success: result.success,
          outcome: result.outcome,
          attempt: result.attempt,
          error: result.error || null
        });

      } catch (error) {
        console.error(
          `Scheduled scrape error for product ${product.id}:`,
          error.message
        );

        results.push({
          product_id: product.id,
          store_product_id:
            product.store_product_id,
          product_name:
            product.product_name,
          selected_option:
            product.selected_option,
          success: false,
          outcome: "failed",
          error: error.message
        });
      }
    }

    // --------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------

    const successCount =
      results.filter(
        (item) => item.success === true
      ).length;

    const failedCount =
      results.filter(
        (item) => item.success === false
      ).length;

    res.json({
      success: true,
      message:
        "Scheduled scrape completed",
      total: products.length,
      successful: successCount,
      failed: failedCount,
      results
    });

  } catch (error) {
    console.error(
      "Scheduled scrape controller error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Scheduled scrape failed",
      error: error.message
    });
  }
}

module.exports = {
  runScheduledScrape
};