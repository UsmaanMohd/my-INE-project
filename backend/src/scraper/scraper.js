const { chromium } = require("playwright");

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

function logMemory(label) {
  const m = process.memoryUsage();

  console.log(
    `[MEMORY ${label}] RSS=${Math.round(m.rss / 1024 / 1024)}MB ` +
      `HEAP=${Math.round(m.heapUsed / 1024 / 1024)}MB`
  );
}

/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeText(text = "") {
  return String(text)
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\uFF10-\uFF19]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   PRICE EXTRACTION
   IMPORTANT:
   We DO NOT use a greedy regex across the whole text.
========================================================= */

function extractPrices(text) {
  const normalized = normalizeText(text);

  const prices = [];

  /*
   * Split around ₹ so that:
   *
   * ₹17,10410% saving
   *
   * does not become 1710410.
   *
   * We then take the numeric portion and stop when
   * the price clearly transitions into another word/percentage.
   */

  const rupeeParts = normalized.split("₹");

  for (let i = 1; i < rupeeParts.length; i++) {
    let part = rupeeParts[i].trim();

    /*
     * Remove zero-width characters again for safety.
     */
    part = part.replace(/[\u200B-\u200F\u2060\uFEFF]/g, "");

    /*
     * A valid store price normally consists of:
     * digits + commas + spaces + optional decimal.
     *
     * Example:
     * 17,104
     * 17 104
     * 17,104.50
     */

    const match = part.match(
      /^(\d{1,3}(?:[\s,]\d{2,3})+|\d+)(?:\.(\d{1,2}))?/
    );

    if (!match) {
      continue;
    }

    const numberString =
      match[1].replace(/[^\d]/g, "") +
      (match[2] ? `.${match[2]}` : "");

    const price = Number(numberString);

    if (
      Number.isFinite(price) &&
      price > 0 &&
      price < 100000000
    ) {
      prices.push(price);
    }
  }

  return prices;
}

/* =========================================================
   STOCK EXTRACTION
========================================================= */

function extractStock(text) {
  const normalized = normalizeText(text).toUpperCase();

  const patterns = [
    /SOLD OUT/,
    /OUT OF STOCK/,
    /LAST FEW\s*[:\-]?\s*\d+/,
    /ONLY\s+\d+\s+LEFT/,
    /\d+\s*AVAILABLE/,
    /AVAILABLE\s*[:\-]?\s*\d+/,
    /STOCK\s*[:\-]?\s*\d+\s*REMAINING/,
    /\d+\s*REMAINING/,
    /\d+\s+LEFT/,
    /IN STOCK/,
    /AVAILABLE/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/* =========================================================
   COOKIE HANDLER
========================================================= */

async function safeHandleCookies(page) {
  console.log("Checking cookie consent...");

  try {
    const popupCount = await withTimeout(
      page.locator(".consent-scrim").count(),
      3000,
      "Cookie popup count timed out"
    );

    console.log(
      "Consent popup count:",
      popupCount
    );

    if (!popupCount) {
      console.log("No cookie popup found.");
      return;
    }

    let visible = false;

    try {
      visible = await withTimeout(
        page
          .locator(".consent-scrim")
          .first()
          .isVisible(),
        2000,
        "Cookie visibility timed out"
      );
    } catch {
      visible = false;
    }

    if (!visible) {
      console.log(
        "Cookie popup exists but is not visible."
      );
      return;
    }

    console.log(
      "Consent scrim blocking interaction: true"
    );

    console.log("COOKIE POPUP FOUND");

    const dialog = page
      .locator(
        ".consent-dialog, .consent-modal, .consent-scrim"
      )
      .first();

    const buttons = dialog.locator("button");

    const buttonCount = await withTimeout(
      buttons.count(),
      2000,
      "Consent button count timed out"
    );

    console.log(
      "Consent dialogs:",
      buttonCount
    );

    let selectedButton = null;

    for (let i = 0; i < buttonCount; i++) {
      try {
        const button = buttons.nth(i);

        const text = normalizeText(
          await withTimeout(
            button.innerText(),
            1000,
            "Consent button text timed out"
          )
        );

        if (
          /ALLOW|ACCEPT|AGREE|OK|CONTINUE|GOT IT/i.test(
            text
          )
        ) {
          selectedButton = button;

          console.log(
            "Consent button found."
          );

          console.log(
            "Consent button text:",
            text
          );

          break;
        }
      } catch {
        // continue
      }
    }

    if (!selectedButton) {
      console.log(
        "No suitable consent button found."
      );
      return;
    }

    try {
      await withTimeout(
        selectedButton.click({
          force: true,
          timeout: 2000,
        }),
        3000,
        "Consent click timed out"
      );

      console.log(
        "Consent button clicked."
      );
    } catch (error) {
      console.log(
        "Consent click warning:",
        error.message
      );
    }

    await delay(300);

    console.log(
      "Cookie handler finished without waiting for overlay."
    );
  } catch (error) {
    console.log(
      "Cookie handler warning:",
      error.message
    );
  }
}

/* =========================================================
   COOKIE SCRIM
========================================================= */

async function getCookieScrimVisible(page) {
  try {
    return await withTimeout(
      page
        .locator(".consent-scrim")
        .first()
        .isVisible(),
      1500,
      "Cookie scrim visibility timed out"
    );
  } catch {
    return false;
  }
}

/* =========================================================
   OFFER PANEL
========================================================= */

async function getOfferPanel(page) {
  const selectors = [
    ".offer-panel.offer-locked",
    ".offer-panel",
    "[class*='offer-panel']",
  ];

  for (const selector of selectors) {
    try {
      const locator =
        page.locator(selector).first();

      const count = await withTimeout(
        locator.count(),
        1500,
        `Offer panel count timed out: ${selector}`
      );

      if (count > 0) {
        return locator;
      }
    } catch {
      // continue
    }
  }

  return null;
}

/* =========================================================
   SAFE HOVER
========================================================= */

async function performSafeHover(page, label) {
  console.log(
    `[${label}] Starting safe hover...`
  );

  const panel = await getOfferPanel(page);

  if (!panel) {
    throw new Error(
      `[${label}] Offer panel not found`
    );
  }

  console.log(
    `[${label}] Offer panel found.`
  );

  try {
    await withTimeout(
      panel.hover({
        force: true,
        timeout: 3000,
      }),
      4000,
      `[${label}] Direct hover timed out`
    );

    console.log(
      `[${label}] Direct hover completed.`
    );
  } catch (error) {
    console.log(
      `[${label}] Direct hover warning:`,
      error.message
    );
  }

  let box = null;

  try {
    box = await withTimeout(
      panel.boundingBox(),
      2000,
      `[${label}] boundingBox timed out`
    );
  } catch (error) {
    console.log(
      `[${label}] boundingBox warning:`,
      error.message
    );
  }

  if (!box) {
    console.log(
      `[${label}] No bounding box.`
    );

    await delay(300);

    return;
  }

  console.log(
    `[${label}] Offer panel position found.`
  );

  const points = [
    [0.20, 0.20],
    [0.40, 0.40],
    [0.60, 0.60],
    [0.80, 0.80],
    [0.50, 0.20],
    [0.50, 0.40],
    [0.50, 0.60],
    [0.50, 0.80],
    [0.20, 0.50],
    [0.40, 0.50],
    [0.60, 0.50],
    [0.80, 0.50],
    [0.50, 0.50],
  ];

  console.log(
    `[${label}] Performing controlled mouse movements...`
  );

  for (const [rx, ry] of points) {
    try {
      await page.mouse.move(
        box.x + box.width * rx,
        box.y + box.height * ry
      );
    } catch (error) {
      console.log(
        `[${label}] Mouse movement warning:`,
        error.message
      );

      break;
    }

    await delay(20);
  }

  console.log(
    `[${label}] Controlled hover completed.`
  );

  await delay(500);
}

/* =========================================================
   PRICE BUTTON
========================================================= */

async function getPriceButton(page) {
  const selectors = [
    'button[aria-label="Check today’s price"]',
    'button[aria-label="Check today\'s price"]',
    'button:has-text("CHECK AGAIN")',
    'button:has-text("Check today")',
  ];

  for (const selector of selectors) {
    try {
      const button =
        page.locator(selector).first();

      const count = await withTimeout(
        button.count(),
        1500,
        "Price button count timed out"
      );

      if (count > 0) {
        return button;
      }
    } catch {
      // continue
    }
  }

  return null;
}

/* =========================================================
   WAIT FOR PRICE BUTTON
========================================================= */

async function waitForPriceButton(page) {
  const start = Date.now();

  while (Date.now() - start < 15000) {
    const button =
      await getPriceButton(page);

    if (button) {
      try {
        const disabled =
          await withTimeout(
            button.isDisabled(),
            1500,
            "Price button state timed out"
          );

        if (!disabled) {
          return button;
        }
      } catch {
        // continue
      }
    }

    await delay(500);
  }

  throw new Error(
    "Price button did not become available within 15 seconds"
  );
}

/* =========================================================
   READ OFFER PANEL
========================================================= */

async function readOfferPanel(page) {
  const panel =
    await getOfferPanel(page);

  if (!panel) {
    return {
      text: "",
      prices: [],
      price: null,
      stock: null,
    };
  }

  let text = "";

  try {
    text = await withTimeout(
      panel.textContent(),
      2500,
      "Offer panel textContent timed out"
    );
  } catch {
    try {
      text = await withTimeout(
        panel.innerText(),
        2500,
        "Offer panel innerText timed out"
      );
    } catch {
      text = "";
    }
  }

  text = normalizeText(text);

  const prices =
    extractPrices(text);

  const stock =
    extractStock(text);

  return {
    text,
    prices,
    price:
      prices.length > 0
        ? prices[prices.length - 1]
        : null,
    stock,
  };
}

/* =========================================================
   WAIT FOR QUOTE + DOM
   MAIN FIX FOR PRODUCT 2
========================================================= */

async function waitForOfferResult(
  page,
  quotePromise,
  timeoutMs = 60000
) {
  console.log(
    `[OFFER] Waiting up to ${timeoutMs}ms for quote + offer data...`
  );

  const start = Date.now();

  let quoteResponse = null;
  let quoteFinished = false;

  /*
   * Quote API is now allowed to take time.
   * We do not fail just because it takes 5–10 seconds.
   */

  quotePromise
    .then((response) => {
      quoteResponse = response;
      quoteFinished = true;

      console.log(
        "[OFFER] Quote API completed with status:",
        response.status()
      );
    })
    .catch((error) => {
      quoteFinished = true;

      console.log(
        "[OFFER] Quote API warning:",
        error.message
      );
    });

  let lastText = "";

  while (Date.now() - start < timeoutMs) {
    try {
      const result =
        await readOfferPanel(page);

      lastText = result.text;

      if (
        result.price !== null &&
        result.stock !== null
      ) {
        console.log(
          "[OFFER] Valid price + stock detected."
        );

        return result;
      }
    } catch (error) {
      console.log(
        "[OFFER] Read warning:",
        error.message
      );
    }

    /*
     * Once quote has completed, give DOM another
     * short period to render.
     */

    if (
      quoteFinished &&
      Date.now() - start > 8000
    ) {
      console.log(
        "[OFFER] Quote completed. Continuing DOM polling..."
      );
    }

    await delay(500);
  }

  throw new Error(
    "Offer data timeout after 60 seconds. " +
      `Quote finished: ${quoteFinished}. ` +
      `Last panel text: ${lastText.slice(0, 500)}`
  );
}

/* =========================================================
   MAIN SCRAPER
========================================================= */

async function scrapeProduct({
  productUrl,
  selectedOption,
}) {
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log(
      "\n================================"
    );

    console.log(
      "SCRAPING:",
      productUrl
    );

    console.log(
      "OPTION:",
      selectedOption
    );

    console.log(
      "================================\n"
    );

    /* STEP 1 */

    console.log(
      "[STEP 1] Launching Chromium..."
    );

    logMemory("before-browser");

    browser = await withTimeout(
      chromium.launch({
        headless:
          process.env.HEADLESS !== "false",

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
        ],
      }),
      20000,
      "Chromium launch timed out"
    );

    console.log(
      "[STEP 1] Chromium launched."
    );

    logMemory("after-browser");

    /* STEP 2 */

    console.log(
      "[STEP 2] Creating browser context..."
    );

    context = await withTimeout(
      browser.newContext({
        viewport: {
          width: 1366,
          height: 768,
        },

        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
      }),
      10000,
      "Browser context creation timed out"
    );

    console.log(
      "[STEP 2] Browser context created."
    );

    /* STEP 3 */

    console.log(
      "[STEP 3] Creating browser page..."
    );

    page = await withTimeout(
      context.newPage(),
      10000,
      "Browser page creation timed out"
    );

    console.log(
      "[STEP 3] Browser page created."
    );

    /* STEP 4 */

    console.log(
      "[STEP 4] Installing network diagnostics..."
    );

    page.on("request", (request) => {
      const url = request.url();

      if (
        url.includes("/api/v2/items/")
      ) {
        console.log(
          ">>> QUOTE REQUEST:",
          request.method(),
          url
        );
      }
    });

    console.log(
      "[STEP 4] Network diagnostics ready."
    );

    /* STEP 5 */

    console.log(
      "[STEP 5] Opening product page..."
    );

    logMemory("before-page-goto");

    await withTimeout(
      page.goto(productUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }),
      35000,
      "Product page loading timed out"
    );

    console.log(
      "[STEP 5] Product page loaded."
    );

    logMemory("after-page-goto");

    await delay(1000);

    console.log(
      "[STEP 5] Initial page preparation completed."
    );

    /* STEP 6 */

    console.log(
      "[STEP 6] Checking cookie consent before option selection..."
    );

    console.log(
      "[STEP 6] Cookie handling START"
    );

    await safeHandleCookies(page);

    console.log(
      "[STEP 6] Cookie handling END"
    );

    console.log(
      "[STEP 6] Cookie handling completed."
    );

    /* STEP 7 */

    console.log(
      "[STEP 7] Selecting option:",
      selectedOption
    );

    const optionLocator =
      page
        .locator("button")
        .filter({
          hasText: selectedOption,
        });

    const optionCount =
      await withTimeout(
        optionLocator.count(),
        3000,
        "Option button count timed out"
      );

    console.log(
      "[STEP 7C] Matching option buttons:",
      optionCount
    );

    if (optionCount === 0) {
      throw new Error(
        `Option not found: ${selectedOption}`
      );
    }

    const optionButton =
      optionLocator.first();

    await withTimeout(
      optionButton.waitFor({
        state: "visible",
        timeout: 5000,
      }),
      6000,
      "Option visibility timed out"
    );

    console.log(
      "[STEP 7F] Option button visible."
    );

    console.log(
      "[STEP 7G] Clicking option..."
    );

    await withTimeout(
      optionButton.click({
        force: true,
        timeout: 5000,
      }),
      6000,
      "Option click timed out"
    );

    console.log(
      "[STEP 7H] Selected option:",
      selectedOption
    );

    console.log(
      "[STEP 7I] Option selection completed."
    );

    await delay(500);

    /* STEP 8 */

    console.log(
      "[STEP 8] Preparing offer panel..."
    );

    const offerPanel =
      await getOfferPanel(page);

    if (!offerPanel) {
      throw new Error(
        "Offer panel not found"
      );
    }

    console.log(
      "[STEP 8B] Offer panel found."
    );

    /* STEP 9 */

    console.log(
      "[STEP 9] Performing first safe hover..."
    );

    await performSafeHover(
      page,
      "HOVER"
    );

    console.log(
      "[STEP 9] First hover completed."
    );

    logMemory("after-first-hover");

    /* STEP 10 */

    console.log(
      "[STEP 10] Checking cookie consent after hover..."
    );

    await safeHandleCookies(page);

    console.log(
      "[STEP 10] Cookie handling completed."
    );

    const scrimVisible =
      await getCookieScrimVisible(page);

    console.log(
      "[STEP 10] Cookie scrim visible:",
      scrimVisible
    );

    /* STEP 11 */

    console.log(
      "[STEP 11] Performing short recovery hover..."
    );

    await performSafeHover(
      page,
      "HOVER RECOVERY"
    );

    console.log(
      "[STEP 11] Recovery hover completed."
    );

    /* STEP 12 */

    console.log(
      "[STEP 12] Waiting for price button..."
    );

    const priceButton =
      await waitForPriceButton(page);

    console.log(
      "[STEP 12] Price button unlocked."
    );

    /* STEP 13 */

    console.log(
      "[STEP 13] Final cookie check..."
    );

    const finalScrim =
      await getCookieScrimVisible(page);

    console.log(
      "[STEP 13] Cookie scrim visible:",
      finalScrim
    );

    if (finalScrim) {
      await safeHandleCookies(page);
    }

    /* STEP 14 */

    console.log(
      "[STEP 14] Finding price button..."
    );

    const finalButton =
      await getPriceButton(page);

    if (!finalButton) {
      throw new Error(
        "Price button disappeared"
      );
    }

    const disabled =
      await withTimeout(
        finalButton.isDisabled(),
        2000,
        "Price button state timed out"
      );

    console.log(
      "[STEP 14] Price button disabled:",
      disabled
    );

    if (disabled) {
      throw new Error(
        "Price button is disabled"
      );
    }

    /* STEP 15 */

    console.log(
      "[STEP 15] Preparing quote API diagnostic..."
    );

    /*
     * IMPORTANT:
     * Create the listener BEFORE clicking.
     */

    const quotePromise =
      page.waitForResponse(
        (response) => {
          const url =
            response.url();

          return (
            url.includes("/api/v2/items/") &&
            url.includes("/quote?opt=")
          );
        },
        {
          timeout: 60000,
        }
      );

    console.log(
      "[STEP 15] Quote listener ready."
    );

    /* STEP 16 */

    console.log(
      "[STEP 16] Clicking price button..."
    );

    await withTimeout(
      finalButton.click({
        force: true,
        timeout: 5000,
      }),
      6000,
      "Price button click timed out"
    );

    console.log(
      "[STEP 16] Playwright click completed."
    );

    /* STEP 17 */

    console.log(
      "[STEP 17] Waiting for quote API..."
    );

    /*
     * DO NOT wait only 1 second.
     * The store is demonstrably slow.
     */

    const quoteResponse =
      await quotePromise;

    console.log(
      "[STEP 17] Quote response received:",
      quoteResponse.status(),
      quoteResponse.url()
    );

    if (
      !quoteResponse.ok()
    ) {
      throw new Error(
        `Quote API returned HTTP ${quoteResponse.status()}`
      );
    }

    /* STEP 18 */

    console.log(
      "[STEP 18] Waiting for rendered offer data..."
    );

    const offerResult =
      await waitForOfferResult(
        page,
        Promise.resolve(quoteResponse),
        60000
      );

    console.log(
      "[STEP 18] Valid offer data detected."
    );

    /* STEP 19 */

    console.log(
      "[STEP 19] Reading offer panel..."
    );

    console.log(
      "\n========== OFFER PANEL ==========\n"
    );

    console.log(
      offerResult.text
    );

    /* STEP 20 */

    console.log(
      "[STEP 20] Extracting price..."
    );

    const prices =
      offerResult.prices;

    console.log(
      "Detected prices:",
      prices
    );

    if (
      prices.length === 0
    ) {
      throw new Error(
        "No valid price found"
      );
    }

    const price =
      prices[prices.length - 1];

    /* STEP 21 */

    console.log(
      "[STEP 21] Extracting stock..."
    );

    const stock =
      offerResult.stock;

    if (!stock) {
      throw new Error(
        "No valid stock status found"
      );
    }

    console.log(
      "PRICE:",
      price
    );

    console.log(
      "STOCK:",
      stock
    );

    console.log(
      "\nSCRAPE SUCCESS\n"
    );

    return {
      success: true,
      price,
      stock,
    };
  } catch (error) {
    console.error(
      "\nSCRAPE FAILED:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  } finally {
    console.log(
      "Starting browser cleanup..."
    );

    if (page) {
      try {
        await withTimeout(
          page.close(),
          5000,
          "Page close timed out"
        );

        console.log(
          "Page closed."
        );
      } catch (error) {
        console.log(
          "Page close warning:",
          error.message
        );
      }
    }

    if (context) {
      try {
        await withTimeout(
          context.close(),
          5000,
          "Context close timed out"
        );

        console.log(
          "Context closed."
        );
      } catch (error) {
        console.log(
          "Context close warning:",
          error.message
        );
      }
    }

    if (browser) {
      try {
        await withTimeout(
          browser.close(),
          5000,
          "Browser close timed out"
        );

        console.log(
          "Browser closed."
        );
      } catch (error) {
        console.log(
          "Browser close warning:",
          error.message
        );
      }
    }

    console.log(
      "Browser cleanup completed."
    );
  }
}

module.exports = {
  scrapeProduct,
};