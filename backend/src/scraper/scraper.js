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
    // HANDLE COOKIE POPUP
    // ============================================

    await handleCookies(page);

    // ============================================
    // SELECT PRODUCT OPTION
    // ============================================

    const escapedOption =
      selectedOption.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
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

    if (await optionButton.count() === 0) {
      throw new Error(
        `Selected option not found: ${selectedOption}`
      );
    }

    await optionButton.click();

    console.log(
      "Selected option:",
      selectedOption
    );

    await page.waitForTimeout(500);

    // ============================================
    // FIND OFFER PANEL
    // ============================================

    const offerPanel = page.locator(
      ".offer-panel.offer-locked"
    );

    console.log(
      "Performing hover movements..."
    );

    const box =
      await offerPanel.boundingBox();

    if (!box) {
      throw new Error(
        "Offer panel bounding box not found"
      );
    }

    const startX =
      box.x + box.width / 2;

    const startY =
      box.y + box.height / 2;

    // ============================================
    // GENUINE MOUSE MOVEMENTS
    // ============================================

    for (let i = 0; i < 120; i++) {
      const x =
        startX +
        Math.sin(i / 4) * 80 +
        (i % 5);

      const y =
        startY +
        Math.cos(i / 5) * 20 +
        (i % 3);

      await page.mouse.move(x, y);

      await page.waitForTimeout(50);
    }

    console.log(
      "120 mouse movements completed"
    );

    // ============================================
    // CHECK COOKIE SCRIM AFTER MOVEMENTS
    // ============================================

    await page.waitForTimeout(500);

    console.log(
      "Checking cookie consent after hover movements..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    // ============================================
    // GIVE HOVER/DWELL LOGIC TIME
    // ============================================

    await page.waitForTimeout(1500);

    // ============================================
    // WAIT FOR PRICE BUTTON TO UNLOCK
    // ============================================

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
      "Price button unlocked"
    );

    // ============================================
    // CHECK COOKIE POPUP AGAIN
    // ============================================

    console.log(
      "Checking cookie consent before price click..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    const consentScrim =
      page.locator(".consent-scrim");

    const scrimCount =
      await consentScrim.count();

    let scrimVisible = false;

    if (scrimCount > 0) {
      scrimVisible =
        await consentScrim
          .first()
          .isVisible()
          .catch(() => false);
    }

    console.log(
      "Cookie scrim visible before click:",
      scrimVisible
    );

    // If popup appears again
    if (scrimVisible) {
      console.log(
        "Cookie popup appeared again. Handling..."
      );

      await handleCookies(page);

      await page.waitForTimeout(1000);
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
    // WAIT FOR QUOTE API RESPONSE
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

    // ============================================
    // WAIT FOR QUOTE API
    // ============================================

    await quoteResponsePromise;

    console.log(
      "Quote API response received"
    );

    // Give UI time to render
    await page.waitForTimeout(1000);

    // ============================================
    // WAIT FOR FINAL OFFER PANEL
    // ============================================

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
          /Loaded in/i.test(text) ||
          /CHECK AGAIN/i.test(text) ||
          /OUT OF STOCK/i.test(text) ||
          /AVAILABLE\s*\(/i.test(text) ||
          /₹/.test(text)
        );
      },
      null,
      {
        timeout: 15000
      }
    );

    // ============================================
    // GET OFFER PANEL TEXT
    // ============================================

    const panel =
      page.locator(
        ".offer-panel"
      ).first();

    const panelText =
      await panel.innerText();

    console.log(
      "\n========== OFFER PANEL =========="
    );

    console.log(panelText);

    // ============================================
    // NORMALIZE ZERO-WIDTH CHARACTERS
    // ============================================

    /*
     * The mock store can insert zero-width
     * Unicode characters inside prices.
     *
     * Example:
     *
     * ₹​2​1​,​9​6​8
     *
     * becomes:
     *
     * ₹21,968
     */

    const cleanPanelText =
      panelText.replace(
        /[\u200B\u200C\u200D\uFEFF]/g,
        ""
      );

    // ============================================
    // EXTRACT PRICE
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
     * Usually the final ₹ amount is the
     * current/selling price.
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
    // EXTRACT STOCK
    // ============================================

    let stock = null;

    /*
     * Current store format:
     *
     * AVAILABLE (192)
     */

    const availableMatch =
      cleanPanelText.match(
        /AVAILABLE\s*\(\s*(\d+)\s*\)/i
      );

    if (availableMatch) {
      stock =
        `AVAILABLE (${availableMatch[1]})`;
    }

    /*
     * Backup format:
     *
     * 192 UNITS AVAILABLE
     */

    if (!stock) {
      const unitsMatch =
        cleanPanelText.match(
          /(\d+)\s+UNITS?\s+AVAILABLE/i
        );

      if (unitsMatch) {
        stock =
          `${unitsMatch[1]} UNITS AVAILABLE`;
      }
    }

    /*
     * Out of stock
     */

    if (
      /OUT OF STOCK/i.test(cleanPanelText)
    ) {
      stock =
        "OUT OF STOCK";
    }

    if (!stock) {
      throw new Error(
        "Stock information not found"
      );
    }

    // ============================================
    // FINAL RESULT
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

    // Small delay before browser closes
    await page.waitForTimeout(1000);

    await browser.close();
  }
}

module.exports = {
  scrapeProduct
};