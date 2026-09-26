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
      console.error(
        "Failed to fetch tracked products:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch tracked products"
      });
    }

    if (!products || products.length === 0) {
      console.log("No tracked products found.");

      // IMPORTANT:
      // Empty response so cron-job.org receives almost nothing.
      return res.status(204).end();
    }

    /*
      Start scraping in background.

      cron-job.org only needs to know that the request
      was accepted successfully.
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

    /*
      IMPORTANT:
      Return NO CONTENT.

      This prevents cron-job.org from receiving
      a response body and avoids "output too large".
    */
    return res.status(204).end();

  } catch (error) {
    console.error(
      "Scheduled scrape controller error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to start scheduled scrape"
    });
  }
}

module.exports = {
  runScheduledScrape
};