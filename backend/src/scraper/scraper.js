const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

// =========================================================
// HELPERS
// =========================================================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithTimeout(promise, timeoutMs, stepName) {
  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `HARD TIMEOUT: ${stepName} exceeded ${timeoutMs}ms`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise,
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function logMemory(label) {
  const memory = process.memoryUsage();

  console.log(
    `[MEMORY ${label}] RSS=${Math.round(
      memory.rss / 1024 / 1024
    )}MB HEAP=${Math.round(
      memory.heapUsed / 1024 / 1024
    )}MB`
  );
}

// =========================================================
// COOKIE SCRIM CHECK
// =========================================================

async function isCookieScrimVisible(page) {
  try {
    return await runWithTimeout(
      page.evaluate(() => {
        const scrim = document.querySelector(
          ".consent-scrim"
        );

        if (!scrim) return false;

        const style = window.getComputedStyle(scrim);

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      }),
      5000,
      "Cookie scrim check"
    );
  } catch {
    return false;
  }
}

// =========================================================
// SCRAPER
// =========================================================

async function scrapeProduct({
  productUrl,
  selectedOption
}) {
  console.log("\n================================");
  console.log("SCRAPING:", productUrl);
  console.log("OPTION:", selectedOption);
  console.log("================================");

  let browser = null;
  let context = null;
  let page = null;

  try {
    // =======================================================
    // STEP 1 - CHROMIUM
    // =======================================================

    console.log("[STEP 1] Launching Chromium...");
    logMemory("before-browser");

    browser = await runWithTimeout(
      chromium.launch({
        headless:
          process.env.HEADLESS === "true",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      }),
      20000,
      "Chromium launch"
    );

    console.log("[STEP 1] Chromium launched.");
    logMemory("after-browser");

    // =======================================================
    // STEP 2 - CONTEXT
    // =======================================================

    console.log(
      "[STEP 2] Creating browser context..."
    );

    context = await runWithTimeout(
      browser.newContext({
        viewport: {
          width: 1280,
          height: 800
        }
      }),
      10000,
      "Browser context creation"
    );

    console.log(
      "[STEP 2] Browser context created."
    );

    // =======================================================
    // STEP 3 - PAGE
    // =======================================================

    console.log(
      "[STEP 3] Creating browser page..."
    );

    page = await runWithTimeout(
      context.newPage(),
      10000,
      "Browser page creation"
    );

    console.log(
      "[STEP 3] Browser page created."
    );

    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);

    // =======================================================
    // STEP 4 - NETWORK DIAGNOSTICS
    // =======================================================

    console.log(
      "[STEP 4] Installing network diagnostics..."
    );

    page.on("request", (request) => {
      const url = request.url();

      if (
        url.includes("/api/v2/items/") ||
        url.includes("/quote")
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
        url.includes("/api/v2/items/") ||
        url.includes("/quote")
      ) {
        console.log(
          "<<< QUOTE RESPONSE:",
          response.status(),
          url
        );
      }
    });

    page.on("requestfailed", (request) => {
      const url = request.url();

      if (
        url.includes("/api/v2/items/") ||
        url.includes("/quote")
      ) {
        console.log(
          "XXX QUOTE REQUEST FAILED:",
          request.failure()?.errorText,
          url
        );
      }
    });

    console.log(
      "[STEP 4] Network diagnostics ready."
    );

    // =======================================================
    // STEP 5 - OPEN PRODUCT PAGE
    // =======================================================

    console.log(
      "[STEP 5] Opening product page..."
    );

    logMemory("before-page-goto");

    await runWithTimeout(
      page.goto(productUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      }),
      35000,
      "Product page navigation"
    );

    console.log(
      "[STEP 5] Product page loaded."
    );

    logMemory("after-page-goto");

    await delay(1000);

    console.log(
      "[STEP 5] Initial page preparation completed."
    );

    // =======================================================
    // STEP 6 - COOKIE BEFORE OPTION
    // =======================================================

    console.log(
      "[STEP 6] Checking cookie consent before option selection..."
    );

    await runWithTimeout(
      handleCookies(page),
      15000,
      "Initial cookie handling"
    );

    console.log(
      "[STEP 6] Cookie handling completed."
    );

    console.log(
      "[STEP 6A] Moving to option selection..."
    );

    await delay(500);

    console.log(
      "[STEP 6B] Delay completed."
    );

    // =======================================================
    // STEP 7 - OPTION SELECTION
    // =======================================================

    console.log(
      "[STEP 7] Selecting option:",
      selectedOption
    );

    const escapedOption =
      selectedOption.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    console.log(
      "[STEP 7A] Creating option locator..."
    );

    const optionButton = page
      .locator("button")
      .filter({
        hasText: new RegExp(
          `^${escapedOption}$`,
          "i"
        )
      })
      .first();

    console.log(
      "[STEP 7B] Option locator created."
    );

    console.log(
      "[STEP 7C] Counting matching option buttons..."
    );

    const optionCount = await runWithTimeout(
      optionButton.count(),
      10000,
      "Option button count"
    );

    console.log(
      "[STEP 7D] Matching option buttons:",
      optionCount
    );

    if (optionCount === 0) {
      throw new Error(
        `Selected option not found: ${selectedOption}`
      );
    }

    console.log(
      "[STEP 7E] Waiting for option button..."
    );

    await runWithTimeout(
      optionButton.waitFor({
        state: "visible",
        timeout: 10000
      }),
      12000,
      "Option button visibility"
    );

    console.log(
      "[STEP 7F] Option button visible."
    );

    console.log(
      "[STEP 7G] Clicking option..."
    );

    await runWithTimeout(
      optionButton.click({
        timeout: 10000
      }),
      12000,
      "Option button click"
    );

    console.log(
      "[STEP 7H] Selected option:",
      selectedOption
    );

    await delay(1000);

    console.log(
      "[STEP 7I] Option selection completed."
    );

    // =======================================================
    // STEP 8 - OFFER PANEL
    // =======================================================

    console.log(
      "[STEP 8] Preparing offer panel..."
    );

    const offerPanel = page
      .locator(".offer-panel.offer-locked")
      .first();

    console.log(
      "[STEP 8A] Waiting for locked offer panel..."
    );

    await runWithTimeout(
      offerPanel.waitFor({
        state: "visible",
        timeout: 15000
      }),
      18000,
      "Locked offer panel"
    );

    console.log(
      "[STEP 8B] Locked offer panel found."
    );

    // =======================================================
    // HOVER FUNCTION
    // =======================================================

    async function performHoverMovements() {
      console.log(
        "[HOVER] Getting offer panel position..."
      );

      const box = await runWithTimeout(
        offerPanel.boundingBox(),
        5000,
        "Offer panel bounding box"
      );

      if (!box) {
        throw new Error(
          "Offer panel position not found"
        );
      }

      console.log(
        "[HOVER] Offer panel position found."
      );

      const centerX =
        box.x + box.width / 2;

      const centerY =
        box.y + box.height / 2;

      console.log(
        "[HOVER] Performing hover movements..."
      );

      for (let i = 0; i < 120; i++) {
        const x =
          centerX +
          Math.sin(i / 4) * 80 +
          (i % 5);

        const y =
          centerY +
          Math.cos(i / 5) * 20 +
          (i % 3);

        await page.mouse.move(x, y);

        await delay(50);
      }

      console.log(
        "[HOVER] 120 mouse movements completed."
      );
    }

    // =======================================================
    // STEP 9 - FIRST HOVER
    // =======================================================

    console.log(
      "[STEP 9] Performing first hover..."
    );

    await runWithTimeout(
      performHoverMovements(),
      25000,
      "First hover movements"
    );

    console.log(
      "[STEP 9] First hover completed."
    );

    logMemory("after-first-hover");

    // =======================================================
    // STEP 10 - COOKIE AFTER HOVER
    // =======================================================

    console.log(
      "[STEP 10] Checking cookie consent after hover..."
    );

    await runWithTimeout(
      handleCookies(page),
      15000,
      "Cookie handling after hover"
    );

    console.log(
      "[STEP 10] Cookie handling completed."
    );

    await delay(1000);

    let cookieVisible =
      await isCookieScrimVisible(page);

    console.log(
      "[STEP 10] Cookie scrim visible:",
      cookieVisible
    );

    if (cookieVisible) {
      console.log(
        "[STEP 10] Cookie scrim still blocking. Recovery..."
      );

      await runWithTimeout(
        handleCookies(page),
        15000,
        "Cookie recovery"
      );

      await delay(1000);

      cookieVisible =
        await isCookieScrimVisible(page);

      console.log(
        "[STEP 10] Cookie scrim after recovery:",
        cookieVisible
      );

      if (cookieVisible) {
        throw new Error(
          "Cookie scrim still blocking after recovery"
        );
      }
    }

    // =======================================================
    // STEP 11 - SECOND HOVER
    // =======================================================

    console.log(
      "[STEP 11] Repeating hover after cookie handling..."
    );

    await runWithTimeout(
      performHoverMovements(),
      25000,
      "Second hover movements"
    );

    console.log(
      "[STEP 11] Second hover completed."
    );

    await delay(1000);

    // =======================================================
    // STEP 12 - PRICE BUTTON
    // =======================================================

    console.log(
      "[STEP 12] Waiting for price button..."
    );

    const priceButtonSelector =
      'button[aria-label="Check today’s price"]';

    const startUnlock = Date.now();

    let unlocked = false;

    while (
      Date.now() - startUnlock <
      60000
    ) {
      const state = await runWithTimeout(
        page.evaluate((selector) => {
          const button =
            document.querySelector(selector);

          if (!button) {
            return {
              exists: false,
              disabled: true
            };
          }

          return {
            exists: true,
            disabled:
              !!button.disabled
          };
        }, priceButtonSelector),
        5000,
        "Price button state check"
      );

      if (
        state.exists &&
        !state.disabled
      ) {
        unlocked = true;
        break;
      }

      await delay(1000);
    }

    if (!unlocked) {
      throw new Error(
        "Price button did not unlock within 60 seconds"
      );
    }

    console.log(
      "[STEP 12] Price button unlocked."
    );

    // =======================================================
    // STEP 13 - FINAL COOKIE CHECK
    // =======================================================

    console.log(
      "[STEP 13] Final cookie check..."
    );

    cookieVisible =
      await isCookieScrimVisible(page);

    console.log(
      "[STEP 13] Cookie scrim visible:",
      cookieVisible
    );

    if (cookieVisible) {
      await runWithTimeout(
        handleCookies(page),
        15000,
        "Final cookie recovery"
      );

      await delay(500);

      cookieVisible =
        await isCookieScrimVisible(page);

      if (cookieVisible) {
        throw new Error(
          "Cookie scrim still blocking price button"
        );
      }
    }

    // =======================================================
    // STEP 14 - PRICE BUTTON LOCATOR
    // =======================================================

    console.log(
      "[STEP 14] Finding price button..."
    );

    const priceButton =
      page
        .locator(priceButtonSelector)
        .first();

    await runWithTimeout(
      priceButton.waitFor({
        state: "visible",
        timeout: 10000
      }),
      12000,
      "Price button visibility"
    );

    const disabled =
      await runWithTimeout(
        priceButton.isDisabled(),
        5000,
        "Price button disabled check"
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

    // =======================================================
    // STEP 15 - QUOTE RESPONSE
    // =======================================================

    console.log(
      "[STEP 15] Preparing quote API listener..."
    );

    const quoteResponsePromise =
      page.waitForResponse(
        (response) => {
          const url = response.url();

          return (
            url.includes("/api/v2/items/") &&
            url.includes("/quote?opt=")
          );
        },
        {
          timeout: 30000
        }
      )
      .catch(() => null);

    console.log(
      "[STEP 15] Quote listener ready."
    );

    // =======================================================
    // STEP 16 - REAL PLAYWRIGHT CLICK
    // =======================================================

    console.log(
      "[STEP 16] Clicking price button..."
    );

    let clicked = false;

    try {
      await runWithTimeout(
        (async () => {
          await priceButton.scrollIntoViewIfNeeded();

          await priceButton.click({
            timeout: 10000
          });
        })(),
        12000,
        "Price button Playwright click"
      );

      clicked = true;

      console.log(
        "[STEP 16] Playwright click completed."
      );

    } catch (error) {
      console.log(
        "[STEP 16] Playwright click failed:",
        error.message
      );
    }

    // =======================================================
    // MOUSE FALLBACK
    // =======================================================

    if (!clicked) {
      console.log(
        "[STEP 16] Trying mouse fallback..."
      );

      const box =
        await runWithTimeout(
          priceButton.boundingBox(),
          5000,
          "Price button bounding box"
        );

      if (!box) {
        throw new Error(
          "Price button disappeared before mouse click"
        );
      }

      await runWithTimeout(
        page.mouse.click(
          box.x + box.width / 2,
          box.y + box.height / 2
        ),
        5000,
        "Price button mouse click"
      );

      console.log(
        "[STEP 16] Mouse click completed."
      );
    }

    // =======================================================
    // STEP 17 - QUOTE RESPONSE
    // =======================================================

    console.log(
      "[STEP 17] Waiting for quote API response..."
    );

    const quoteResponse =
      await quoteResponsePromise;

    if (!quoteResponse) {
      throw new Error(
        "Quote API response not received within 30 seconds"
      );
    }

    console.log(
      "[STEP 17] Quote API response:",
      quoteResponse.status()
    );

    console.log(
      "[STEP 17] Quote URL:",
      quoteResponse.url()
    );

    // =======================================================
    // STEP 18 - OFFER DATA
    // =======================================================

    console.log(
      "[STEP 18] Waiting for offer panel data..."
    );

    const panelStart = Date.now();

    let panelReady = false;

    while (
      Date.now() - panelStart <
      20000
    ) {
      const text =
        await runWithTimeout(
          page
            .locator(".offer-panel")
            .first()
            .innerText()
            .catch(() => ""),
          5000,
          "Offer panel text check"
        );

      if (
        /₹/.test(text) ||
        /SOLD OUT/i.test(text) ||
        /OUT OF STOCK/i.test(text) ||
        /AVAILABLE/i.test(text) ||
        /REMAINING/i.test(text) ||
        /CHECK AGAIN/i.test(text)
      ) {
        panelReady = true;
        break;
      }

      await delay(500);
    }

    if (!panelReady) {
      throw new Error(
        "Offer panel data did not load within 20 seconds"
      );
    }

    console.log(
      "[STEP 18] Offer panel data detected."
    );

    // =======================================================
    // STEP 19 - READ PANEL
    // =======================================================

    console.log(
      "[STEP 19] Reading offer panel..."
    );

    const panel =
      page
        .locator(".offer-panel")
        .first();

    const panelText =
      await runWithTimeout(
        panel.innerText(),
        10000,
        "Offer panel text extraction"
      );

    console.log(
      "========== OFFER PANEL =========="
    );

    console.log(panelText);

    const cleanText =
      panelText
        .replace(
          /[\u200B\u200C\u200D\uFEFF]/g,
          ""
        )
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // =======================================================
    // STEP 20 - PRICE
    // =======================================================

    console.log(
      "[STEP 20] Extracting price..."
    );

    const prices =
      cleanText.match(
        /₹\s*([\d,]+(?:\.\d{1,2})?)/g
      );

    if (
      !prices ||
      prices.length === 0
    ) {
      throw new Error(
        "Price not found in offer panel"
      );
    }

    console.log(
      "Detected prices:",
      prices
    );

    const lastPrice =
      prices[prices.length - 1];

    const price =
      Number(
        lastPrice.replace(
          /[₹,\s]/g,
          ""
        )
      );

    if (!Number.isFinite(price)) {
      throw new Error(
        "Invalid price extracted"
      );
    }

    // =======================================================
    // STEP 21 - STOCK
    // =======================================================

    console.log(
      "[STEP 21] Extracting stock..."
    );

    let stock = null;

    if (/SOLD OUT/i.test(cleanText)) {
      stock = "SOLD OUT";
    }

    if (
      !stock &&
      /OUT OF STOCK/i.test(cleanText)
    ) {
      stock = "OUT OF STOCK";
    }

    if (!stock) {
      const match =
        cleanText.match(
          /AVAILABLE\s*\(\s*(\d+)\s*\)/i
        );

      if (match) {
        stock =
          `AVAILABLE (${match[1]})`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /(\d+)\s+AVAILABLE\b/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /STOCK\s*:\s*(\d+)\s+REMAINING/i
        );

      if (match) {
        stock =
          `STOCK: ${match[1]} AVAILABLE`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /(\d+)\s+REMAINING/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /LAST FEW\s*:\s*(\d+)/i
        );

      if (match) {
        stock =
          `LAST FEW: ${match[1]}`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /ONLY\s+(\d+)\s+LEFT/i
        );

      if (match) {
        stock =
          `ONLY ${match[1]} LEFT`;
      }
    }

    if (!stock) {
      const match =
        cleanText.match(
          /(\d+)\s+LEFT/i
        );

      if (match) {
        stock =
          `${match[1]} LEFT`;
      }
    }

    if (
      !stock &&
      /IN STOCK/i.test(cleanText)
    ) {
      stock = "IN STOCK";
    }

    if (
      !stock &&
      /\bAVAILABLE\b/i.test(cleanText)
    ) {
      stock = "AVAILABLE";
    }

    if (!stock) {
      throw new Error(
        "Stock information not found"
      );
    }

    // =======================================================
    // SUCCESS
    // =======================================================

    console.log(
      "PRICE:",
      price
    );

    console.log(
      "STOCK:",
      stock
    );

    console.log(
      "SCRAPE SUCCESS"
    );

    return {
      success: true,
      price,
      stock
    };

  } catch (error) {
    // =======================================================
    // FAILURE
    // =======================================================

    console.error(
      "\n================================"
    );

    console.error(
      "SCRAPE FAILED"
    );

    console.error(
      "ERROR:",
      error.message
    );

    console.error(
      "URL:",
      productUrl
    );

    console.error(
      "OPTION:",
      selectedOption
    );

    console.error(
      "================================\n"
    );

    return {
      success: false,
      error: error.message
    };

  } finally {
    // =======================================================
    // CLEANUP
    // =======================================================

    console.log(
      "Starting browser cleanup..."
    );

    if (page) {
      try {
        await page.close();
        console.log("Page closed.");
      } catch (error) {
        console.log(
          "Page close warning:",
          error.message
        );
      }
    }

    if (context) {
      try {
        await context.close();
        console.log("Context closed.");
      } catch (error) {
        console.log(
          "Context close warning:",
          error.message
        );
      }
    }

    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed.");
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
  scrapeProduct
};