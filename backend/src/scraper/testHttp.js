const cheerio = require("cheerio");

async function testHttp() {
  const url = "https://demo.inelabteamdev.com/item/2638";

  try {
    const response = await fetch(url);

    console.log("Status:", response.status);

    const html = await response.text();

    console.log("HTML length:", html.length);

    const $ = cheerio.load(html);

    console.log("Page title:", $("title").text());
    console.log("Product heading:", $("h1").text().trim());

    console.log("\nPRICE SEARCH:");
    console.log($("body").text().includes("Price"));

  } catch (error) {
    console.error("HTTP test failed:", error.message);
  }
}

testHttp();