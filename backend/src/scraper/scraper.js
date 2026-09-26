const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, message) {
  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
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

async function safeHandleCookies(page, label) {
  console.log(`[${label}] Cookie handling START`);

  try {
    await withTimeout(
      handleCookies(page),
      10000,
      `${label}: cookie handling timed out`
    );

    console.log(`[${label}] Cookie handling END`);
  } catch (error) {
    console.error(
      `[${label}] Cookie handling error:`,
      error.message
    );

    throw error;
  }
}

async function getCookieScrimVisible(page, label) {
  console.log(`[${label}] Checking cookie scrim...`);

  try {
    const result = await withTimeout(
      (async () => {
        const scrim =
          page.locator(".consent-scrim").first();

        const count = await scrim.count();

        if (count === 0) {
          return false;
        }

        return await scrim.isVisible();
      })(),
      3000,
      `${label}: cookie scrim check timed out`
    );

    console.log(
      `[${label}] Cookie scrim visible:`,
      result
    );

    return result;
  } catch (error) {
    console.log(
      `[${label}] Cookie scrim check failed:`,
      error.message
    );

    return false;
  }
}

async function hoverOfferPanel(
  page,
  offerPanel,
  label
) {
  console.log(
    `[${label}] Getting offer panel position...`
  );

  const box = await withTimeout(
    offerPanel.first().boundingBox(),
    5000,
    `${label}: offer panel bounding box timed out`
  );

  if (!box) {
    throw new Error(
      `${label}: offer panel bounding box not found`
    );
  }

  console.log(
    `[${label}] Offer panel position found.`
  );

  const centerX =
    box.x + box.width / 2;

  const centerY =
    box.y + box.height / 2;

  console.log(
    `[${label}] Performing hover movements...`
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

    await withTimeout(
      page.mouse.move(x, y),
      3000,
      `${label}: mouse movement timed out`
    );

    await delay(50);
  }

  console.log(
    `[${label}] 120 mouse movements completed.`
  );
}

function normalizePriceText(text) {
  return text
    // zero-width characters
    .replace(
      /[\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g,
      ""
    )

    // non-breaking spaces
    .replace(
      /[\u00A0\u202F]/g,
      " "
    )

    // full-width digits -> normal digits
    .replace(
      /[\uFF10-\uFF19]/g,
      (char) =>
        String.fromCharCode(
          char.charCodeAt(0) -
            0xFF10 +
            48
        )
    );
}

function extractPrices(text) {
  const normalized =
    normalizePriceText(text);

  const lines =
    normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const prices = [];

  for (const line of lines) {
    const rupeeIndex =
      line.indexOf("₹");

    if (rupeeIndex === -1) {
      continue;
    }

    const afterRupee =
      line
        .slice(rupeeIndex + 1)
        .trim();

    /*
     * Keep digits, comma and decimal.
     *
     * Example:
     * ₹21,946 -> 21,946
     *
     * Example with invisible chars:
     * ₹​2​1​ ​9​4​6 -> 21946
     */
    const cleaned =
      afterRupee
        .replace(
          /[^\d.,]/g,
          ""
        );

    if (!cleaned) {
      continue;
    }

    const numeric =
      Number(
        cleaned.replace(/,/g, "")
      );

    if (
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      prices.push(numeric);
    }
  }

  return prices;
}

function extractStock(text) {
  const normalized =
    normalizePriceText(text);

  // SOLD OUT
  if (/SOLD OUT/i.test(normalized)) {
    return "SOLD OUT";
  }

  // OUT OF STOCK
  if (/OUT OF STOCK/i.test(normalized)) {
    return "OUT OF STOCK";
  }

  // AVAILABLE (84)
  const availableBracket =
    normalized.match(
      /AVAILABLE\s*\(\s*(\d+)\s*\)/i
    );

  if (availableBracket) {
    return `AVAILABLE (${availableBracket[1]})`;
  }

  // 84 AVAILABLE
  const numberAvailable =
    normalized.match(
      /(\d+)\s+AVAILABLE\b/i
    );

  if (numberAvailable) {
    return `${numberAvailable[1]} AVAILABLE`;
  }

  // 84 UNITS AVAILABLE
  const unitsAvailable =
    normalized.match(
      /(\d+)\s+UNITS?\s+AVAILABLE/i
    );

  if (unitsAvailable) {
    return `${unitsAvailable[1]} UNITS AVAILABLE`;
  }

  // STOCK: 68 REMAINING
  const stockRemaining =
    normalized.match(
      /STOCK\s*:\s*(\d+)\s+REMAINING/i
    );

  if (stockRemaining) {
    return `STOCK: ${stockRemaining[1]} REMAINING`;
  }

  // 68 REMAINING
  const remaining =
    normalized.match(
      /(\d+)\s+REMAINING/i
    );

  if (remaining) {
    return `${remaining[1]} REMAINING`;
  }

  // LAST FEW: 71
  const lastFew =
    normalized.match(
      /LAST FEW\s*:\s*(\d+)/i
    );

  if (lastFew) {
    return `LAST FEW: ${lastFew[1]}`;
  }

  // ONLY 5 LEFT
  const onlyLeft =
    normalized.match(
      /ONLY\s+(\d+)\s+LEFT/i
    );

  if (onlyLeft) {
    return `ONLY ${onlyLeft[1]} LEFT`;
  }

  // 5 LEFT
  const left =
    normalized.match(
      /(\d+)\s+LEFT/i
    );

  if (left) {
    return `${left[1]} LEFT`;
  }

  // IN STOCK
  if (/IN STOCK/i.test(normalized)) {
    return "IN STOCK";
  }

  // AVAILABLE
  if (/\bAVAILABLE\b/i.test(normalized)) {
    return "AVAILABLE";
  }

  return null;
}

async function readOfferPanel(page) {
  const panel =
    page
      .locator(".offer-panel")
      .first();

  const count =
    await withTimeout(
      panel.count(),
      3000,
      "Offer panel count timed out"
    );

  if (count === 0) {
    return null;
  }

  const text =
    await withTimeout(
      panel.innerText(),
      3000,
      "Offer panel text read timed out"
    );

  return text || "";
}

async function waitForOfferResult(
  page,
  timeoutMs = 20000
) {
  console.log(
    `[OFFER] Polling offer panel for up to ${timeoutMs}ms...`
  );

  const start =
    Date.now();

  let lastText = "";

  while (
    Date.now() - start <
    timeoutMs
  ) {
    try {
      const text =
        await readOfferPanel(page);

      if (text) {
        lastText = text;

        const prices =
          extractPrices(text);

        const stock =
          extractStock(text);

        /*
         * We need BOTH a price and stock.
         *
         * This prevents us from accepting an
         * old/partial panel state.
         */
        if (
          prices.length > 0 &&
          stock
        ) {
          console.log(
            "[OFFER] Valid price + stock detected."
          );

          return {
            text,
            prices,
            stock
          };
        }

        console.log(
          "[OFFER] Panel exists but result incomplete."
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
    `Offer panel did not produce valid price + stock within ${timeoutMs}ms. Last panel text: ${lastText.slice(
      0,
      500
    )}`
  );
}

async function scrapeProduct({
  productUrl,
  selectedOption
}) {
  console.log("\n================================");
  console.log(
    "SCRAPING:",
    productUrl
  );
  console.log(
    "OPTION:",
    selectedOption
  );
  console.log("================================");

  let browser = null;
  let context = null;
  let page = null;

  try {
    // ==================================================
    // STEP 1
    // ==================================================

    console.log(
      "[STEP 1] Launching Chromium..."
    );

    logMemory("before-browser");

    browser =
      await withTimeout(
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
        "Chromium launch timed out after 20 seconds"
      );

    console.log(
      "[STEP 1] Chromium launched."
    );

    logMemory("after-browser");

    // ==================================================
    // STEP 2
    // ==================================================

    console.log(
      "[STEP 2] Creating browser context..."
    );

    context =
      await withTimeout(
        browser.newContext(),
        10000,
        "Browser context creation timed out"
      );

    console.log(
      "[STEP 2] Browser context created."
    );

    // ==================================================
    // STEP 3
    // ==================================================

    console.log(
      "[STEP 3] Creating browser page..."
    );

    page =
      await withTimeout(
        context.newPage(),
        10000,
        "Browser page creation timed out"
      );

    console.log(
      "[STEP 3] Browser page created."
    );

    // ==================================================
    // STEP 4 - NETWORK DIAGNOSTICS
    // ==================================================

    console.log(
      "[STEP 4] Installing network diagnostics..."
    );

    page.on(
      "request",
      (request) => {
        const url =
          request.url();

        if (
          url.includes(
            "/api/v2/items/"
          )
        ) {
          console.log(
            ">>> QUOTE REQUEST:",
            request.method(),
            url
          );
        }
      }
    );

    page.on(
      "response",
      (response) => {
        const url =
          response.url();

        if (
          url.includes(
            "/api/v2/items/"
          )
        ) {
          console.log(
            "<<< QUOTE RESPONSE:",
            response.status(),
            url
          );
        }
      }
    );

    console.log(
      "[STEP 4] Network diagnostics ready."
    );

    // ==================================================
    // STEP 5 - PRODUCT PAGE
    // ==================================================

    console.log(
      "[STEP 5] Opening product page..."
    );

    logMemory(
      "before-page-goto"
    );

    await withTimeout(
      page.goto(
        productUrl,
        {
          waitUntil:
            "domcontentloaded",
          timeout: 20000
        }
      ),
      25000,
      "Product page load timed out"
    );

    console.log(
      "[STEP 5] Product page loaded."
    );

    logMemory(
      "after-page-goto"
    );

    await delay(1000);

    console.log(
      "[STEP 5] Initial page preparation completed."
    );

    // ==================================================
    // STEP 6 - COOKIE
    // ==================================================

    console.log(
      "[STEP 6] Checking cookie consent before option selection..."
    );

    await safeHandleCookies(
      page,
      "STEP 6"
    );

    console.log(
      "[STEP 6] Cookie handling completed."
    );

    // ==================================================
    // STEP 6A / 6B
    // ==================================================

    console.log(
      "[STEP 6A] Moving to option selection..."
    );

    await delay(500);

    console.log(
      "[STEP 6B] Delay completed."
    );

    // ==================================================
    // STEP 7 - OPTION
    // ==================================================

    console.log(
      "[STEP 7] Selecting option:",
      selectedOption
    );

    console.log(
      "[STEP 7A] Creating option locator..."
    );

    const escapedOption =
      selectedOption.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const optionButton =
      page
        .locator("button")
        .filter({
          hasText:
            new RegExp(
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

    const optionCount =
      await withTimeout(
        optionButton.count(),
        5000,
        "Option button count timed out"
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

    await withTimeout(
      optionButton.waitFor({
        state: "visible",
        timeout: 10000
      }),
      12000,
      "Option button did not become visible"
    );

    console.log(
      "[STEP 7F] Option button visible."
    );

    console.log(
      "[STEP 7G] Clicking option..."
    );

    await withTimeout(
      optionButton.click({
        timeout: 10000
      }),
      12000,
      "Option button click timed out"
    );

    console.log(
      "[STEP 7H] Selected option:",
      selectedOption
    );

    await delay(500);

    console.log(
      "[STEP 7I] Option selection completed."
    );

    // ==================================================
    // STEP 8 - OFFER PANEL
    // ==================================================

    console.log(
      "[STEP 8] Preparing offer panel..."
    );

    const offerPanel =
      page.locator(
        ".offer-panel.offer-locked"
      );

    console.log(
      "[STEP 8A] Waiting for locked offer panel..."
    );

    await withTimeout(
      offerPanel.first().waitFor({
        state: "visible",
        timeout: 15000
      }),
      17000,
      "Locked offer panel not found"
    );

    console.log(
      "[STEP 8B] Locked offer panel found."
    );

    // ==================================================
    // STEP 9 - HOVER
    // ==================================================

    console.log(
      "[STEP 9] Performing first hover..."
    );

    await hoverOfferPanel(
      page,
      offerPanel,
      "HOVER"
    );

    console.log(
      "[STEP 9] First hover completed."
    );

    logMemory(
      "after-first-hover"
    );

    // ==================================================
    // STEP 10 - COOKIE AFTER HOVER
    // ==================================================

    console.log(
      "[STEP 10] Checking cookie consent after hover..."
    );

    await safeHandleCookies(
      page,
      "STEP 10"
    );

    console.log(
      "[STEP 10] Cookie handling completed."
    );

    const scrimVisible =
      await getCookieScrimVisible(
        page,
        "STEP 10"
      );

    if (scrimVisible) {
      console.log(
        "[STEP 10] Cookie scrim still blocking. Trying recovery..."
      );

      await safeHandleCookies(
        page,
        "STEP 10 RECOVERY"
      );

      await delay(500);

      const stillVisible =
        await getCookieScrimVisible(
          page,
          "STEP 10 RECOVERY"
        );

      if (stillVisible) {
        throw new Error(
          "Cookie overlay still blocking after recovery"
        );
      }

      console.log(
        "[STEP 10] Cookie recovery successful."
      );
    }

    // ==================================================
    // STEP 11 - SECOND HOVER
    // ==================================================

    console.log(
      "[STEP 11] Repeating hover after cookie handling..."
    );

    await hoverOfferPanel(
      page,
      offerPanel,
      "HOVER RECOVERY"
    );

    console.log(
      "[STEP 11] Second hover completed."
    );

    // ==================================================
    // STEP 12 - PRICE BUTTON
    // ==================================================

    console.log(
      "[STEP 12] Waiting for price button..."
    );

    const priceButtonSelector =
      'button[aria-label="Check today’s price"]';

    await withTimeout(
      page.waitForFunction(
        (selector) => {
          const button =
            document.querySelector(
              selector
            );

          return (
            button &&
            !button.disabled
          );
        },
        priceButtonSelector,
        {
          timeout: 30000
        }
      ),
      32000,
      "Price button did not unlock"
    );

    console.log(
      "[STEP 12] Price button unlocked."
    );

    // ==================================================
    // STEP 13 - FINAL COOKIE
    // ==================================================

    console.log(
      "[STEP 13] Final cookie check..."
    );

    const finalScrim =
      await getCookieScrimVisible(
        page,
        "STEP 13"
      );

    if (finalScrim) {
      console.log(
        "[STEP 13] Scrim still visible. Recovering..."
      );

      await safeHandleCookies(
        page,
        "STEP 13 RECOVERY"
      );

      await delay(500);

      const finalStillVisible =
        await getCookieScrimVisible(
          page,
          "STEP 13 RECOVERY"
        );

      if (finalStillVisible) {
        throw new Error(
          "Cookie overlay still visible before price click"
        );
      }
    }

    // ==================================================
    // STEP 14 - PRICE BUTTON
    // ==================================================

    console.log(
      "[STEP 14] Finding price button..."
    );

    const priceButton =
      page.locator(
        priceButtonSelector
      );

    await withTimeout(
      priceButton.waitFor({
        state: "visible",
        timeout: 10000
      }),
      12000,
      "Price button not visible"
    );

    const disabled =
      await withTimeout(
        priceButton.isDisabled(),
        3000,
        "Price button disabled check timed out"
      );

    console.log(
      "[STEP 14] Price button disabled:",
      disabled
    );

    if (disabled) {
      throw new Error(
        "Price button is disabled before click"
      );
    }

    // ==================================================
    // STEP 15 - API DIAGNOSTIC ONLY
    // ==================================================

    console.log(
      "[STEP 15] Preparing quote API diagnostic..."
    );

    /*
     * IMPORTANT:
     *
     * We DO NOT depend on this promise.
     * The previous version was getting stuck because
     * the quote response listener was unreliable.
     *
     * We only use the page response event as diagnostic.
     */

    let quoteResponseSeen = false;

    const responseListener =
      (response) => {
        const url =
          response.url();

        if (
          url.includes(
            "/api/v2/items/"
          ) &&
          url.includes(
            "/quote?opt="
          )
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

    // ==================================================
    // STEP 16 - CLICK
    // ==================================================

    console.log(
      "[STEP 16] Clicking price button..."
    );

    await withTimeout(
      priceButton.click({
        timeout: 10000
      }),
      12000,
      "Price button click timed out"
    );

    console.log(
      "[STEP 16] Playwright click completed."
    );

    // ==================================================
    // STEP 17 - DO NOT WAIT FOR API
    // ==================================================

    console.log(
      "[STEP 17] Waiting for offer panel to update..."
    );

    /*
     * DO NOT wait for quoteResponsePromise.
     *
     * The page itself is the source of truth.
     */

    await delay(1000);

    console.log(
      "[STEP 17] Quote response observed:",
      quoteResponseSeen
    );

    // ==================================================
    // STEP 18 - DIRECT OFFER POLLING
    // ==================================================

    console.log(
      "[STEP 18] Polling offer panel data..."
    );

    const result =
      await waitForOfferResult(
        page,
        20000
      );

    console.log(
      "[STEP 18] Valid offer data detected."
    );

    // Remove listener
    page.off(
      "response",
      responseListener
    );

    // ==================================================
    // STEP 19 - OFFER PANEL
    // ==================================================

    console.log(
      "[STEP 19] Reading offer panel..."
    );

    console.log(
      "\n========== OFFER PANEL =========="
    );

    console.log(
      result.text
    );

    // ==================================================
    // STEP 20 - PRICE
    // ==================================================

    console.log(
      "[STEP 20] Extracting price..."
    );

    console.log(
      "Detected prices:",
      result.prices
    );

    const price =
      result.prices[
        result.prices.length - 1
      ];

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Invalid price extracted: ${price}`
      );
    }

    // ==================================================
    // STEP 21 - STOCK
    // ==================================================

    console.log(
      "[STEP 21] Extracting stock..."
    );

    const stock =
      result.stock;

    if (!stock) {
      throw new Error(
        "Stock information not found"
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
      "SCRAPE SUCCESS"
    );

    return {
      success: true,
      price,
      stock
    };

  } catch (error) {
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
      "PRODUCT:",
      productUrl
    );

    console.error(
      "OPTION:",
      selectedOption
    );

    console.error(
      "================================"
    );

    return {
      success: false,
      error: error.message
    };

  } finally {
    // ==================================================
    // CLEANUP
    // ==================================================

    console.log(
      "Starting browser cleanup..."
    );

    if (page) {
      try {
        await withTimeout(
          page.close({
            runBeforeUnload: false
          }),
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
  scrapeProduct
};