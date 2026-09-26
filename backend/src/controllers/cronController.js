const supabase = require("../config/supabase");
const { scrapeAndSave } = require("../services/scrapeService");

async function runScheduledScrape(req, res) {
  try {
    // ==============================
    // 1. CHECK CRON SECRET
    // ==============================

    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = req.headers["x-cron-secret"];

    if (!cronSecret || requestSecret !== cronSecret) {
      return res
        .status(401)
        .type("text")
        .send("Unauthorized");
    }

    // ==============================
    // 2. FETCH TRACKED PRODUCTS
    // ==============================

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

      return res
        .status(500)
        .type("text")
        .send("Database error");
    }

    if (!products || products.length === 0) {
      return res
        .status(200)
        .type("text")
        .send("OK - No products");
    }

    // ==============================
    // 3. START SCRAPING IN BACKGROUND
    // ==============================

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

      console.log("\n========================================");
      console.log("BACKGROUND SCHEDULED SCRAPE COMPLETED");
      console.log("========================================\n");
    });

    // ==============================
    // 4. VERY SMALL CRON RESPONSE
    // ==============================

    return res
      .status(200)
      .type("text")
      .send("OK");

  } catch (error) {

    console.error(
      "Scheduled scrape controller error:",
      error
    );

    return res
      .status(500)
      .type("text")
      .send("Cron error");
  }
}

module.exports = {
  runScheduledScrape
};