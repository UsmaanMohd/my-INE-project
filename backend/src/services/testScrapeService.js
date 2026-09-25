const supabase = require("../config/supabase");
const {
  scrapeAndSave
} = require("./scrapeService");

async function main() {

  console.log(
    "\n========== GETTING TRACKED PRODUCT =========="
  );

  const {
    data,
    error
  } = await supabase
    .from("tracked_products")
    .select("*")
    .eq("store_product_id", "2638")
    .eq("selected_option", "2-pack")
    .single();

  if (error) {

    console.error(
      "Failed to get tracked product:",
      error.message
    );

    return;
  }

  console.log(
    "\nTRACKED PRODUCT:"
  );

  console.log(data);

  const result =
    await scrapeAndSave(data);

  console.log(
    "\n========== FINAL RESULT =========="
  );

  console.log(result);
}

main();