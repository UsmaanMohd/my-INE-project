const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

async function scrapeProduct({
  productUrl,
  selectedOption
}) {
  console.log("\n================================");
  console.log("SCRAPING:", productUrl);
  console.log("OPTION:", selectedOption);
  console.log("================================");

  const browser = await chromium.launch({
    headless: process.env.HEADLESS === "true"
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ============================================
    // OPEN PRODUCT PAGE
    // ============================================

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // ============================================
    // COOKIE CHECK FUNCTION
    // ============================================

    const isCookieBlocking = async () => {
      try {
        return await Promise.race([
          page.evaluate(() => {
            const scrim =
              document.querySelector(".consent-scrim");

            if (!scrim) {
              return false;
            }

            const style =
              window.getComputedStyle(scrim);

            const rect =
              scrim.getBoundingClientRect();

            const visible =
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0 &&
              rect.width > 0 &&
              rect.height > 0;

            return (
              visible &&
              style.pointerEvents !== "none"
            );
          }),

          new Promise((resolve) =>
            setTimeout(() => resolve(false), 3000)
          )
        ]);
      } catch {
        return false;
      }
    };

    // ============================================
    // INITIAL COOKIE HANDLING
    // ============================================

    console.log(
      "Checking cookie consent before option selection..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    let cookieBlocking =
      await isCookieBlocking();

    console.log(
      "Cookie scrim blocking page:",
      cookieBlocking
    );

    if (cookieBlocking) {
      console.log(
        "Cookie overlay still blocking. Retrying..."
      );

      await handleCookies(page);

      await page.waitForTimeout(500);

      cookieBlocking =
        await isCookieBlocking();

      console.log(
        "Cookie scrim blocking after retry:",
        cookieBlocking
      );
    }

    if (cookieBlocking) {
      throw new Error(
        "Cookie consent overlay is still blocking the page"
      );
    }

    // ============================================
    // SELECT PRODUCT OPTION
    // ============================================

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

    if (
      await optionButton.count() === 0
    ) {
      throw new Error(
        `Selected option not found: ${selectedOption}`
      );
    }

    await optionButton.waitFor({
      state: "visible",
      timeout: 10000
    });

    console.log(
      "Selecting option:",
      selectedOption
    );

    await optionButton.click({
      timeout: 10000
    });

    console.log(
      "Selected option:",
      selectedOption
    );

    await page.waitForTimeout(500);

    console.log(
      "Option selection completed. Preparing offer panel..."
    );

    // ============================================
    // OFFER PANEL
    // ============================================

    const offerPanel =
      page.locator(
        ".offer-panel.offer-locked"
      );

    console.log(
      "Waiting for locked offer panel..."
    );

    try {
      await offerPanel.waitFor({
        state: "visible",
        timeout: 15000
      });

      console.log(
        "Locked offer panel found."
      );
    } catch (error) {
      console.log(
        "Locked offer panel wait failed:",
        error.message
      );
    }

    // ============================================
    // HOVER FUNCTION
    // ============================================

    const performHoverMovements =
      async () => {
        console.log(
          "Getting offer panel position..."
        );

        let currentBox = null;

        try {
          currentBox =
            await Promise.race([
              offerPanel.boundingBox(),

              new Promise((resolve) =>
                setTimeout(
                  () => resolve(null),
                  5000
                )
              )
            ]);
        } catch {
          currentBox = null;
        }

        if (!currentBox) {
          throw new Error(
            "Offer panel bounding box not found during hover"
          );
        }

        console.log(
          "Offer panel position found."
        );

        const startX =
          currentBox.x +
          currentBox.width / 2;

        const startY =
          currentBox.y +
          currentBox.height / 2;

        console.log(
          "Performing hover movements..."
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

          try {
            await page.mouse.move(x, y);
          } catch (error) {
            console.log(
              "Mouse movement failed:",
              error.message
            );

            break;
          }

          await page.waitForTimeout(50);
        }

        console.log(
          "120 mouse movements completed"
        );
      };

    // ============================================
    // FIRST HOVER
    // ============================================

    await performHoverMovements();

    await page.waitForTimeout(500);

    // ============================================
    // COOKIE MAY APPEAR AFTER HOVER
    // ============================================

    console.log(
      "Checking cookie consent after hover movements..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    cookieBlocking =
      await isCookieBlocking();

    console.log(
      "Cookie scrim blocking after hover:",
      cookieBlocking
    );

    if (cookieBlocking) {
      console.log(
        "Cookie scrim still blocking. Trying recovery..."
      );

      await handleCookies(page);

      await page.waitForTimeout(500);

      cookieBlocking =
        await isCookieBlocking();

      console.log(
        "Cookie scrim blocking after recovery:",
        cookieBlocking
      );
    }

    if (cookieBlocking) {
      throw new Error(
        "Cookie consent overlay is still blocking after recovery"
      );
    }

    // ============================================
    // SECOND HOVER
    // ============================================

    console.log(
      "Repeating hover movements after cookie handling..."
    );

    await performHoverMovements();

    console.log(
      "Second hover completed."
    );

    await page.waitForTimeout(1000);

    // ============================================
    // WAIT FOR PRICE BUTTON
    // ============================================

    console.log(
      "Waiting for price button to unlock (30000ms max)..."
    );

    await page.waitForFunction(
      () => {
        const button =
          document.querySelector(
            'button[aria-label="Check today’s price"]'
          );

        return (
          button &&
          !button.disabled
        );
      },
      null,
      {
        timeout: 30000
      }
    );

    console.log(
      "Price button unlocked."
    );

    // ============================================
    // FINAL COOKIE CHECK
    // ============================================

    console.log(
      "Checking cookie consent before price click..."
    );

    await handleCookies(page);

    await page.waitForTimeout(300);

    cookieBlocking =
      await isCookieBlocking();

    console.log(
      "Cookie scrim blocking before price click:",
      cookieBlocking
    );

    if (cookieBlocking) {
      console.log(
        "Cookie still blocking. Running final recovery..."
      );

      await handleCookies(page);

      await page.waitForTimeout(300);

      cookieBlocking =
        await isCookieBlocking();

      console.log(
        "Cookie scrim blocking after final recovery:",
        cookieBlocking
      );
    }

    if (cookieBlocking) {
      throw new Error(
        "Cookie consent overlay is blocking price button"
      );
    }

    // ============================================
    // PRICE BUTTON
    // ============================================

    const priceButton =
      page.locator(
        'button[aria-label="Check today’s price"]'
      );

    await priceButton.waitFor({
      state: "visible",
      timeout: 10000
    });

    const disabled =
      await priceButton.isDisabled();

    if (disabled) {
      throw new Error(
        "Price button became disabled before click"
      );
    }

    // ============================================
    // QUOTE API LISTENER
    // ============================================

    console.log(
      "Preparing quote API listener..."
    );

    const quoteResponsePromise =
      page.waitForResponse(
        response => {
          const url =
            response.url();

          return (
            url.includes("/api/v2/items/") &&
            url.includes("/quote?opt=")
          );
        },
        {
          timeout: 10000
        }
      ).catch((error) => {
        console.log(
          "Quote API response not received:",
          error.message
        );

        return null;
      });

    // ============================================
    // CLICK PRICE BUTTON
    // ============================================

    console.log(
      "Clicking price button..."
    );

    await priceButton.click({
      timeout: 10000
    });

    console.log(
      "Price button clicked"
    );

    // ============================================
    // QUOTE API WAIT
    // ============================================

    /*
     * IMPORTANT:
     *
     * Do NOT wait indefinitely for HTTP 200.
     *
     * The demo store can return 500 first
     * and then retry internally.
     *
     * We only wait a maximum of 10 seconds
     * and then continue to inspect the page.
     */

    try {
      const quoteResponse =
        await Promise.race([
          quoteResponsePromise,

          new Promise((resolve) =>
            setTimeout(() => {
              console.log(
                "Quote API wait timeout reached. Continuing..."
              );

              resolve(null);
            }, 10000)
          )
        ]);

      if (quoteResponse) {
        console.log(
          "Quote API response received:",
          quoteResponse.status()
        );
      } else {
        console.log(
          "No successful quote response captured. Continuing with page inspection..."
        );
      }
    } catch (error) {
      console.log(
        "Quote API wait failed:",
        error.message
      );
    }

    await page.waitForTimeout(1500);

    // ============================================
    // WAIT FOR OFFER PANEL DATA
    // ============================================

    console.log(
      "Waiting for offer panel data..."
    );

    try {
      await page.waitForFunction(
        () => {
          const panel =
            document.querySelector(
              ".offer-panel"
            );

          if (!panel) {
            return false;
          }

          const text =
            panel.innerText || "";

          return (
            /₹/.test(text) ||
            /SOLD OUT/i.test(text) ||
            /OUT OF STOCK/i.test(text) ||
            /AVAILABLE/i.test(text) ||
            /REMAINING/i.test(text) ||
            /CHECK AGAIN/i.test(text)
          );
        },
        null,
        {
          timeout: 15000
        }
      );

      console.log(
        "Offer panel data detected."
      );
    } catch (error) {
      console.log(
        "Offer panel data wait failed:",
        error.message
      );
    }

    // ============================================
    // GET OFFER PANEL
    // ============================================

    const panel =
      page
        .locator(".offer-panel")
        .first();

    let panelText = "";

    try {
      panelText =
        await panel.innerText({
          timeout: 5000
        });
    } catch (error) {
      throw new Error(
        `Unable to read offer panel: ${error.message}`
      );
    }

    console.log(
      "\n========== OFFER PANEL =========="
    );

    console.log(
      panelText
    );

    // ============================================
    // CLEAN TEXT
    // ============================================

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

    // ============================================
    // PRICE EXTRACTION
    // ============================================

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

    /*
     * Use final ₹ amount as current
     * selling price.
     */

    const priceText =
      priceMatches[
        priceMatches.length - 1
      ];

    const price =
      Number(
        priceText.replace(
          /[₹,\s]/g,
          ""
        )
      );

    if (!Number.isFinite(price)) {
      throw new Error(
        "Invalid price extracted"
      );
    }

    // ============================================
    // STOCK EXTRACTION
    // ============================================

    let stock = null;

    // SOLD OUT

    if (
      /SOLD OUT/i.test(
        cleanPanelText
      )
    ) {
      stock =
        "SOLD OUT";
    }

    // OUT OF STOCK

    if (!stock) {
      if (
        /OUT OF STOCK/i.test(
          cleanPanelText
        )
      ) {
        stock =
          "OUT OF STOCK";
      }
    }

    // AVAILABLE (84)

    if (!stock) {
      const match =
        cleanPanelText.match(
          /\bAVAILABLE\s*\(\s*(\d+)\s*\)/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // 84 AVAILABLE

    if (!stock) {
      const match =
        cleanPanelText.match(
          /\b(\d+)\s+(?:UNITS?\s+)?AVAILABLE\b/i
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
          /\bSTOCK\s*[:\-]?\s*(\d+)\s+REMAINING\b/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // 68 REMAINING

    if (!stock) {
      const match =
        cleanPanelText.match(
          /\b(\d+)\s+REMAINING\b/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // ONLY 5 LEFT / 5 LEFT

    if (!stock) {
      const match =
        cleanPanelText.match(
          /\b(?:ONLY\s+)?(\d+)\s+LEFT\b/i
        );

      if (match) {
        stock =
          `${match[1]} AVAILABLE`;
      }
    }

    // LAST FEW: 141

    if (!stock) {
      const match =
        cleanPanelText.match(
          /\bLAST\s+FEW\s*:\s*(\d+)\b/i
        );

      if (match) {
        stock =
          `LAST FEW: ${match[1]}`;
      }
    }

    // IN STOCK

    if (!stock) {
      if (
        /\bIN STOCK\b/i.test(
          cleanPanelText
        )
      ) {
        stock =
          "IN STOCK";
      }
    }

    // AVAILABLE

    if (!stock) {
      if (
        /\bAVAILABLE\b/i.test(
          cleanPanelText
        )
      ) {
        stock =
          "AVAILABLE";
      }
    }

    // Generic stock/inventory wording

    if (!stock) {
      const stockLine =
        cleanPanelText.match(
          /(?:STOCK|INVENTORY)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 ._-]{0,40})/i
        );

      if (stockLine) {
        stock =
          stockLine[0].trim();
      }
    }

    if (!stock) {
      throw new Error(
        "Stock information not found"
      );
    }

    // ============================================
    // SUCCESS
    // ============================================

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

  } catch (error) {

    // ============================================
    // ERROR
    // ============================================

    console.error(
      "SCRAPE FAILED:",
      error.message
    );

    return {
      success: false,
      error: error.message
    };

  } finally {

    try {
      await page.waitForTimeout(500);
    } catch {
      // Ignore.
    }

    try {
      await browser.close();
      console.log(
        "Browser closed."
      );
    } catch (error) {
      console.log(
        "Browser close error:",
        error.message
      );
    }
  }
}

module.exports = {
  scrapeProduct
};