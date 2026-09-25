const { scrapeProduct } = require("./scraper");

async function main() {

  const result = await scrapeProduct({
    productUrl:
      "https://demo.inelabteamdev.com/item/2638",

    selectedOption:
      "2-pack"
  });

  console.log("\n========== RESULT ==========");

  console.log(result);
}

main();