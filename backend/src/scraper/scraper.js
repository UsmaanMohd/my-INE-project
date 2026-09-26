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

  let browser = null;
  let context = null;
  let page = null;

  try {
    // ============================================
    // LAUNCH BROWSER
    // ============================================

    console.log("Launching Chromium...");

    browser = await Promise.race([
      chromium.launch({
        headless: process.env.HEADLESS === "true"
      }),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Chromium launch timed out after 20 seconds"
              )
            ),
          20000
        )
      )
    ]);

    console.log("Chromium launched.");

    // ============================================
    // CREATE CONTEXT
    // ============================================

    console.log("Creating browser context...");

    context = await Promise.race([
      browser.newContext(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Browser context creation timed out"
              )
            ),
          10000
        )
      )
    ]);

    console.log("Browser context created.");

    // ============================================
    // CREATE PAGE
    // ============================================

    console.log("Creating browser page...");

    page = await Promise.race([
      context.newPage(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Browser page creation timed out"
              )
            ),
          10000
        )
      )
    ]);

    console.log("Browser page created.");

    // ============================================
    // OPEN PRODUCT PAGE
    // ============================================

    console.log("Opening product page...");

    try {
      await page.goto(productUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000
      });

      console.log("Product page loaded.");
    } catch (error) {
      throw new Error(
        `Product page load failed: ${error.message}`
      );
    }

    await page.waitForTimeout(1000);

    console.log("Initial page preparation completed.");

    // ============================================
    // HANDLE COOKIE POPUP
    // ============================================

    console.log(
      "Checking cookie consent before option selection..."
    );

    await handleCookies(page);

    // ============================================
    // SELECT PRODUCT OPTION
    // ============================================

    console.log(
      "Selecting option:",
      selectedOption
    );

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

    const optionCount =
      await optionButton.count();

    console.log(
      "Matching option buttons:",
      optionCount
    );

    if (optionCount === 0) {
      throw new Error(
        `Selected option not found: ${selectedOption}`
      );
    }

    await optionButton.click({
      timeout: 10000
    });

    console.log(
      "Selected option:",
      selectedOption
    );

    console.log(
      "Option selection completed. Preparing offer panel..."
    );

    await page.waitForTimeout(500);

    // ============================================
    // FIND LOCKED OFFER PANEL
    // ============================================

    const offerPanel = page.locator(
      ".offer-panel.offer-locked"
    );

    console.log(
      "Waiting for locked offer panel..."
    );

    try {
      await offerPanel.first().waitFor({
        state: "visible",
        timeout: 15000
      });

      console.log(
        "Locked offer panel found."
      );
    } catch (error) {
      throw new Error(
        `Locked offer panel not found: ${error.message}`
      );
    }

    // ============================================
    // GET OFFER PANEL POSITION
    // ============================================

    console.log(
      "Getting offer panel position..."
    );

    const box = await offerPanel
      .first()
      .boundingBox();

    if (!box) {
      throw new Error(
        "Offer panel bounding box not found"
      );
    }

    console.log(
      "Offer panel position found."
    );

    const startX =
      box.x + box.width / 2;

    const startY =
      box.y + box.height / 2;

    // ============================================
    // FIRST HOVER MOVEMENTS
    // ============================================

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

      await page.mouse.move(x, y);

      await page.waitForTimeout(50);
    }

    console.log(
      "120 mouse movements completed"
    );

    // ============================================
    // COOKIE CHECK AFTER HOVER
    // ============================================

    await page.waitForTimeout(500);

    console.log(
      "Checking cookie consent after hover movements..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    // ============================================
    // CHECK IF COOKIE SCRIM STILL BLOCKS
    // ============================================

    let scrimVisible = false;

    try {
      const scrim =
        page.locator(".consent-scrim").first();

      if (await scrim.count() > 0) {
        scrimVisible =
          await scrim.isVisible().catch(
            () => false
          );
      }
    } catch {
      scrimVisible = false;
    }

    console.log(
      "Cookie scrim visible after hover:",
      scrimVisible
    );

    if (scrimVisible) {
      console.log(
        "Cookie scrim still blocking. Trying recovery..."
      );

      await handleCookies(page);

      await page.waitForTimeout(700);

      let stillVisible = false;

      try {
        const scrim =
          page.locator(".consent-scrim").first();

        if (await scrim.count() > 0) {
          stillVisible =
            await scrim.isVisible().catch(
              () => false
            );
        }
      } catch {
        stillVisible = false;
      }

      console.log(
        "Cookie scrim visible after recovery:",
        stillVisible
      );

      if (stillVisible) {
        throw new Error(
          "Cookie consent overlay is still blocking the page"
        );
      }

      // Repeat hover after cookie recovery

      console.log(
        "Repeating hover movements after cookie handling..."
      );

      const newBox =
        await offerPanel
          .first()
          .boundingBox();

      if (!newBox) {
        throw new Error(
          "Offer panel disappeared after cookie handling"
        );
      }

      const newStartX =
        newBox.x + newBox.width / 2;

      const newStartY =
        newBox.y + newBox.height / 2;

      console.log(
        "Offer panel position found."
      );

      console.log(
        "Performing hover movements..."
      );

      for (let i = 0; i < 120; i++) {
        const x =
          newStartX +
          Math.sin(i / 4) * 80 +
          (i % 5);

        const y =
          newStartY +
          Math.cos(i / 5) * 20 +
          (i % 3);

        await page.mouse.move(x, y);

        await page.waitForTimeout(50);
      }

      console.log(
        "120 mouse movements completed"
      );

      console.log(
        "Second hover completed."
      );
    }

    // ============================================
    // WAIT FOR PRICE BUTTON
    // ============================================

    console.log(
      "Waiting for price button to unlock (30000ms max)..."
    );

    try {
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
    } catch (error) {
      throw new Error(
        `Price button did not unlock: ${error.message}`
      );
    }

    console.log(
      "Price button unlocked."
    );

    // ============================================
    // COOKIE CHECK BEFORE PRICE CLICK
    // ============================================

    console.log(
      "Checking cookie consent before price click..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    let cookieBlocking = false;

    try {
      const scrim =
        page.locator(".consent-scrim").first();

      if (await scrim.count() > 0) {
        cookieBlocking =
          await scrim.isVisible().catch(
            () => false
          );
      }
    } catch {
      cookieBlocking = false;
    }

    console.log(
      "Cookie scrim visible before click:",
      cookieBlocking
    );

    if (cookieBlocking) {
      console.log(
        "Cookie popup appeared again. Handling..."
      );

      await handleCookies(page);

      await page.waitForTimeout(700);
    }

    // ============================================
    // PRICE BUTTON
    // ============================================

    console.log(
      "Finding price button..."
    );

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

    console.log(
      "Price button disabled:",
      disabled
    );

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
            url.includes("/quote?opt=") &&
            response.status() === 200
          );
        },
        {
          timeout: 10000
        }
      );

    // ============================================
    // CLICK PRICE BUTTON
    // ============================================

    console.log(
      "Clicking price button using DOM..."
    );

    /*
     * IMPORTANT:
     * Playwright's priceButton.click() was hanging
     * on the Render environment.
     *
     * So we trigger the native DOM click directly.
     */

    const clickResult =
      await page.evaluate(() => {
        const button =
          document.querySelector(
            'button[aria-label="Check today’s price"]'
          );

        if (!button) {
          return {
            success: false,
            reason: "Price button not found"
          };
        }

        if (button.disabled) {
          return {
            success: false,
            reason: "Price button is disabled"
          };
        }

        button.click();

        return {
          success: true
        };
      });

    console.log(
      "DOM click result:",
      clickResult
    );

    if (!clickResult.success) {
      throw new Error(
        clickResult.reason ||
        "DOM click failed"
      );
    }

    console.log(
      "Price button clicked successfully."
    );

    // ============================================
    // WAIT FOR QUOTE API
    // ============================================

    try {
      const quoteResponse =
        await quoteResponsePromise;

      console.log(
        "Quote API response received:",
        quoteResponse.status()
      );
    } catch (error) {
      console.log(
        "Quote API did not return 200 within 10 seconds."
      );

      console.log(
        "Continuing because the page may still render the offer panel..."
      );
    }

    // ============================================
    // GIVE UI TIME TO RENDER
    // ============================================

    await page.waitForTimeout(1500);

    // ============================================
    // WAIT FOR FINAL OFFER PANEL
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
      );

      console.log(
        "Offer panel data detected."
      );
    } catch (error) {
      throw new Error(
        `Offer panel data did not load: ${error.message}`
      );
    }

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
    // NORMALIZE TEXT
    // ============================================

    /*
     * Convert full-width Unicode digits:
     *
     * １５,９３６
     *
     * into:
     *
     * 15,936
     */

    const normalizedDigits =
      panelText.replace(
        /[\uFF10-\uFF19]/g,
        char =>
          String.fromCharCode(
            char.charCodeAt(0) -
            0xFF10 +
            48
          )
      );

    const cleanPanelText =
      normalizedDigits.replace(
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
     * Usually the final ₹ amount is
     * the current/selling price.
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

    // SOLD OUT

    if (
      /SOLD OUT/i.test(cleanPanelText)
    ) {
      stock = "SOLD OUT";
    }

    // OUT OF STOCK

    if (
      /OUT OF STOCK/i.test(cleanPanelText)
    ) {
      stock = "OUT OF STOCK";
    }

    // AVAILABLE (99)

    if (!stock) {
      const availableBracket =
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        cleanPanelText.match(
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
        /IN STOCK/i.test(cleanPanelText)
      ) {
        stock = "IN STOCK";
      }
    }

    // AVAILABLE

    if (!stock) {
      if (
        /\bAVAILABLE\b/i.test(cleanPanelText)
      ) {
        stock = "AVAILABLE";
      }
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
      "\nSCRAPE FAILED:",
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

    return {
      success: false,
      error: error.message
    };

  } finally {

    // ============================================
    // SAFE BROWSER CLEANUP
    // ============================================

    console.log(
      "Starting browser cleanup..."
    );

    if (page) {
      try {
        await page.close({
          runBeforeUnload: false
        });

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
        await Promise.race([
          browser.close(),
          new Promise(resolve =>
            setTimeout(resolve, 5000)
          )
        ]);

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
  }
}

module.exports = {
  scrapeProduct
};