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
   TEXT NORMALIZATION
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
========================================================= */

function extractPrices(text) {
  const normalized = normalizeText(text);

  const matches = normalized.match(
    /₹\s*[\d,\s]+(?:\.\d+)?/g
  );

  if (!matches) {
    return [];
  }

  const prices = matches
    .map((value) => {
      const cleaned = value
        .replace(/[^\d.]/g, "")
        .trim();

      const number = Number(cleaned);

      return Number.isFinite(number) ? number : null;
    })
    .filter(
      (value) =>
        value !== null &&
        value > 0
    );

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
    /AVAILABLE\s*[:\-]?\s*\d+/,
    /\d+\s*AVAILABLE/,
    /STOCK\s*[:\-]?\s*\d+\s*REMAINING/,
    /\d+\s*REMAINING/,
    /LAST FEW\s*[:\-]?\s*\d+/,
    /ONLY\s+\d+\s+LEFT/,
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
   COOKIE HANDLING
========================================================= */

async function safeHandleCookies(page) {
  console.log("Checking cookie consent...");

  try {
    const popupCount = await withTimeout(
      page.locator(".consent-scrim").count(),
      3000,
      "Cookie popup count timed out"
    );

    console.log("Consent popup count:", popupCount);

    if (!popupCount) {
      console.log("No cookie popup found.");
      return;
    }

    let visible = false;

    try {
      visible = await withTimeout(
        page.locator(".consent-scrim").first().isVisible(),
        2000,
        "Cookie visibility check timed out"
      );
    } catch {
      visible = false;
    }

    if (!visible) {
      console.log("Cookie popup exists but is not visible.");
      return;
    }

    console.log("Consent scrim blocking interaction: true");
    console.log("COOKIE POPUP FOUND");

    const dialog = page.locator(
      ".consent-dialog, .consent-modal, .consent-scrim"
    ).first();

    const buttons = dialog.locator("button");

    const buttonCount = await withTimeout(
      buttons.count(),
      2000,
      "Consent button count timed out"
    );

    console.log("Consent dialogs:", buttonCount);

    if (buttonCount === 0) {
      console.log("No consent button found.");
      return;
    }

    let selectedButton = null;

    for (let i = 0; i < buttonCount; i++) {
      try {
        const btn = buttons.nth(i);

        const text = normalizeText(
          await withTimeout(
            btn.innerText(),
            1000,
            "Consent button text timed out"
          )
        );

        if (
          /ALLOW|ACCEPT|AGREE|OK|CONTINUE|GOT IT/i.test(text)
        ) {
          selectedButton = btn;

          console.log("Consent button found.");
          console.log("Consent button text:", text);

          break;
        }
      } catch {
        // continue searching
      }
    }

    if (!selectedButton) {
      console.log("No suitable consent button found.");
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

      console.log("Consent button clicked.");
    } catch (error) {
      console.log(
        "Consent click warning:",
        error.message
      );
    }

    // IMPORTANT:
    // Do NOT wait for overlay animation/disappearance.
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
   COOKIE SCRIM CHECK
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
   OFFER PANEL FINDER
========================================================= */

async function getOfferPanel(page) {
  const selectors = [
    ".offer-panel.offer-locked",
    ".offer-panel",
    "[class*='offer-panel']",
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();

      const count = await withTimeout(
        locator.count(),
        1500,
        `Offer panel count timed out: ${selector}`
      );

      if (count > 0) {
        return locator;
      }
    } catch {
      // try next selector
    }
  }

  return null;
}

/* =========================================================
   SAFE HOVER
   MAIN FIX
========================================================= */

async function performSafeHover(page, label) {
  console.log(`[${label}] Starting safe hover...`);

  const panel = await getOfferPanel(page);

  if (!panel) {
    throw new Error(
      `[${label}] Offer panel not found`
    );
  }

  console.log(
    `[${label}] Offer panel found.`
  );

  // First try normal Playwright hover.
  try {
    await withTimeout(
      panel.hover({
        force: true,
        timeout: 3000,
      }),
      4000,
      `[${label}] panel.hover timed out`
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

  // Get bounding box safely.
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
      `[${label}] No bounding box. Direct hover was attempted.`
    );

    await delay(300);

    return;
  }

  console.log(
    `[${label}] Offer panel position found.`
  );

  /*
   * OLD CODE:
   * 120 mouse movements
   *
   * NEW CODE:
   * only 20 controlled movements.
   * This prevents Render from getting stuck.
   */

  const points = [
    [0.10, 0.10],
    [0.20, 0.20],
    [0.30, 0.30],
    [0.40, 0.40],
    [0.50, 0.50],
    [0.60, 0.60],
    [0.70, 0.70],
    [0.80, 0.80],
    [0.90, 0.90],
    [0.50, 0.20],
    [0.50, 0.40],
    [0.50, 0.60],
    [0.50, 0.80],
    [0.20, 0.50],
    [0.40, 0.50],
    [0.60, 0.50],
    [0.80, 0.50],
    [0.30, 0.70],
    [0.70, 0.30],
    [0.50, 0.50],
  ];

  console.log(
    `[${label}] Performing controlled mouse movements...`
  );

  for (const [rx, ry] of points) {
    const x = box.x + box.width * rx;
    const y = box.y + box.height * ry;

    try {
      await page.mouse.move(x, y);
    } catch (error) {
      console.log(
        `[${label}] Mouse movement warning:`,
        error.message
      );

      break;
    }

    await delay(15);
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
      const button = page.locator(selector).first();

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
    const button = await getPriceButton(page);

    if (button) {
      try {
        const disabled = await withTimeout(
          button.isDisabled(),
          1500,
          "Price button disabled check timed out"
        );

        if (!disabled) {
          return button;
        }
      } catch {
        // continue polling
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
  const panel = await getOfferPanel(page);

  if (!panel) {
    return {
      text: "",
      price: null,
      stock: null,
    };
  }

  let text = "";

  try {
    text = await withTimeout(
      panel.textContent(),
      2000,
      "Offer panel text read timed out"
    );
  } catch {
    try {
      text = await withTimeout(
        panel.innerText(),
        2000,
        "Offer panel innerText timed out"
      );
    } catch {
      text = "";
    }
  }

  text = normalizeText(text);

  const prices = extractPrices(text);
  const stock = extractStock(text);

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
   WAIT FOR OFFER RESULT
========================================================= */

async function waitForOfferResult(
  page,
  timeoutMs = 25000
) {
  console.log(
    `[OFFER] Polling offer panel for up to ${timeoutMs}ms...`
  );

  const start = Date.now();

  let lastText = "";

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await readOfferPanel(page);

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

      if (
        result.price !== null ||
        result.stock !== null
      ) {
        console.log(
          "[OFFER] Partial result detected. Continuing..."
        );
      }
    } catch (error) {
      console.log(
        "[OFFER] Poll warning:",
        error.message
      );
    }

    await delay(500);
  }

  throw new Error(
    "Offer panel did not provide complete price + stock data within " +
      `${timeoutMs}ms. Last text: ${lastText.slice(0, 500)}`
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
    console.log("\n================================");
    console.log("SCRAPING:", productUrl);
    console.log("OPTION:", selectedOption);
    console.log("================================\n");

    /* ---------------------------------------------
       STEP 1
    --------------------------------------------- */

    console.log("[STEP 1] Launching Chromium...");

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

    console.log("[STEP 1] Chromium launched.");

    logMemory("after-browser");

    /* ---------------------------------------------
       STEP 2
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 3
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 4
    --------------------------------------------- */

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

    page.on("response", (response) => {
      const url = response.url();

      if (
        url.includes("/api/v2/items/")
      ) {
        console.log(
          "<<< QUOTE RESPONSE:",
          response.status(),
          url
        );
      }
    });

    console.log(
      "[STEP 4] Network diagnostics ready."
    );

    /* ---------------------------------------------
       STEP 5
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 6
    --------------------------------------------- */

    console.log(
      "[STEP 6] Checking cookie consent before option selection..."
    );

    console.log("[STEP 6] Cookie handling START");

    await safeHandleCookies(page);

    console.log("[STEP 6] Cookie handling END");
    console.log(
      "[STEP 6] Cookie handling completed."
    );

    /* ---------------------------------------------
       STEP 6A / 6B
    --------------------------------------------- */

    console.log(
      "[STEP 6A] Moving to option selection..."
    );

    await delay(500);

    console.log(
      "[STEP 6B] Delay completed."
    );

    /* ---------------------------------------------
       STEP 7
    --------------------------------------------- */

    console.log(
      "[STEP 7] Selecting option:",
      selectedOption
    );

    console.log(
      "[STEP 7A] Creating option locator..."
    );

    const optionLocator = page
      .locator("button")
      .filter({
        hasText: selectedOption,
      });

    console.log(
      "[STEP 7B] Option locator created."
    );

    const optionCount = await withTimeout(
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

    const optionButton = optionLocator.first();

    console.log(
      "[STEP 7D] Matching option buttons: 1"
    );

    await withTimeout(
      optionButton.waitFor({
        state: "visible",
        timeout: 5000,
      }),
      6000,
      "Option button visibility timed out"
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
      "Option button click timed out"
    );

    console.log(
      "[STEP 7H] Selected option:",
      selectedOption
    );

    console.log(
      "[STEP 7I] Option selection completed."
    );

    await delay(500);

    /* ---------------------------------------------
       STEP 8
    --------------------------------------------- */

    console.log(
      "[STEP 8] Preparing offer panel..."
    );

    console.log(
      "[STEP 8A] Waiting for offer panel..."
    );

    const offerPanel = await getOfferPanel(page);

    if (!offerPanel) {
      throw new Error(
        "Offer panel not found after selecting option"
      );
    }

    console.log(
      "[STEP 8B] Offer panel found."
    );

    /* ---------------------------------------------
       STEP 9
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 10
    --------------------------------------------- */

    console.log(
      "[STEP 10] Checking cookie consent after hover..."
    );

    console.log(
      "[STEP 10] Cookie handling START"
    );

    await safeHandleCookies(page);

    console.log(
      "[STEP 10] Cookie handling END"
    );

    console.log(
      "[STEP 10] Cookie handling completed."
    );

    console.log(
      "[STEP 10] Checking cookie scrim..."
    );

    const scrimVisible =
      await getCookieScrimVisible(page);

    console.log(
      "[STEP 10] Cookie scrim visible:",
      scrimVisible
    );

    /* ---------------------------------------------
       STEP 11
       IMPORTANT:
       NO 120-MOVEMENT HOVER
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 12
    --------------------------------------------- */

    console.log(
      "[STEP 12] Waiting for price button..."
    );

    const priceButton =
      await waitForPriceButton(page);

    console.log(
      "[STEP 12] Price button unlocked."
    );

    /* ---------------------------------------------
       STEP 13
    --------------------------------------------- */

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
      console.log(
        "[STEP 13] Cookie popup still visible. Handling again..."
      );

      await safeHandleCookies(page);
    }

    /* ---------------------------------------------
       STEP 14
    --------------------------------------------- */

    console.log(
      "[STEP 14] Finding price button..."
    );

    const finalButton =
      await getPriceButton(page);

    if (!finalButton) {
      throw new Error(
        "Price button disappeared before click"
      );
    }

    const disabled =
      await withTimeout(
        finalButton.isDisabled(),
        2000,
        "Price button disabled check timed out"
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

    /* ---------------------------------------------
       STEP 15
    --------------------------------------------- */

    console.log(
      "[STEP 15] Preparing quote API diagnostic..."
    );

    let quoteResponseSeen = false;

    const responseListener = (response) => {
      const url = response.url();

      if (
        url.includes("/api/v2/items/") &&
        url.includes("/quote?opt=")
      ) {
        quoteResponseSeen = true;

        console.log(
          "[STEP 15] Quote response observed:",
          response.status(),
          url
        );
      }
    };

    page.on(
      "response",
      responseListener
    );

    console.log(
      "[STEP 15] Diagnostic ready."
    );

    /* ---------------------------------------------
       STEP 16
    --------------------------------------------- */

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

    /* ---------------------------------------------
       STEP 17
    --------------------------------------------- */

    console.log(
      "[STEP 17] Waiting for offer panel to update..."
    );

    await delay(1000);

    console.log(
      "[STEP 17] Quote response observed:",
      quoteResponseSeen
    );

    /* ---------------------------------------------
       STEP 18
    --------------------------------------------- */

    console.log(
      "[STEP 18] Polling offer panel data..."
    );

    const offerResult =
      await waitForOfferResult(
        page,
        25000
      );

    console.log(
      "[STEP 18] Valid offer data detected."
    );

    /* ---------------------------------------------
       STEP 19
    --------------------------------------------- */

    console.log(
      "[STEP 19] Reading offer panel..."
    );

    console.log(
      "\n========== OFFER PANEL ==========\n"
    );

    console.log(
      offerResult.text
    );

    /* ---------------------------------------------
       STEP 20
    --------------------------------------------- */

    console.log(
      "[STEP 20] Extracting price..."
    );

    const prices =
      extractPrices(
        offerResult.text
      );

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

    /*
     * Last displayed rupee price is the
     * current selling price on this store.
     */

    const price =
      prices[prices.length - 1];

    /* ---------------------------------------------
       STEP 21
    --------------------------------------------- */

    console.log(
      "[STEP 21] Extracting stock..."
    );

    const stock =
      extractStock(
        offerResult.text
      );

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

    page.removeListener(
      "response",
      responseListener
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