const supabase = require("../config/supabase");
const { scrapeAndSave } = require("../services/scrapeService");

async function runScheduledScrape(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = req.headers["x-cron-secret"];

    // =====================================================
    // AUTHENTICATION
    // =====================================================

    if (!cronSecret || requestSecret !== cronSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized cron request",
      });
    }

    // =====================================================
    // IMPORTANT:
    // RETURN EMPTY RESPONSE IMMEDIATELY
    // =====================================================

    res.status(204).end();

    // =====================================================
    // BACKGROUND SCRAPE
    // =====================================================

    setImmediate(async () => {
      try {
        console.log("\n========================================");
        console.log("BACKGROUND SCHEDULED SCRAPE STARTED");
        console.log("========================================");

        // -------------------------------------------------
        // FETCH TRACKED PRODUCTS
        // -------------------------------------------------

        const {
          data: products,
          error,
        } = await supabase
          .from("tracked_products")
          .select("*")
          .order("id", {
            ascending: true,
          });

        if (error) {
          console.error(
            "Failed to fetch tracked products:",
            error.message
          );

          return;
        }

        if (!products || products.length === 0) {
          console.log(
            "No tracked products found."
          );

          return;
        }

        console.log(
          "Products:",
          products.length
        );

        // -------------------------------------------------
        // SCRAPE PRODUCTS ONE BY ONE
        // -------------------------------------------------

        for (const product of products) {
          console.log(
            `\nScheduled scrape started for: ${product.product_name}`
          );

          try {
            const result =
              await scrapeAndSave(product);

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

        console.log(
          "\n========================================"
        );

        console.log(
          "BACKGROUND SCHEDULED SCRAPE COMPLETED"
        );

        console.log(
          "========================================\n"
        );

      } catch (error) {
        console.error(
          "Background scheduled scrape error:",
          error
        );
      }
    });

  } catch (error) {
    console.error(
      "Scheduled scrape controller error:",
      error
    );

    // Response may already have been sent.
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to start scheduled scrape",
      });
    }
  }
}

module.exports = {
  runScheduledScrape,
};