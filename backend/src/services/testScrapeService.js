const supabase = require("../config/supabase");
const {
  scrapeAndSave
} = require("./scrapeService");

async function main() {

  console.log(
    "\n========== GETTING TRACKED PRODUCTS =========="
  );

  const {
    data,
    error
  } = await supabase
    .from("tracked_products")
    .select("*")
    .order("id", {
      ascending: true
    });

  if (error) {

    console.error(
      "Failed to get tracked products:",
      error.message
    );

    return;
  }

  if (!data || data.length === 0) {

    console.log(
      "No tracked products found."
    );

    return;
  }

  console.log(
    `Found ${data.length} tracked product(s).`
  );

  for (const product of data) {

    console.log(
      "\n========================================"
    );

    console.log(
      "TRACKED PRODUCT:"
    );

    console.log(product);

    console.log(
      "========================================"
    );

    const result =
      await scrapeAndSave(product);

    console.log(
      "\n========== PRODUCT RESULT =========="
    );

    console.log(result);
  }

  console.log(
    "\n========== ALL PRODUCTS COMPLETED =========="
  );
}

main().catch((error) => {

  console.error(
    "Test script failed:",
    error.message
  );

  process.exit(1);
}); 