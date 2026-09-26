const INE_API_URL =
  "https://demo.inelabteamdev.com/api/v2";

let catalogCache = {
  products: [],
  expiresAt: 0
};


// WAIT HELPER
function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}


// FETCH ONE PAGE WITH RETRIES
async function fetchPage(page, limit = 100) {
  const MAX_ATTEMPTS = 3;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      console.log(
        `Fetching catalogue page ${page}, attempt ${attempt}...`
      );

      const response = await fetch(
        `${INE_API_URL}/listings?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      return data;
    } catch (error) {
      console.log(
        `Page ${page} attempt ${attempt} failed: ${error.message}`
      );

      if (
        attempt < MAX_ATTEMPTS
      ) {
        await sleep(
          attempt * 1500
        );
      } else {
        throw new Error(
          `Failed to load catalogue page ${page}: ${error.message}`
        );
      }
    }
  }
}


// LOAD COMPLETE CATALOGUE
async function getCatalog() {
  const now = Date.now();

  // Use cached catalogue for 10 minutes
  if (
    catalogCache.products.length > 0 &&
    catalogCache.expiresAt > now
  ) {
    console.log(
      "Using cached INE catalogue"
    );

    return catalogCache.products;
  }

  console.log(
    "Loading INE product catalogue..."
  );

  // First page
  const firstPage =
    await fetchPage(1);

  const totalPages =
    Number(
      firstPage.totalPages || 1
    );

  const products = [
    ...(firstPage.results || [])
  ];

  console.log(
    `Catalogue contains ${firstPage.count} products across ${totalPages} pages`
  );

  // Remaining pages
  for (
    let page = 2;
    page <= totalPages;
    page++
  ) {
    // Small delay prevents hitting the mock API too aggressively
    await sleep(250);

    const pageData =
      await fetchPage(page);

    products.push(
      ...(pageData.results || [])
    );

    console.log(
      `Loaded ${page}/${totalPages} catalogue pages`
    );
  }

  // Remove accidental duplicate products
  const uniqueProducts =
    Array.from(
      new Map(
        products.map((product) => [
          product.id,
          product
        ])
      ).values()
    );

  catalogCache = {
    products: uniqueProducts,
    expiresAt:
      Date.now() +
      10 * 60 * 1000
  };

  console.log(
    `INE catalogue loaded: ${uniqueProducts.length} unique products`
  );

  return uniqueProducts;
}


// SEARCH PRODUCTS
async function searchProducts(
  req,
  res
) {
  try {
    const query =
      String(
        req.query.q || ""
      )
        .trim()
        .toLowerCase();

    if (query.length < 2) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const products =
      await getCatalog();

    const matches =
      products
        .filter((product) => {
          const searchableText = [
            product.name,
            product.brand,
            product.category,
            product.sku,
            product.description
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            query
          );
        })
        .slice(0, 12);

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    console.error(
      "Catalog search error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to search INE products",
      error: error.message
    });
  }
}


// GET PRODUCT OPTIONS
async function getProductOptions(
  req,
  res
) {
  const { id } = req.params;

  let browser;

  try {
    const {
      chromium
    } = require("playwright");

    browser =
      await chromium.launch({
        headless: true
      });

    const page =
      await browser.newPage();

    const productUrl =
      `https://demo.inelabteamdev.com/item/${id}`;

    await page.goto(
      productUrl,
      {
        waitUntil:
          "domcontentloaded",
        timeout: 30000
      }
    );

    await page.waitForTimeout(
      1500
    );

    const product =
      await page.evaluate(() => {
        const name =
          document
            .querySelector("h1")
            ?.innerText
            ?.trim() || "";

        const brand =
          document
            .querySelector(
              ".pdp-maker"
            )
            ?.innerText
            ?.trim() || "";

        const options =
          Array.from(
            document.querySelectorAll(
              ".opt-picker button"
            )
          )
            .map(
              (button) => ({
                label:
                  button.innerText
                    .trim()
              })
            )
            .filter(
              (option) =>
                option.label
            );

        const optionGroup =
          document
            .querySelector(
              ".opt-picker .opt-axis"
            )
            ?.innerText
            ?.trim() ||
          "Option";

        return {
          name,
          brand,
          optionGroup,
          options
        };
      });

    res.json({
      success: true,
      data: {
        id: String(id),
        product_url:
          productUrl,
        ...product
      }
    });
  } catch (error) {
    console.error(
      "Product options error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to load product options",
      error: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


module.exports = {
  searchProducts,
  getProductOptions
};