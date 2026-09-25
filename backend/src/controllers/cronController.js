const supabase = require("../config/supabase");
const { scrapeAndSave } = require("../services/scrapeService");

async function runScheduledScrape(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = req.headers["x-cron-secret"];

    // Security check
    if (!cronSecret || requestSecret !== cronSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized cron request"
      });
    }

    // Get all tracked products
    const {
      data: products,
      error
    } = await supabase
      .from("tracked_products")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch tracked products",
        error: error.message
      });
    }

    if (!products || products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No tracked products found",
        count: 0
      });
    }

    /*
      IMPORTANT:

      We start the scraping in the background and immediately
      return a response to cron-job.org.

      This prevents cron-job.org's 30-second timeout from
      interrupting our Playwright scraping.
    */

    setImmediate(async () => {
      console.log("\n========================================");
      console.log("BACKGROUND SCHEDULED SCRAPE STARTED");
      console.log("Products:", products.length);
      console.log("========================================");

      for (const product of products) {
        console.log(
          `\nScheduled scrape started for: ${product.product_name}`
        );

        try {
          const result = await scrapeAndSave(product);

          console.log(
            `Scheduled scrape finished for ${product.product_name}:`,
            result
          );
        } catch (error) {
          console.error(
            `Scheduled scrape error for product ${product.id}:`,
            error.message
          );
        }
      }

      console.log("\n========================================");
      console.log("BACKGROUND SCHEDULED SCRAPE COMPLETED");
      console.log("========================================\n");
    });

    // Return immediately
    return res.status(202).json({
      success: true,
      message: "Scheduled scrape started in background",
      count: products.length
    });

  } catch (error) {
    console.error(
      "Scheduled scrape controller error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to start scheduled scrape",
      error: error.message
    });
  }
}

module.exports = {
  runScheduledScrape
};