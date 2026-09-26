const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

// =========================================================
// HARD TIMEOUT HELPER
// =========================================================

async function runWithTimeout(
  promise,
  timeoutMs,
  stepName
) {
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

// =========================================================
// MEMORY LOG
// =========================================================

function logMemory(label) {
  const memory = process.memoryUsage();

  console.log(
    `[MEMORY ${label}]`,
    `RSS=${Math.round(memory.rss / 1024 / 1024)}MB`,
    `HEAP=${Math.round(memory.heapUsed / 1024 / 1024)}MB`
  );
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
    // STEP 1 - LAUNCH CHROMIUM
    // =======================================================

    console.log("[STEP 1] Launching Chromium...");
    logMemory("before-browser");

    browser = await runWithTimeout(
      chromium.launch({
        headless:
          process.env.HEADLESS === "true"
      }),
      20000,
      "Chromium launch"
    );

    console.log(
      "[STEP 1] Chromium launched."
    );

    logMemory("after-browser");

    // =======================================================
    // STEP 2 - CONTEXT
    // =======================================================

    console.log(
      "[STEP 2] Creating browser context..."
    );

    context = await runWithTimeout(
      browser.newContext(),
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
    // STEP 4 - OPEN PRODUCT PAGE
    // =======================================================

    console.log(
      "[STEP 4] Opening product page..."
    );

    logMemory("before-page-goto");

    // IMPORTANT:
    // page.goto has Playwright timeout + our own hard timeout.
    await runWithTimeout(
      page.goto(productUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      }),
      35000,
      "Product page navigation"
    );

    console.log(
      "[STEP 4] Product page loaded."
    );

    logMemory("after-page-goto");

    await page.waitForTimeout(1500);

    console.log(
      "[STEP 4] Initial page preparation completed."
    );

    // =======================================================
    // STEP 5 - COOKIE BEFORE OPTION
    // =======================================================

    console.log(
      "[STEP 5] Checking cookie consent before option selection..."
    );

    await runWithTimeout(
      handleCookies(page),
      15000,
      "Initial cookie handling"
    );

    console.log(
      "[STEP 5] Cookie handling completed."
    );

    await page.waitForTimeout(500);

    // =======================================================
    // STEP 6 - SELECT OPTION
    // =======================================================

    console.log(
      "[STEP 6] Selecting option:",
      selectedOption
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
          hasText: new RegExp(
            `^${escapedOption}$`,
            "i"
          )
        })
        .first();

    const optionCount =
      await optionButton.count();

    console.log(
      "[STEP 6] Matching option buttons:",
      optionCount
    );

    if (optionCount === 0) {
      throw new Error(
        `Selected option not found: ${selectedOption}`
      );
    }

    await runWithTimeout(
      optionButton.waitFor({
        state: "visible",
        timeout: 10000
      }),
      12000,
      "Option button visibility"
    );

    await runWithTimeout(
      optionButton.click({
        timeout: 10000
      }),
      12000,
      "Option button click"
    );

    console.log(
      "[STEP 6] Selected option:",
      selectedOption
    );

    await page.waitForTimeout(500);

    // =======================================================
    // STEP 7 - OFFER PANEL
    // =======================================================

    console.log(
      "[STEP 7] Preparing offer panel..."
    );

    const offerPanel =
      page
        .locator(
          ".offer-panel.offer-locked"
        )
        .first();

    console.log(
      "[STEP 7] Waiting for locked offer panel..."
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
      "[STEP 7] Locked offer panel found."
    );

    // =======================================================
    // HOVER FUNCTION
    // =======================================================

    async function performHoverMovements() {
      console.log(
        "[HOVER] Getting offer panel position..."
      );

      const box =
        await offerPanel.boundingBox();

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

        await page.waitForTimeout(50);
      }

      console.log(
        "[HOVER] 120 mouse movements completed."
      );
    }

    // =======================================================
    // STEP 8 - FIRST HOVER
    // =======================================================

    console.log(
      "[STEP 8] First hover sequence..."
    );

    await runWithTimeout(
      performHoverMovements(),
      25000,
      "First hover movements"
    );

    logMemory("after-first-hover");

    // =======================================================
    // STEP 9 - COOKIE AFTER HOVER
    // =======================================================

    console.log(
      "[STEP 9] Checking cookie consent after hover..."
    );

    await runWithTimeout(
      handleCookies(page),
      15000,
      "Cookie handling after hover"
    );

    console.log(
      "[STEP 9] Cookie handling completed."
    );

    await page.waitForTimeout(1000);

    // =======================================================
    // COOKIE SCRIM CHECK
    // =======================================================

    async function isCookieScrimVisible() {
      try {
        const scrim =
          page
            .locator(".consent-scrim")
            .first();

        if (
          (await scrim.count()) === 0
        ) {
          return false;
        }

        return await scrim
          .isVisible()
          .catch(() => false);

      } catch {
        return false;
      }
    }

    let cookieScrimVisible =
      await isCookieScrimVisible();

    console.log(
      "[STEP 9] Cookie scrim visible after hover:",
      cookieScrimVisible
    );

    // =======================================================
    // COOKIE RECOVERY
    // =======================================================

    if (cookieScrimVisible) {
      console.log(
        "[STEP 9] Cookie scrim still blocking. Recovery..."
      );

      await runWithTimeout(
        handleCookies(page),
        15000,
        "Cookie recovery"
      );

      await page.waitForTimeout(1000);

      cookieScrimVisible =
        await isCookieScrimVisible();

      console.log(
        "[STEP 9] Cookie scrim visible after recovery:",
        cookieScrimVisible
      );

      if (cookieScrimVisible) {
        throw new Error(
          "Cookie scrim is still blocking after recovery"
        );
      }
    }

    // =======================================================
    // STEP 10 - SECOND HOVER
    // =======================================================

    // IMPORTANT:
    // This was part of the previously successful flow.
    // DO NOT REMOVE.

    console.log(
      "[STEP 10] Repeating hover movements after cookie handling..."
    );

    await runWithTimeout(
      performHoverMovements(),
      25000,
      "Second hover movements"
    );

    logMemory("after-second-hover");

    await page.waitForTimeout(2000);

    console.log(
      "[STEP 10] Second hover completed."
    );

    // =======================================================
    // STEP 11 - PRICE BUTTON UNLOCK
    // =======================================================

    console.log(
      "[STEP 11] Waiting for price button to unlock..."
    );

    const priceButtonSelector =
      'button[aria-label="Check today’s price"]';

    const unlockStart =
      Date.now();

    let priceButtonUnlocked = false;

    while (
      Date.now() - unlockStart <
      60000
    ) {
      try {
        const state =
          await page.evaluate(
            selector => {
              const button =
                document.querySelector(
                  selector
                );

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
            },
            priceButtonSelector
          );

        if (
          state.exists &&
          !state.disabled
        ) {
          priceButtonUnlocked = true;
          break;
        }

      } catch (error) {
        console.log(
          "[STEP 11] Button check warning:",
          error.message
        );
      }

      await page.waitForTimeout(1000);
    }

    if (!priceButtonUnlocked) {
      throw new Error(
        "Price button did not unlock within 60 seconds"
      );
    }

    console.log(
      "[STEP 11] Price button unlocked."
    );

    logMemory("price-button-unlocked");

    // =======================================================
    // STEP 12 - FINAL COOKIE CHECK
    // =======================================================

    console.log(
      "[STEP 12] Final cookie check before price click..."
    );

    await runWithTimeout(
      handleCookies(page),
      15000,
      "Final cookie handling"
    );

    await page.waitForTimeout(500);

    cookieScrimVisible =
      await isCookieScrimVisible();

    console.log(
      "[STEP 12] Cookie scrim visible:",
      cookieScrimVisible
    );

    if (cookieScrimVisible) {
      throw new Error(
        "Cookie scrim is blocking the price button"
      );
    }

    // =======================================================
    // STEP 13 - FIND PRICE BUTTON
    // =======================================================

    console.log(
      "[STEP 13] Finding price button..."
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
      await priceButton.isDisabled();

    console.log(
      "[STEP 13] Price button disabled:",
      disabled
    );

    if (disabled) {
      throw new Error(
        "Price button is disabled before click"
      );
    }

    // =======================================================
    // STEP 14 - QUOTE RESPONSE LISTENER
    // =======================================================

    console.log(
      "[STEP 14] Preparing quote API listener..."
    );

    let quoteResponseReceived = false;

    const quoteResponsePromise =
      page.waitForResponse(
        response => {
          const url =
            response.url();

          return (
            url.includes(
              "/api/v2/items/"
            ) &&
            url.includes(
              "/quote?opt="
            )
          );
        },
        {
          timeout: 30000
        }
      )
      .then(response => {
        quoteResponseReceived = true;
        return response;
      })
      .catch(error => {
        return null;
      });

    // =======================================================
    // STEP 15 - CLICK PRICE BUTTON
    // =======================================================

    console.log(
      "[STEP 15] Clicking price button..."
    );

    let clickCompleted = false;

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

      clickCompleted = true;

      console.log(
        "[STEP 15] Playwright price button click completed."
      );

    } catch (error) {
      console.log(
        "[STEP 15] Playwright click failed:",
        error.message
      );
    }

    // =======================================================
    // MOUSE FALLBACK
    // =======================================================

    if (!clickCompleted) {
      console.log(
        "[STEP 15] Trying mouse click fallback..."
      );

      const box =
        await priceButton.boundingBox();

      if (!box) {
        throw new Error(
          "Price button has no bounding box for mouse fallback"
        );
      }

      await runWithTimeout(
        page.mouse.click(
          box.x + box.width / 2,
          box.y + box.height / 2
        ),
        10000,
        "Price button mouse click"
      );

      console.log(
        "[STEP 15] Mouse click fallback completed."
      );
    }

    // =======================================================
    // STEP 16 - QUOTE API
    // =======================================================

    console.log(
      "[STEP 16] Waiting for quote API response..."
    );

    const quoteResponse =
      await quoteResponsePromise;

    if (!quoteResponse) {
      throw new Error(
        "Quote API response not received within 30 seconds"
      );
    }

    console.log(
      "[STEP 16] Quote API response received:",
      quoteResponse.status()
    );

    console.log(
      "[STEP 16] Quote URL:",
      quoteResponse.url()
    );

    // =======================================================
    // STEP 17 - OFFER PANEL DATA
    // =======================================================

    console.log(
      "[STEP 17] Waiting for offer panel data..."
    );

    const panelStart =
      Date.now();

    let panelDataDetected = false;

    while (
      Date.now() - panelStart <
      20000
    ) {
      try {
        const text =
          await page
            .locator(".offer-panel")
            .first()
            .innerText()
            .catch(() => "");

        if (
          /₹/.test(text) ||
          /SOLD OUT/i.test(text) ||
          /OUT OF STOCK/i.test(text) ||
          /AVAILABLE/i.test(text) ||
          /REMAINING/i.test(text) ||
          /CHECK AGAIN/i.test(text)
        ) {
          panelDataDetected = true;
          break;
        }

      } catch (error) {
        console.log(
          "[STEP 17] Offer panel check warning:",
          error.message
        );
      }

      await page.waitForTimeout(500);
    }

    if (!panelDataDetected) {
      throw new Error(
        "Offer panel data did not load within 20 seconds"
      );
    }

    console.log(
      "[STEP 17] Offer panel data detected."
    );

    // =======================================================
    // STEP 18 - READ OFFER PANEL
    // =======================================================

    console.log(
      "[STEP 18] Reading offer panel..."
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

    console.log(
      panelText
    );

    // =======================================================
    // CLEAN TEXT
    // =======================================================

    const cleanPanelText =
      panelText
        .replace(
          /[\u200B\u200C\u200D\uFEFF]/g,
          ""
        )
        .replace(
          /\u00A0/g,
          " "
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    // =======================================================
    // STEP 19 - PRICE
    // =======================================================

    console.log(
      "[STEP 19] Extracting price..."
    );

    const priceMatches =
      cleanPanelText.match(
        /₹\s*([\d,]+(?:\.\d{1,2})?)/g
      );

    if (
      !priceMatches ||
      priceMatches.length === 0
    ) {
      throw new Error(
        "Price not found in offer panel"
      );
    }

    console.log(
      "Detected prices:",
      priceMatches
    );

    const lastPrice =
      priceMatches[
        priceMatches.length - 1
      ];

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
    // STEP 20 - STOCK
    // =======================================================

    console.log(
      "[STEP 20] Extracting stock..."
    );

    let stock = null;

    // SOLD OUT
    if (
      /SOLD OUT/i.test(
        cleanPanelText
      )
    ) {
      stock = "SOLD OUT";
    }

    // OUT OF STOCK
    if (!stock) {
      if (
        /OUT OF STOCK/i.test(
          cleanPanelText
        )
      ) {
        stock = "OUT OF STOCK";
      }
    }

    // AVAILABLE (84)
    if (!stock) {
      const match =
        cleanPanelText.match(
          /AVAILABLE\s*\(\s*(\d+)\s*\)/i
        );

      if (match) {
        stock =
          `AVAILABLE (${match[1]})`;
      }
    }

    // 84 AVAILABLE
    if (!stock) {
      const match =
        cleanPanelText.match(
          /(\d+)\s+AVAILABLE\b/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // STOCK: 68 REMAINING
    if (!stock) {
      const match =
        cleanPanelText.match(
          /STOCK\s*:\s*(\d+)\s+REMAINING/i
        );

      if (match) {
        stock =
          `STOCK: ${match[1]} AVAILABLE`;
      }
    }

    // 68 REMAINING
    if (!stock) {
      const match =
        cleanPanelText.match(
          /(\d+)\s+REMAINING/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // LAST FEW: 5
    if (!stock) {
      const match =
        cleanPanelText.match(
          /LAST FEW\s*:\s*(\d+)/i
        );

      if (match) {
        stock =
          `LAST FEW: ${match[1]}`;
      }
    }

    // ONLY 5 LEFT
    if (!stock) {
      const match =
        cleanPanelText.match(
          /ONLY\s+(\d+)\s+LEFT/i
        );

      if (match) {
        stock =
          `ONLY ${match[1]} LEFT`;
      }
    }

    // 5 LEFT
    if (!stock) {
      const match =
        cleanPanelText.match(
          /(\d+)\s+LEFT/i
        );

      if (match) {
        stock =
          `${match[1]} LEFT`;
      }
    }

    // IN STOCK
    if (!stock) {
      if (
        /IN STOCK/i.test(
          cleanPanelText
        )
      ) {
        stock = "IN STOCK";
      }
    }

    // AVAILABLE
    if (!stock) {
      if (
        /\bAVAILABLE\b/i.test(
          cleanPanelText
        )
      ) {
        stock = "AVAILABLE";
      }
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
        await context.close();
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
        await browser.close();
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