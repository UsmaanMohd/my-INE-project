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

  // --------------------------------------------
  // SAFE COOKIE HANDLER
  // Never allow cookie handling to hang scraper
  // --------------------------------------------
  const safeHandleCookies = async (label) => {
    console.log(`Checking cookie consent ${label}...`);

    try {
      await Promise.race([
        handleCookies(page),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Cookie handling timeout")),
            10000
          )
        )
      ]);

      console.log("Cookie handling completed.");
      return true;
    } catch (error) {
      console.log(
        "Cookie handling timed out/failed:",
        error.message
      );

      // Try Escape as a recovery action.
      try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } catch (_) {}

      return false;
    }
  };

  // --------------------------------------------
  // CHECK COOKIE SCRIM
  // --------------------------------------------
  const isCookieBlocking = async () => {
    try {
      return await page.evaluate(() => {
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
      });
    } catch (_) {
      return false;
    }
  };

  // --------------------------------------------
  // SAFE WAIT FOR PRICE BUTTON
  // --------------------------------------------
  const waitForPriceButton = async (timeout = 30000) => {
    console.log(
      `Waiting for price button to unlock (${timeout}ms max)...`
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
        timeout
      }
    );

    console.log("Price button unlocked.");
  };

  // --------------------------------------------
  // SAFE OFFER PANEL WAIT
  // --------------------------------------------
  const waitForOfferPanel = async (timeout = 15000) => {
    console.log(
      "Waiting for offer panel data..."
    );

    await page.waitForFunction(
      () => {
        const panel =
          document.querySelector(".offer-panel");

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
        timeout
      }
    );
  };

  try {
    // ============================================
    // OPEN PRODUCT PAGE
    // ============================================

    console.log("Opening product page...");

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // ============================================
    // INITIAL COOKIE HANDLING
    // ============================================

    await safeHandleCookies(
      "before option selection"
    );

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

      await safeHandleCookies(
        "retry before option selection"
      );

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
    // FIND LOCKED OFFER PANEL
    // ============================================

    const offerPanel =
      page.locator(
        ".offer-panel.offer-locked"
      );

    console.log(
      "Waiting for locked offer panel..."
    );

    await offerPanel.waitFor({
      state: "visible",
      timeout: 15000
    });

    console.log(
      "Locked offer panel found."
    );

    // ============================================
    // GET OFFER PANEL POSITION
    // ============================================

    console.log(
      "Getting offer panel position..."
    );

    const box =
      await offerPanel.boundingBox();

    if (!box) {
      throw new Error(
        "Offer panel bounding box not found"
      );
    }

    console.log(
      "Offer panel position found."
    );

    // ============================================
    // HOVER MOVEMENTS
    // ============================================

    const performHoverMovements =
      async () => {
        const currentBox =
          await offerPanel.boundingBox();

        if (!currentBox) {
          throw new Error(
            "Offer panel bounding box not found during hover"
          );
        }

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

          await page.mouse.move(x, y, {
            steps: 1
          });

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
    // COOKIE AFTER FIRST HOVER
    // IMPORTANT:
    // bounded timeout so scraper cannot hang
    // ============================================

    console.log(
      "Checking cookie consent after hover movements..."
    );

    await safeHandleCookies(
      "after first hover"
    );

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

      try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } catch (_) {}

      await safeHandleCookies(
        "recovery after first hover"
      );

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
        "Cookie consent overlay is still blocking after hover"
      );
    }

    // ============================================
    // SECOND HOVER
    // ============================================

    console.log(
      "Repeating hover movements after cookie handling..."
    );

    await performHoverMovements();

    await page.waitForTimeout(1500);

    console.log(
      "Second hover completed."
    );

    // ============================================
    // WAIT FOR PRICE BUTTON
    // ============================================

    await waitForPriceButton(30000);

    // ============================================
    // FINAL COOKIE CHECK
    // ============================================

    console.log(
      "Checking cookie consent before price click..."
    );

    await safeHandleCookies(
      "before price click"
    );

    await page.waitForTimeout(500);

    cookieBlocking =
      await isCookieBlocking();

    console.log(
      "Cookie scrim blocking before price click:",
      cookieBlocking
    );

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
    // QUOTE API RESPONSE
    // ============================================

    const quoteResponsePromise =
      page.waitForResponse(
        response => {
          const url =
            response.url();

          return (
            url.includes("/api/v2/items/") &&
            url.includes("/quote?opt=") &&
            response.status() === 200
          );
        },
        {
          timeout: 30000
        }
      );

    console.log(
      "Clicking price button..."
    );

    await priceButton.click({
      timeout: 10000
    });

    console.log(
      "Price button clicked"
    );

    await quoteResponsePromise;

    console.log(
      "Quote API response received"
    );

    await page.waitForTimeout(1000);

    // ============================================
    // OFFER PANEL DATA
    // ============================================

    await waitForOfferPanel(15000);

    // ============================================
    // GET OFFER PANEL TEXT
    // ============================================

    const panel =
      page
        .locator(".offer-panel")
        .first();

    const panelText =
      await panel.innerText({
        timeout: 10000
      });

    console.log(
      "\n========== OFFER PANEL =========="
    );

    console.log(panelText);

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

    // LAST FEW: 71
    if (!stock) {
      const match =
        cleanPanelText.match(
          /\bLAST FEW\s*:\s*(\d+)\b/i
        );

      if (match) {
        stock =
          `LAST FEW: ${match[1]}`;
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

    // IN STOCK
    if (!stock) {
      if (
        /\bIN STOCK\b/i.test(
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

    // Generic stock line
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
    } catch (_) {}

    try {
      console.log(
        "Closing browser..."
      );

      await browser.close();

      console.log(
        "Browser closed."
      );
    } catch (closeError) {
      console.error(
        "Browser close error:",
        closeError.message
      );
    }
  }
}

module.exports = {
  scrapeProduct
};