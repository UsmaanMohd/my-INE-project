const { scrapeProduct } = require("../scraper/scraper");
const supabase = require("../config/supabase");

async function scrapeAndSave(trackedProduct) {

  const MAX_ATTEMPTS = 3;

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {

    console.log(
      `\n========== SCRAPE ATTEMPT ${attempt} ==========`
    );

    const result = await scrapeProduct({
      productUrl:
        trackedProduct.product_url,

      selectedOption:
        trackedProduct.selected_option
    });

    // =========================================
    // SUCCESS
    // =========================================

    if (result.success) {

      const outcome =
        attempt === 1
          ? "success"
          : "retried";

      const {
        data,
        error
      } = await supabase
        .from("scrape_history")
        .insert({
          tracked_product_id:
            trackedProduct.id,

          attempt_number:
            attempt,

          price:
            result.price,

          stock:
            result.stock,

          outcome:
            outcome,

          error_message:
            null
        })
        .select()
        .single();

      if (error) {

        throw new Error(
          `Failed to save scrape history: ${error.message}`
        );
      }

      console.log(
        `Saved scrape result: ${outcome}`
      );

      return {
        success: true,
        outcome,
        attempt,
        price: result.price,
        stock: result.stock,
        history: data
      };
    }

    // =========================================
    // FAILED ATTEMPT
    // =========================================

    lastError =
      result.error;

    console.log(
      `Attempt ${attempt} failed: ${lastError}`
    );

    // =========================================
    // RETRY
    // =========================================

    if (attempt < MAX_ATTEMPTS) {

      const {
        error
      } = await supabase
        .from("scrape_history")
        .insert({
          tracked_product_id:
            trackedProduct.id,

          attempt_number:
            attempt,

          price:
            null,

          stock:
            null,

          outcome:
            "retried",

          error_message:
            lastError
        });

      if (error) {

        console.error(
          "Failed to save retry history:",
          error.message
        );
      }

      console.log(
        "Retrying scrape..."
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 3000)
      );
    }
  }

  // =========================================
  // ALL ATTEMPTS FAILED
  // =========================================

  const {
    error
  } = await supabase
    .from("scrape_history")
    .insert({
      tracked_product_id:
        trackedProduct.id,

      attempt_number:
        MAX_ATTEMPTS,

      price:
        null,

      stock:
        null,

      outcome:
        "failed",

      error_message:
        lastError
    });

  if (error) {

    console.error(
      "Failed to save final failure:",
      error.message
    );
  }

  return {
    success: false,
    outcome: "failed",
    attempt: MAX_ATTEMPTS,
    error: lastError
  };
}

module.exports = {
  scrapeAndSave
}; 