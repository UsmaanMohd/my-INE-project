const { chromium } = require("playwright");
const { handleCookies } = require("./cookieHandler");

// PUBLIC ENTRY POINT: this is what the rest of your app calls.
// It never hangs forever — if the actual scrape logic (runScrapeAttempt)
// doesn't finish within `timeoutMs`, the watchdog force-closes whatever
// browser/context/page exist and returns a normal failure object instead
// of letting the caller wait indefinitely with no result at all.
async function scrapeProduct({
  productUrl,
  selectedOption,
  timeoutMs = 90000 // 90s hard cap — tune this if your real scrapes legitimately take longer
}) {
  const resources = { browser: null, context: null, page: null };
  let settled = false;

  const attemptPromise = runScrapeAttempt({
    productUrl,
    selectedOption,
    resources
  })
    .then(result => {
      settled = true;
      return result;
    })
    .catch(error => {
      settled = true;
      return { success: false, error: error.message };
    });

  const watchdogPromise = new Promise(resolve => {
    setTimeout(async () => {
      if (settled) return; // real attempt already finished, ignore the watchdog

      console.log(
        `WATCHDOG: scrape exceeded ${timeoutMs}ms — forcing browser cleanup`
      );

      // Each close call gets its OWN short timeout. If the page/browser is
      // fully frozen (e.g. the site is stuck in a heavy JS loop), even
      // browser.close() can hang waiting for a response that never comes.
      // Racing every close against a short timer guarantees the watchdog
      // itself always resolves, no matter how dead the browser is.
      const CLOSE_TIMEOUT_MS = 5000;

      const raceClose = (label, closeFn) =>
        Promise.race([
          closeFn().catch(() => {}),
          new Promise(res =>
            setTimeout(() => {
              console.log(`WATCHDOG: ${label} close did not finish in time, giving up on it`);
              res();
            }, CLOSE_TIMEOUT_MS)
          )
        ]);

      if (resources.page) {
        await raceClose("page", () =>
          resources.page.close({ runBeforeUnload: false })
        );
      }

      if (resources.context) {
        await raceClose("context", () => resources.context.close());
      }

      if (resources.browser) {
        await raceClose("browser", () => resources.browser.close());
      }

      console.log("WATCHDOG: cleanup pass finished, resolving as failure");

      resolve({
        success: false,
        error: `Scrape timed out after ${timeoutMs}ms (watchdog killed browser)`
      });
    }, timeoutMs);
  });

  return Promise.race([attemptPromise, watchdogPromise]);
}

// ACTUAL SCRAPE LOGIC — unchanged from before, except browser/context/page
// are now written onto the shared `resources` object so the watchdog above
// can reach them and force-close if this function hangs.
async function runScrapeAttempt({
  productUrl,
  selectedOption,
  resources
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
    // LAUNCH CHROMIUM
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
    resources.browser = browser; // let the watchdog see it immediately

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
    resources.context = context; // let the watchdog see it immediately

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
    resources.page = page; // let the watchdog see it immediately

    // ============================================
    // OPEN PRODUCT PAGE
    // ============================================

    console.log("Opening product page...");

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });

    console.log("Product page loaded.");

    await page.waitForTimeout(1000);

    console.log(
      "Initial page preparation completed."
    );

    // ============================================
    // NETWORK DIAGNOSTICS
    // ============================================

    console.log(
      "Installing network diagnostics..."
    );

    let quoteRequests = 0;
    let quoteResponses = 0;
    let quoteLastStatus = null;
    let quoteLastUrl = null;

    page.on("request", request => {
      const url = request.url();

      if (
        url.includes("/api/") ||
        url.includes("/quote") ||
        url.includes("/items/")
      ) {
        quoteRequests++;

        console.log(
          ">>> REQUEST:",
          request.method(),
          url
        );
      }
    });

    page.on("response", response => {
      const url = response.url();

      if (
        url.includes("/api/") ||
        url.includes("/quote") ||
        url.includes("/items/")
      ) {
        quoteResponses++;

        quoteLastStatus =
          response.status();

        quoteLastUrl = url;

        console.log(
          "<<< RESPONSE:",
          response.status(),
          url
        );
      }
    });

    page.on("requestfailed", request => {
      const url = request.url();

      if (
        url.includes("/api/") ||
        url.includes("/quote") ||
        url.includes("/items/")
      ) {
        console.log(
          "XXX REQUEST FAILED:",
          request.method(),
          url,
          "ERROR:",
          request.failure()?.errorText
        );
      }
    });

    console.log(
      "Network diagnostics ready."
    );

    // ============================================
    // COOKIE CHECK
    // ============================================

    console.log(
      "Checking cookie consent before option selection..."
    );

    await handleCookies(page);

    // ============================================
    // SELECT OPTION
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
    // FIND OFFER PANEL
    // ============================================

    const offerPanel =
      page.locator(
        ".offer-panel.offer-locked"
      );

    console.log(
      "Waiting for locked offer panel..."
    );

    await offerPanel.first().waitFor({
      state: "visible",
      timeout: 15000
    });

    console.log(
      "Locked offer panel found."
    );

    // ============================================
    // OFFER PANEL POSITION
    // ============================================

    console.log(
      "Getting offer panel position..."
    );

    const box =
      await offerPanel
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

    // ============================================
    // HOVER FUNCTION
    // ============================================

    async function performHoverMovements(
      currentBox
    ) {
      const centerX =
        currentBox.x +
        currentBox.width / 2;

      const centerY =
        currentBox.y +
        currentBox.height / 2;

      console.log(
        "Performing hover movements..."
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
        "120 mouse movements completed"
      );
    }

    // ============================================
    // FIRST HOVER
    // ============================================

    await performHoverMovements(box);

    await page.waitForTimeout(500);

    // ============================================
    // COOKIE AFTER HOVER
    // ============================================

    console.log(
      "Checking cookie consent after hover movements..."
    );

    // FIX #2: capture whether handleCookies actually did something.
    // A popup that appears mid-hover and gets closed here still disturbs
    // the page's state, so we should re-run the hover in that case even
    // if the scrim itself is no longer visible right afterwards.
    const cookieHandledAfterFirstHover =
      await handleCookies(page);

    await page.waitForTimeout(500);

    // ============================================
    // COOKIE SCRIM CHECK
    // ============================================

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

    let scrimVisible =
      await isCookieScrimVisible();

    console.log(
      "Cookie scrim visible after hover:",
      scrimVisible
    );

    // ============================================
    // COOKIE RECOVERY
    // ============================================

    // FIX #2: also repeat hover when a popup was handled during/after the
    // first hover, not only when the scrim is still stuck visible.
    if (scrimVisible || cookieHandledAfterFirstHover) {
      console.log(
        scrimVisible
          ? "Cookie scrim still blocking. Trying recovery..."
          : "Cookie popup appeared and was closed during hover. Repeating hover to be safe..."
      );

      if (scrimVisible) {
        await handleCookies(page);

        await page.waitForTimeout(700);

        scrimVisible =
          await isCookieScrimVisible();

        console.log(
          "Cookie scrim visible after recovery:",
          scrimVisible
        );

        if (scrimVisible) {
          throw new Error(
            "Cookie consent overlay is still blocking the page"
          );
        }
      }

      // Repeat hover

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

      await performHoverMovements(
        newBox
      );

      console.log(
        "Second hover completed."
      );

      await page.waitForTimeout(1000);
    }

    // ============================================
    // FIND PRICE BUTTON
    // ============================================

    console.log(
      "Waiting for price button to unlock (30000ms max)..."
    );

    // FIX #1: the previous hardcoded selector used a curly apostrophe
    // (’) inside 'button[aria-label="Check today's price"]', which does
    // NOT match a straight apostrophe (') in the real page's aria-label
    // (or vice versa) — they are different characters. That mismatch is
    // why the button was never found and the 30s wait always timed out.
    // getByRole with a regex sidesteps the apostrophe entirely.
    const priceButton = page.getByRole("button", {
      name: /check today.?s price/i
    });

    const unlockStart =
      Date.now();

    let priceButtonUnlocked = false;

    while (
      Date.now() - unlockStart <
      30000
    ) {
      try {
        const exists =
          (await priceButton.count()) > 0;

        const disabled =
          exists
            ? await priceButton
                .first()
                .isDisabled()
                .catch(() => true)
            : true;

        if (exists && !disabled) {
          priceButtonUnlocked = true;
          break;
        }

      } catch (error) {
        console.log(
          "Price button polling warning:",
          error.message
        );
      }

      await page.waitForTimeout(1000);
    }

    if (!priceButtonUnlocked) {
      throw new Error(
        "Price button did not unlock within 30 seconds"
      );
    }

    console.log(
      "Price button unlocked."
    );

    // ============================================
    // COOKIE CHECK BEFORE CLICK
    // ============================================

    console.log(
      "Checking cookie consent before price click..."
    );

    await handleCookies(page);

    await page.waitForTimeout(500);

    scrimVisible =
      await isCookieScrimVisible();

    console.log(
      "Cookie scrim visible before click:",
      scrimVisible
    );

    if (scrimVisible) {
      console.log(
        "Cookie popup appeared again. Handling..."
      );

      await handleCookies(page);

      await page.waitForTimeout(700);

      scrimVisible =
        await isCookieScrimVisible();

      console.log(
        "Cookie scrim visible after final recovery:",
        scrimVisible
      );

      if (scrimVisible) {
        throw new Error(
          "Cookie consent overlay is blocking price button"
        );
      }
    }

    // ============================================
    // PRICE BUTTON LOCATOR
    // ============================================

    console.log(
      "Finding price button..."
    );

    await priceButton.first().waitFor({
      state: "visible",
      timeout: 10000
    });

    const disabled =
      await priceButton.first().isDisabled();

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
    // NETWORK COUNTERS BEFORE CLICK
    // ============================================

    const requestsBeforeClick =
      quoteRequests;

    const responsesBeforeClick =
      quoteResponses;

    console.log(
      "Quote requests before click:",
      requestsBeforeClick
    );

    console.log(
      "Quote responses before click:",
      responsesBeforeClick
    );

    // ============================================
    // REAL PLAYWRIGHT CLICK
    // ============================================

    console.log(
      "Clicking price button using Playwright..."
    );

    let clickSuccessful = false;

    try {
      await priceButton.first().scrollIntoViewIfNeeded();

      const buttonBox =
        await priceButton.first().boundingBox();

      console.log(
        "Price button bounding box:",
        buttonBox
      );

      if (!buttonBox) {
        throw new Error(
          "Price button has no bounding box"
        );
      }

      await priceButton.first().click({
        timeout: 10000,
        force: true
      });

      clickSuccessful = true;

      console.log(
        "Playwright price button click completed."
      );

    } catch (error) {
      console.log(
        "Playwright click failed:",
        error.message
      );
    }

    // ============================================
    // MOUSE FALLBACK
    // ============================================

    if (!clickSuccessful) {
      console.log(
        "Trying mouse click fallback..."
      );

      const buttonBox =
        await priceButton.first().boundingBox();

      if (!buttonBox) {
        throw new Error(
          "Price button disappeared before mouse click"
        );
      }

      await page.mouse.click(
        buttonBox.x +
          buttonBox.width / 2,
        buttonBox.y +
          buttonBox.height / 2
      );

      clickSuccessful = true;

      console.log(
        "Mouse click fallback completed."
      );
    }

    console.log(
      "Price button click completed successfully."
    );

    // ============================================
    // WAIT FOR NETWORK ACTIVITY
    // ============================================

    console.log(
      "Waiting for quote/network activity (10000ms max)..."
    );

    const networkStart =
      Date.now();

    let networkActivityDetected =
      false;

    while (
      Date.now() - networkStart <
      10000
    ) {
      if (
        quoteRequests >
        requestsBeforeClick
      ) {
        networkActivityDetected = true;
        break;
      }

      if (
        quoteResponses >
        responsesBeforeClick
      ) {
        networkActivityDetected = true;
        break;
      }

      await page.waitForTimeout(500);
    }

    // ============================================
    // NETWORK DIAGNOSTICS
    // ============================================

    console.log(
      "================================"
    );

    console.log(
      "QUOTE NETWORK DIAGNOSTICS"
    );

    console.log(
      "Quote requests before click:",
      requestsBeforeClick
    );

    console.log(
      "Quote requests after click:",
      quoteRequests
    );

    console.log(
      "Quote responses before click:",
      responsesBeforeClick
    );

    console.log(
      "Quote responses after click:",
      quoteResponses
    );

    console.log(
      "Last quote status:",
      quoteLastStatus
    );

    console.log(
      "Last quote URL:",
      quoteLastUrl
    );

    console.log(
      "Network activity detected:",
      networkActivityDetected
    );

    console.log(
      "================================"
    );

    // ============================================
    // WAIT FOR UI
    // ============================================

    await page.waitForTimeout(1500);

    // ============================================
    // WAIT FOR OFFER PANEL DATA
    // ============================================

    console.log(
      "Waiting for offer panel data..."
    );

    const panelStart =
      Date.now();

    let panelDataDetected = false;

    let currentPanelText = "";

    while (
      Date.now() - panelStart <
      15000
    ) {
      try {
        currentPanelText =
          await page
            .locator(".offer-panel")
            .first()
            .innerText()
            .catch(() => "");

        const hasPrice =
          /₹/.test(
            currentPanelText
          );

        const hasLoaded =
          /Loaded in/i.test(
            currentPanelText
          );

        const hasCheckAgain =
          /CHECK AGAIN/i.test(
            currentPanelText
          );

        const hasSoldOut =
          /SOLD OUT/i.test(
            currentPanelText
          );

        const hasOutOfStock =
          /OUT OF STOCK/i.test(
            currentPanelText
          );

        const hasAvailable =
          /AVAILABLE/i.test(
            currentPanelText
          );

        const hasRemaining =
          /REMAINING/i.test(
            currentPanelText
          );

        const hasLastFew =
          /LAST FEW/i.test(
            currentPanelText
          );

        if (
          hasPrice ||
          hasLoaded ||
          hasCheckAgain ||
          hasSoldOut ||
          hasOutOfStock ||
          hasAvailable ||
          hasRemaining ||
          hasLastFew
        ) {
          panelDataDetected = true;
          break;
        }

      } catch (error) {
        console.log(
          "Offer panel polling warning:",
          error.message
        );
      }

      await page.waitForTimeout(500);
    }

    if (!panelDataDetected) {
      console.log(
        "Final offer panel text before failure:"
      );

      console.log(
        currentPanelText
      );

      throw new Error(
        "Offer panel data did not load within 15 seconds"
      );
    }

    console.log(
      "Offer panel data detected."
    );

    // ============================================
    // GET PANEL TEXT
    // ============================================

    const panel =
      page
        .locator(".offer-panel")
        .first();

    const panelText =
      await panel.innerText();

    console.log(
      "\n========== OFFER PANEL =========="
    );

    console.log(
      panelText
    );

    // ============================================
    // NORMALIZE FULL WIDTH DIGITS
    // ============================================

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

    if (
      /SOLD OUT/i.test(
        cleanPanelText
      )
    ) {
      stock = "SOLD OUT";
    }

    if (
      !stock &&
      /OUT OF STOCK/i.test(
        cleanPanelText
      )
    ) {
      stock = "OUT OF STOCK";
    }

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

    if (!stock) {
      if (
        /IN STOCK/i.test(
          cleanPanelText
        )
      ) {
        stock = "IN STOCK";
      }
    }

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
    // CLEANUP
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
            setTimeout(
              resolve,
              5000
            )
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