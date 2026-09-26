const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, ms);
    })
  ]);
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

async function safeCookieHandling(page, label) {
  console.log(`[${label}] Cookie handling START`);

  try {
    await withTimeout(
      handleCookies(page),
      10000,
      `[${label}] Cookie handling timed out after 10 seconds`
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

async function getScrimVisible(page, label) {
  console.log(`[${label}] Checking cookie scrim...`);

  try {
    const visible = await withTimeout(
      (async () => {
        const scrim = page
          .locator(".consent-scrim")
          .first();

        const count = await scrim.count();

        if (count === 0) {
          return false;
        }

        return await scrim.isVisible();
      })(),
      3000,
      `[${label}] Cookie scrim check timed out after 3 seconds`
    );

    console.log(
      `[${label}] Cookie scrim visible:`,
      visible
    );

    return visible;
  } catch (error) {
    console.error(
      `[${label}] Cookie scrim check error:`,
      error.message
    );

    return false;
  }
}

async function performHoverMovements(
  page,
  offerPanel,
  label
) {
  console.log(`[${label}] Getting offer panel position...`);

  const box = await withTimeout(
    offerPanel.first().boundingBox(),
    5000,
    `[${label}] Offer panel boundingBox timed out`
  );

  if (!box) {
    throw new Error(
      `[${label}] Offer panel bounding box not found`
    );
  }

  console.log(
    `[${label}] Offer panel position found.`
  );

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  console.log(
    `[${label}] Performing hover movements...`
  );

  for (let i = 0; i < 120; i++) {
    const x =
      startX +
      Math.sin(i / 4) * 80 +
      (i % 5);

    const y =
      startY +
      Math.cos(i / 5) * 20 +
      (i % 3);

    await withTimeout(
      page.mouse.move(x, y),
      3000,
      `[${label}] Mouse movement timed out`
    );

    await delay(50);
  }

  console.log(
    `[${label}] 120 mouse movements completed.`
  );
}

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

  let masterTimeout = null;

  try {
    // =====================================================
    // MASTER WATCHDOG
    // =====================================================

    const masterTimeoutPromise = new Promise(
      (_, reject) => {
        masterTimeout = setTimeout(() => {
          reject(
            new Error(
              "MASTER SCRAPER TIMEOUT: scrape exceeded 90 seconds"
            )
          );
        }, 90000);
      }
    );

    const scrapeWork = (async () => {
      // =====================================================
      // STEP 1 - LAUNCH CHROMIUM
      // =====================================================

      console.log("[STEP 1] Launching Chromium...");
      logMemory("before-browser");

      browser = await withTimeout(
        chromium.launch({
          headless: process.env.HEADLESS === "true",
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

      console.log("[STEP 1] Chromium launched.");
      logMemory("after-browser");

      // =====================================================
      // STEP 2 - CONTEXT
      // =====================================================

      console.log(
        "[STEP 2] Creating browser context..."
      );

      context = await withTimeout(
        browser.newContext(),
        10000,
        "Browser context creation timed out"
      );

      console.log(
        "[STEP 2] Browser context created."
      );

      // =====================================================
      // STEP 3 - PAGE
      // =====================================================

      console.log("[STEP 3] Creating browser page...");

      page = await withTimeout(
        context.newPage(),
        10000,
        "Browser page creation timed out"
      );

      console.log("[STEP 3] Browser page created.");

      // =====================================================
      // NETWORK DIAGNOSTICS
      // =====================================================

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

      // =====================================================
      // STEP 5 - OPEN PRODUCT PAGE
      // =====================================================

      console.log(
        "[STEP 5] Opening product page..."
      );

      logMemory("before-page-goto");

      await withTimeout(
        page.goto(productUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000
        }),
        25000,
        "Product page load timed out"
      );

      console.log(
        "[STEP 5] Product page loaded."
      );

      logMemory("after-page-goto");

      await delay(1000);

      console.log(
        "[STEP 5] Initial page preparation completed."
      );

      // =====================================================
      // STEP 6 - COOKIE BEFORE OPTION
      // =====================================================

      console.log(
        "[STEP 6] Checking cookie consent before option selection..."
      );

      await safeCookieHandling(
        page,
        "STEP 6"
      );

      console.log(
        "[STEP 6] Cookie handling completed."
      );

      // =====================================================
      // STEP 6A / 6B
      // =====================================================

      console.log(
        "[STEP 6A] Moving to option selection..."
      );

      await delay(500);

      console.log(
        "[STEP 6B] Delay completed."
      );

      // =====================================================
      // STEP 7 - OPTION SELECTION
      // =====================================================

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

      // =====================================================
      // STEP 8 - OFFER PANEL
      // =====================================================

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
        "Locked offer panel not found within 17 seconds"
      );

      console.log(
        "[STEP 8B] Locked offer panel found."
      );

      // =====================================================
      // STEP 9 - FIRST HOVER
      // =====================================================

      console.log(
        "[STEP 9] Performing first hover..."
      );

      await performHoverMovements(
        page,
        offerPanel,
        "HOVER"
      );

      console.log(
        "[STEP 9] First hover completed."
      );

      logMemory("after-first-hover");

      // =====================================================
      // STEP 10 - COOKIE AFTER HOVER
      // =====================================================

      console.log(
        "[STEP 10] Checking cookie consent after hover..."
      );

      await safeCookieHandling(
        page,
        "STEP 10"
      );

      console.log(
        "[STEP 10] Cookie handling completed."
      );

      // IMPORTANT:
      // This was the place where your scraper was
      // hanging for 5+ minutes.
      // Now it has a HARD 3-second timeout.

      const scrimVisible =
        await getScrimVisible(
          page,
          "STEP 10"
        );

      if (scrimVisible) {
        console.log(
          "[STEP 10] Cookie scrim still blocking. Trying recovery..."
        );

        await safeCookieHandling(
          page,
          "STEP 10 RECOVERY"
        );

        await delay(700);

        const stillVisible =
          await getScrimVisible(
            page,
            "STEP 10 RECOVERY"
          );

        if (stillVisible) {
          throw new Error(
            "Cookie consent overlay is still blocking the page after recovery"
          );
        }

        console.log(
          "[STEP 10] Cookie recovery successful."
        );
      }

      console.log(
        "[STEP 11] Repeating hover after cookie handling..."
      );

      await performHoverMovements(
        page,
        offerPanel,
        "HOVER RECOVERY"
      );

      console.log(
        "[STEP 11] Second hover completed."
      );

      // =====================================================
      // STEP 12 - PRICE BUTTON
      // =====================================================

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
        "Price button did not unlock within 32 seconds"
      );

      console.log(
        "[STEP 12] Price button unlocked."
      );

      // =====================================================
      // STEP 13 - FINAL COOKIE CHECK
      // =====================================================

      console.log(
        "[STEP 13] Final cookie check..."
      );

      const finalScrimVisible =
        await getScrimVisible(
          page,
          "STEP 13"
        );

      if (finalScrimVisible) {
        console.log(
          "[STEP 13] Cookie scrim still visible. Recovering..."
        );

        await safeCookieHandling(
          page,
          "STEP 13 RECOVERY"
        );

        await delay(500);

        const finalStillVisible =
          await getScrimVisible(
            page,
            "STEP 13 RECOVERY"
          );

        if (finalStillVisible) {
          throw new Error(
            "Cookie overlay remained visible before price click"
          );
        }
      }

      // =====================================================
      // STEP 14 - FIND PRICE BUTTON
      // =====================================================

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
        "Price button visibility timed out"
      );

      const disabled =
        await withTimeout(
          priceButton.isDisabled(),
          3000,
          "Price button disabled-state check timed out"
        );

      console.log(
        "[STEP 14] Price button disabled:",
        disabled
      );

      if (disabled) {
        throw new Error(
          "Price button became disabled before click"
        );
      }

      // =====================================================
      // STEP 15 - QUOTE LISTENER
      // =====================================================

      console.log(
        "[STEP 15] Preparing quote API listener..."
      );

      const quoteResponsePromise =
        page.waitForResponse(
          (response) => {
            const url =
              response.url();

            return (
              url.includes(
                "/api/v2/items/"
              ) &&
              url.includes(
                "/quote?opt="
              ) &&
              response.status() === 200
            );
          },
          {
            timeout: 10000
          }
        );

      console.log(
        "[STEP 15] Quote listener ready."
      );

      // =====================================================
      // STEP 16 - CLICK PRICE BUTTON
      // =====================================================

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

      // =====================================================
      // STEP 17 - QUOTE RESPONSE
      // =====================================================

      console.log(
        "[STEP 17] Waiting for quote API response..."
      );

      try {
        const quoteResponse =
          await quoteResponsePromise;

        console.log(
          "[STEP 17] Quote API response:",
          quoteResponse.status()
        );

        console.log(
          "[STEP 17] Quote URL:",
          quoteResponse.url()
        );
      } catch (error) {
        console.log(
          "[STEP 17] Quote API did not return 200 within timeout."
        );

        console.log(
          "[STEP 17] Continuing because offer panel may still render."
        );
      }

      // =====================================================
      // STEP 18 - OFFER PANEL DATA
      // =====================================================

      console.log(
        "[STEP 18] Waiting for offer panel data..."
      );

      try {
        await withTimeout(
          page.waitForFunction(
            () => {
              const panel =
                document.querySelector(
                  ".offer-panel"
                );

              if (!panel) {
                return false;
              }

              const text =
                panel.innerText ||
                "";

              return (
                /Loaded in/i.test(text) ||
                /CHECK AGAIN/i.test(text) ||
                /OUT OF STOCK/i.test(text) ||
                /SOLD OUT/i.test(text) ||
                /AVAILABLE/i.test(text) ||
                /REMAINING/i.test(text) ||
                /LAST FEW/i.test(text) ||
                /₹/.test(text)
              );
            },
            null,
            {
              timeout: 15000
            }
          ),
          17000,
          "Offer panel data timed out"
        );

        console.log(
          "[STEP 18] Offer panel data detected."
        );
      } catch (error) {
        throw new Error(
          `Offer panel data did not load: ${error.message}`
        );
      }

      // =====================================================
      // STEP 19 - READ OFFER PANEL
      // =====================================================

      console.log(
        "[STEP 19] Reading offer panel..."
      );

      const panel =
        page
          .locator(".offer-panel")
          .first();

      const panelText =
        await withTimeout(
          panel.innerText(),
          5000,
          "Offer panel text extraction timed out"
        );

      console.log(
        "\n========== OFFER PANEL =========="
      );

      console.log(panelText);

      // =====================================================
      // STEP 20 - NORMALIZE + EXTRACT PRICE
      // =====================================================

      console.log(
        "[STEP 20] Extracting price..."
      );

      /*
       * IMPORTANT:
       *
       * The store can return:
       *
       * ₹​2​1​ ​9​4​6
       *
       * where invisible Unicode characters exist
       * between the digits.
       *
       * Instead of relying on a fragile regex,
       * we process each ₹ line and keep ONLY digits,
       * comma and decimal point.
       */

      const normalizedPanelText =
        panelText
          .replace(
            /[\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g,
            ""
          )
          .replace(
            /[\u00A0\u202F]/g,
            " "
          )
          .replace(
            /[\uFF10-\uFF19]/g,
            (char) =>
              String.fromCharCode(
                char.charCodeAt(0) -
                  0xFF10 +
                  48
              )
          );

      const priceLines =
        normalizedPanelText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) =>
            line.includes("₹")
          );

      const priceMatches = [];

      for (const line of priceLines) {
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
         * Keep digits, comma and decimal point.
         * Remove invisible spaces or Unicode characters.
         */
        const cleanedNumber =
          afterRupee.replace(
            /[^\d.,]/g,
            ""
          );

        if (cleanedNumber) {
          priceMatches.push(
            `₹${cleanedNumber}`
          );
        }
      }

      if (
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

      /*
       * Usually the final ₹ amount is
       * the current/selling price.
       */

      const priceText =
        priceMatches[
          priceMatches.length - 1
        ];

      const price =
        Number(
          priceText
            .replace(
              /[₹,\s]/g,
              ""
            )
        );

      if (
        !Number.isFinite(price)
      ) {
        throw new Error(
          `Invalid price extracted: ${priceText}`
        );
      }

      if (price <= 0) {
        throw new Error(
          `Invalid non-positive price extracted: ${price}`
        );
      }

      // =====================================================
      // STEP 21 - EXTRACT STOCK
      // =====================================================

      console.log(
        "[STEP 21] Extracting stock..."
      );

      let stock = null;

      // SOLD OUT

      if (
        /SOLD OUT/i.test(
          normalizedPanelText
        )
      ) {
        stock = "SOLD OUT";
      }

      // OUT OF STOCK

      if (
        !stock &&
        /OUT OF STOCK/i.test(
          normalizedPanelText
        )
      ) {
        stock = "OUT OF STOCK";
      }

      // AVAILABLE (99)

      if (!stock) {
        const availableBracket =
          normalizedPanelText.match(
            /AVAILABLE\s*\(\s*(\d+)\s*\)/i
          );

        if (availableBracket) {
          stock =
            `AVAILABLE (${availableBracket[1]})`;
        }
      }

      // 99 AVAILABLE

      if (!stock) {
        const numberAvailable =
          normalizedPanelText.match(
            /(\d+)\s+AVAILABLE\b/i
          );

        if (numberAvailable) {
          stock =
            `${numberAvailable[1]} AVAILABLE`;
        }
      }

      // 99 UNITS AVAILABLE

      if (!stock) {
        const unitsAvailable =
          normalizedPanelText.match(
            /(\d+)\s+UNITS?\s+AVAILABLE/i
          );

        if (unitsAvailable) {
          stock =
            `${unitsAvailable[1]} UNITS AVAILABLE`;
        }
      }

      // STOCK: 68 REMAINING

      if (!stock) {
        const stockRemaining =
          normalizedPanelText.match(
            /STOCK\s*:\s*(\d+)\s+REMAINING/i
          );

        if (stockRemaining) {
          stock =
            `STOCK: ${stockRemaining[1]} REMAINING`;
        }
      }

      // 68 REMAINING

      if (!stock) {
        const remaining =
          normalizedPanelText.match(
            /(\d+)\s+REMAINING/i
          );

        if (remaining) {
          stock =
            `${remaining[1]} REMAINING`;
        }
      }

      // LAST FEW: 71

      if (!stock) {
        const lastFew =
          normalizedPanelText.match(
            /LAST FEW\s*:\s*(\d+)/i
          );

        if (lastFew) {
          stock =
            `LAST FEW: ${lastFew[1]}`;
        }
      }

      // ONLY 5 LEFT

      if (!stock) {
        const onlyLeft =
          normalizedPanelText.match(
            /ONLY\s+(\d+)\s+LEFT/i
          );

        if (onlyLeft) {
          stock =
            `ONLY ${onlyLeft[1]} LEFT`;
        }
      }

      // 5 LEFT

      if (!stock) {
        const left =
          normalizedPanelText.match(
            /(\d+)\s+LEFT/i
          );

        if (left) {
          stock =
            `${left[1]} LEFT`;
        }
      }

      // IN STOCK

      if (!stock) {
        if (
          /IN STOCK/i.test(
            normalizedPanelText
          )
        ) {
          stock = "IN STOCK";
        }
      }

      // AVAILABLE

      if (!stock) {
        if (
          /\bAVAILABLE\b/i.test(
            normalizedPanelText
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

      // =====================================================
      // FINAL RESULT
      // =====================================================

      console.log(
        "\nPRICE:",
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
    })();

    // =====================================================
    // RACE SCRAPE AGAINST MASTER WATCHDOG
    // =====================================================

    return await Promise.race([
      scrapeWork,
      masterTimeoutPromise
    ]);
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
    // Clear watchdog
    if (masterTimeout) {
      clearTimeout(masterTimeout);
    }

    // =====================================================
    // SAFE BROWSER CLEANUP
    // =====================================================

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