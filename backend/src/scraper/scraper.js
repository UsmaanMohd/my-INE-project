const { chromium } = require("playwright");

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* =========================================================
   TIMEOUT HELPER
========================================================= */

function withTimeout(promise, ms, message) {
  let timer = null;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    }),
    timeoutPromise,
  ]);
}

/* =========================================================
   MEMORY
========================================================= */

function logMemory(label) {
  const m = process.memoryUsage();

  console.log(
    `[MEMORY ${label}] RSS=${Math.round(
      m.rss / 1024 / 1024
    )}MB HEAP=${Math.round(
      m.heapUsed / 1024 / 1024
    )}MB`
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
      String.fromCharCode(
        char.charCodeAt(0) - 0xfee0
      )
    )
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   PRICE EXTRACTION
========================================================= */

function extractPrices(text) {
  const normalized = normalizeText(text);

  const prices = [];

  const parts = normalized.split("₹");

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();

    const match = part.match(
      /^(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?/
    );

    if (!match) {
      continue;
    }

    const integerPart =
      match[1].replace(/,/g, "");

    const value = Number(
      match[2]
        ? `${integerPart}.${match[2]}`
        : integerPart
    );

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 100000000
    ) {
      prices.push(value);
    }
  }

  return prices;
}

/* =========================================================
   STOCK EXTRACTION
========================================================= */

function extractStock(text) {
  const normalized =
    normalizeText(text).toUpperCase();

  const patterns = [
    /SOLD OUT/,
    /OUT OF STOCK/,
    /LAST FEW\s*[:\-]?\s*\d+/,
    /ONLY\s+\d+\s+LEFT/,
    /\d+\s*AVAILABLE/,
    /AVAILABLE\s*[:\-]?\s*\d+/,
    /STOCK\s*[:\-]?\s*\d+\s*REMAINING/,
    /\d+\s*REMAINING/,
    /\d+\s+LEFT/,
    /IN STOCK/,
    /AVAILABLE/,
  ];

  for (const pattern of patterns) {
    const match =
      normalized.match(pattern);

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
    const popup =
      page.locator(".consent-scrim").first();

    const count = await withTimeout(
      popup.count(),
      2000,
      "Cookie popup count timed out"
    );

    console.log(
      "Consent popup count:",
      count
    );

    if (count === 0) {
      console.log(
        "No cookie popup found."
      );
      return;
    }

    let visible = false;

    try {
      visible = await withTimeout(
        popup.isVisible(),
        1500,
        "Cookie visibility check timed out"
      );
    } catch {
      visible = false;
    }

    if (!visible) {
      console.log(
        "Cookie popup exists but is not visible."
      );
      return;
    }

    console.log(
      "Consent scrim blocking interaction: true"
    );

    console.log(
      "COOKIE POPUP FOUND"
    );

    const buttons =
      popup.locator("button");

    const buttonCount =
      await withTimeout(
        buttons.count(),
        2000,
        "Consent button count timed out"
      );

    console.log(
      "Consent dialogs:",
      buttonCount
    );

    let selectedButton = null;

    for (
      let i = 0;
      i < buttonCount;
      i++
    ) {
      try {
        const button =
          buttons.nth(i);

        const text =
          normalizeText(
            await withTimeout(
              button.innerText(),
              1000,
              "Consent button text timed out"
            )
          );

        if (
          /ALLOW|ACCEPT|AGREE|OK|CONTINUE|GOT IT/i.test(
            text
          )
        ) {
          selectedButton =
            button;

          console.log(
            "Consent button found."
          );

          console.log(
            "Consent button text:",
            text
          );

          break;
        }
      } catch {
        // Continue.
      }
    }

    if (!selectedButton) {
      console.log(
        "No suitable consent button found."
      );
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

      console.log(
        "Consent button clicked."
      );
    } catch (error) {
      console.log(
        "Consent click warning:",
        error.message
      );
    }

    await delay(500);

    console.log(
      "Cookie handler finished."
    );
  } catch (error) {
    console.log(
      "Cookie handler warning:",
      error.message
    );
  }
}

/* =========================================================
   COOKIE SCRIM
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
   OFFER PANEL
========================================================= */

async function getOfferPanel(page) {
  const selectors = [
    ".offer-panel.offer-locked",
    ".offer-panel",
    "[class*='offer-panel']",
  ];

  for (const selector of selectors) {
    try {
      const locator =
        page.locator(selector).first();

      const count =
        await withTimeout(
          locator.count(),
          1500,
          `Offer panel count timed out: ${selector}`
        );

      if (count > 0) {
        return locator;
      }
    } catch {
      // Try next selector.
    }
  }

  return null;
}

/* =========================================================
   PRICE BUTTON DETECTION
   MORE ROBUST THAN ONE CSS SELECTOR
========================================================= */

async function getPriceButton(page) {
  /*
   * First try known selectors.
   */
  const selectors = [
    'button[aria-label="Check today’s price"]',
    'button[aria-label="Check today\'s price"]',
    'button[aria-label*="Check today"]',
    'button[aria-label*="price"]',
    'button:has-text("CHECK AGAIN")',
    'button:has-text("Check today")',
    'button:has-text("CHECK TODAY")',
    'button:has-text("TODAY")',
  ];

  for (const selector of selectors) {
    try {
      const button =
        page.locator(selector).first();

      const count =
        await withTimeout(
          button.count(),
          1000,
          `Price button count timed out: ${selector}`
        );

      if (count > 0) {
        return button;
      }
    } catch {
      // Continue.
    }
  }

  /*
   * Fallback:
   * inspect visible buttons and their text/aria-label.
   *
   * This protects us if the site's exact button
   * markup changes slightly.
   */
  try {
    const buttons =
      page.locator("button");

    const count =
      await withTimeout(
        buttons.count(),
        1500,
        "Generic button count timed out"
      );

    for (
      let i = 0;
      i < count;
      i++
    ) {
      try {
        const button =
          buttons.nth(i);

        const visible =
          await withTimeout(
            button.isVisible(),
            700,
            "Generic button visibility timed out"
          );

        if (!visible) {
          continue;
        }

        let text = "";

        try {
          text =
            normalizeText(
              await withTimeout(
                button.innerText(),
                700,
                "Generic button text timed out"
              )
            );
        } catch {
          text = "";
        }

        let aria = "";

        try {
          aria =
            normalizeText(
              await withTimeout(
                button.getAttribute(
                  "aria-label"
                ),
                700,
                "Button aria-label timed out"
              )
            );
        } catch {
          aria = "";
        }

        const combined =
          `${text} ${aria}`.toLowerCase();

        if (
          combined.includes(
            "check today's price"
          ) ||
          combined.includes(
            "check today’s price"
          ) ||
          combined.includes(
            "check today"
          ) ||
          combined.includes(
            "check again"
          )
        ) {
          return button;
        }
      } catch {
        // Continue scanning.
      }
    }
  } catch {
    // Ignore fallback failure.
  }

  return null;
}

/* =========================================================
   CHECK PRICE BUTTON STATE
========================================================= */

async function isPriceButtonReady(button) {
  if (!button) {
    return false;
  }

  try {
    const visible =
      await withTimeout(
        button.isVisible(),
        1000,
        "Price button visibility timed out"
      );

    if (!visible) {
      return false;
    }

    const disabled =
      await withTimeout(
        button.isDisabled(),
        1000,
        "Price button disabled state timed out"
      );

    if (disabled) {
      return false;
    }

    /*
     * Also inspect common disabled attributes.
     */
    const ariaDisabled =
      await withTimeout(
        button.getAttribute(
          "aria-disabled"
        ),
        1000,
        "Price button aria-disabled timed out"
      );

    if (
      String(ariaDisabled).toLowerCase() ===
      "true"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   BOUNDED MOUSE MOVEMENT
   IMPORTANT:
   We do NOT perform hundreds of awaited mouse.move()
   calls.

   Instead we use Playwright's `steps` option.
   This generates mousemove events while keeping the
   operation bounded.
========================================================= */

async function safeMouseMove(
  page,
  x,
  y,
  steps,
  label
) {
  try {
    await withTimeout(
      page.mouse.move(x, y, { steps }),
      2500,
      `${label} mouse movement timed out`
    );

    return true;
  } catch (error) {
    console.log(
      `[${label}] Mouse movement warning:`,
      error.message
    );

    return false;
  }
}

/* =========================================================
   CHECK WHETHER PRICE BUTTON IS UNLOCKED
========================================================= */

async function checkPriceButtonUnlocked(
  page,
  label
) {
  const button =
    await getPriceButton(page);

  if (!button) {
    return null;
  }

  const ready =
    await isPriceButtonReady(button);

  if (ready) {
    console.log(
      `[${label}] Price button is READY.`
    );

    return button;
  }

  return null;
}

/* =========================================================
   UNLOCK HOVER
========================================================= */

async function performUnlockHover(
  page,
  label
) {
  console.log(
    `[${label}] Starting unlock hover...`
  );

  const panel =
    await getOfferPanel(page);

  if (!panel) {
    throw new Error(
      `[${label}] Offer panel not found`
    );
  }

  let box = null;

  try {
    box =
      await withTimeout(
        panel.boundingBox(),
        2000,
        `[${label}] Offer panel bounding box timed out`
      );
  } catch {
    box = null;
  }

  if (!box) {
    throw new Error(
      `[${label}] Offer panel position unavailable`
    );
  }

  console.log(
    `[${label}] Offer panel position:`,
    {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    }
  );

  /*
   * Keep the pointer inside the panel.
   * This is important because the site appears to
   * unlock the price button based on actual pointer
   * movement, not merely locator.hover().
   */
  const left =
    box.x + Math.min(10, box.width / 4);

  const right =
    box.x +
    Math.max(
      box.width - 10,
      box.width / 2
    );

  const top =
    box.y + Math.min(10, box.height / 4);

  const bottom =
    box.y +
    Math.max(
      box.height - 10,
      box.height / 2
    );

  const centerX =
    box.x + box.width / 2;

  const centerY =
    box.y + box.height / 2;

  /*
   * STEP A:
   * Direct hover first.
   */
  try {
    await withTimeout(
      panel.hover({
        force: true,
        timeout: 3000,
      }),
      4000,
      `[${label}] Direct hover timed out`
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

  await delay(300);

  let unlocked =
    await checkPriceButtonUnlocked(
      page,
      label
    );

  if (unlocked) {
    return unlocked;
  }

  /*
   * STEP B:
   * Move cursor to panel center.
   */
  await safeMouseMove(
    page,
    centerX,
    centerY,
    8,
    `${label} center`
  );

  await delay(250);

  unlocked =
    await checkPriceButtonUnlocked(
      page,
      label
    );

  if (unlocked) {
    return unlocked;
  }

  /*
   * STEP C:
   * Bounded sweep movements.
   *
   * Each call generates many mousemove events
   * internally, instead of 120 separate awaited
   * page.mouse.move() calls.
   */
  const movements = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
    [left, top, right, bottom],
    [right, bottom, left, top],
  ];

  for (
    let i = 0;
    i < movements.length;
    i++
  ) {
    const [
      startX,
      startY,
      endX,
      endY,
    ] = movements[i];

    console.log(
      `[${label}] Performing bounded hover movement ${
        i + 1
      }/${movements.length}...`
    );

    /*
     * Put cursor at the start.
     */
    await safeMouseMove(
      page,
      startX,
      startY,
      5,
      `${label} movement ${i + 1} start`
    );

    /*
     * Sweep across the panel.
     */
    await safeMouseMove(
      page,
      endX,
      endY,
      25,
      `${label} movement ${i + 1} sweep`
    );

    await delay(150);

    unlocked =
      await checkPriceButtonUnlocked(
        page,
        label
      );

    if (unlocked) {
      console.log(
        `[${label}] Price button unlocked during movement.`
      );

      return unlocked;
    }
  }

  /*
   * STEP D:
   * One final direct hover after mouse movement.
   */
  console.log(
    `[${label}] Performing final direct hover...`
  );

  try {
    await withTimeout(
      panel.hover({
        force: true,
        timeout: 3000,
      }),
      4000,
      `[${label}] Final direct hover timed out`
    );
  } catch (error) {
    console.log(
      `[${label}] Final hover warning:`,
      error.message
    );
  }

  await delay(500);

  unlocked =
    await checkPriceButtonUnlocked(
      page,
      label
    );

  if (unlocked) {
    return unlocked;
  }

  console.log(
    `[${label}] Price button still locked after hover recovery.`
  );

  return null;
}

/* =========================================================
   WAIT FOR PRICE BUTTON
   60 SECONDS
========================================================= */

async function waitForPriceButton(page) {
  const timeoutMs = 60000;

  console.log(
    `Waiting up to ${timeoutMs}ms for price button...`
  );

  const start = Date.now();

  /*
   * First check.
   */
  let button =
    await checkPriceButtonUnlocked(
      page,
      "PRICE"
    );

  if (button) {
    return button;
  }

  /*
   * Give the page a little time before recovery.
   */
  await delay(500);

  /*
   * Perform the real unlock hover.
   */
  button =
    await performUnlockHover(
      page,
      "PRICE HOVER"
    );

  if (button) {
    return button;
  }

  /*
   * Continue polling after hover.
   *
   * This protects against cases where the site
   * unlocks the button slightly after the
   * mouse movement.
   */
  while (
    Date.now() - start <
    timeoutMs
  ) {
    button =
      await checkPriceButtonUnlocked(
        page,
        "PRICE POLL"
      );

    if (button) {
      console.log(
        "Price button unlocked during polling."
      );

      return button;
    }

    /*
     * If button exists but is disabled,
     * perform another bounded recovery after
     * a reasonable interval.
     */
    if (
      Date.now() - start >
      15000 &&
      Date.now() - start <
      30000
    ) {
      console.log(
        "Price button still locked. Performing second bounded recovery..."
      );

      const recovered =
        await performUnlockHover(
          page,
          "PRICE RECOVERY"
        );

      if (recovered) {
        return recovered;
      }
    }

    await delay(500);
  }

  throw new Error(
    "Price button did not become available within 60 seconds"
  );
}

/* =========================================================
   READ OFFER PANEL
========================================================= */

async function readOfferPanel(page) {
  const panel =
    await getOfferPanel(page);

  if (!panel) {
    return {
      text: "",
      prices: [],
      price: null,
      stock: null,
    };
  }

  let text = "";

  try {
    text =
      await withTimeout(
        panel.textContent(),
        2500,
        "Offer panel textContent timed out"
      );
  } catch {
    try {
      text =
        await withTimeout(
          panel.innerText(),
          2500,
          "Offer panel innerText timed out"
        );
    } catch {
      text = "";
    }
  }

  text =
    normalizeText(text);

  const prices =
    extractPrices(text);

  const stock =
    extractStock(text);

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
   WAIT FOR RENDERED OFFER
========================================================= */

async function waitForOfferResult(
  page,
  timeoutMs = 30000
) {
  console.log(
    `[OFFER] Waiting up to ${timeoutMs}ms for rendered offer data...`
  );

  const start = Date.now();

  let lastText = "";

  while (
    Date.now() - start <
    timeoutMs
  ) {
    try {
      const result =
        await readOfferPanel(page);

      lastText =
        result.text;

      if (
        result.price !== null &&
        result.stock !== null
      ) {
        console.log(
          "[OFFER] Valid price + stock detected."
        );

        return result;
      }
    } catch (error) {
      console.log(
        "[OFFER] Read warning:",
        error.message
      );
    }

    await delay(500);
  }

  throw new Error(
    "Rendered offer data timeout after 30 seconds. " +
      `Last panel text: ${lastText.slice(
        0,
        500
      )}`
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
    console.log(
      "\n================================"
    );

    console.log(
      "SCRAPING:",
      productUrl
    );

    console.log(
      "OPTION:",
      selectedOption
    );

    console.log(
      "================================\n"
    );

    /* =====================================================
       STEP 1
    ===================================================== */

    console.log(
      "[STEP 1] Launching Chromium..."
    );

    logMemory("before-browser");

    browser =
      await withTimeout(
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

    console.log(
      "[STEP 1] Chromium launched."
    );

    logMemory("after-browser");

    /* =====================================================
       STEP 2
    ===================================================== */

    console.log(
      "[STEP 2] Creating browser context..."
    );

    context =
      await withTimeout(
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

    /* =====================================================
       STEP 3
    ===================================================== */

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

    /* =====================================================
       STEP 4
    ===================================================== */

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

    /* =====================================================
       STEP 5
    ===================================================== */

    console.log(
      "[STEP 5] Opening product page..."
    );

    logMemory(
      "before-page-goto"
    );

    await withTimeout(
      page.goto(productUrl, {
        waitUntil:
          "domcontentloaded",
        timeout: 30000,
      }),
      35000,
      "Product page loading timed out"
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

    /* =====================================================
       STEP 6
    ===================================================== */

    console.log(
      "[STEP 6] Checking cookie consent before option selection..."
    );

    console.log(
      "[STEP 6] Cookie handling START"
    );

    await safeHandleCookies(page);

    console.log(
      "[STEP 6] Cookie handling END"
    );

    console.log(
      "[STEP 6] Cookie handling completed."
    );

    /* =====================================================
       STEP 7
    ===================================================== */

    console.log(
      "[STEP 7] Selecting option:",
      selectedOption
    );

    const optionLocator =
      page
        .locator("button")
        .filter({
          hasText:
            selectedOption,
        });

    const optionCount =
      await withTimeout(
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

    const optionButton =
      optionLocator.first();

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

    await delay(700);

    /* =====================================================
       STEP 8
    ===================================================== */

    console.log(
      "[STEP 8] Preparing offer panel..."
    );

    const offerPanel =
      await getOfferPanel(page);

    if (!offerPanel) {
      throw new Error(
        "Offer panel not found"
      );
    }

    console.log(
      "[STEP 8B] Offer panel found."
    );

    /* =====================================================
       STEP 9
       INITIAL UNLOCK HOVER
    ===================================================== */

    console.log(
      "[STEP 9] Performing unlock hover..."
    );

    const initialButton =
      await performUnlockHover(
        page,
        "STEP 9"
      );

    if (initialButton) {
      console.log(
        "[STEP 9] Price button unlocked."
      );
    } else {
      console.log(
        "[STEP 9] Price button not unlocked yet."
      );
    }

    logMemory(
      "after-first-hover"
    );

    /* =====================================================
       STEP 10
    ===================================================== */

    console.log(
      "[STEP 10] Checking cookie consent after hover..."
    );

    await safeHandleCookies(page);

    console.log(
      "[STEP 10] Cookie handling completed."
    );

    const scrimVisible =
      await getCookieScrimVisible(
        page
      );

    console.log(
      "[STEP 10] Cookie scrim visible:",
      scrimVisible
    );

    /* =====================================================
       STEP 11
       RECOVERY ONLY IF NECESSARY
    ===================================================== */

    console.log(
      "[STEP 11] Checking whether price button is unlocked..."
    );

    let priceButton =
      await checkPriceButtonUnlocked(
        page,
        "STEP 11"
      );

    if (!priceButton) {
      console.log(
        "[STEP 11] Price button still locked. Starting bounded recovery..."
      );

      priceButton =
        await performUnlockHover(
          page,
          "STEP 11 RECOVERY"
        );
    }

    if (priceButton) {
      console.log(
        "[STEP 11] Price button unlocked."
      );
    } else {
      console.log(
        "[STEP 11] Price button still not ready."
      );
    }

    /* =====================================================
       STEP 12
    ===================================================== */

    console.log(
      "[STEP 12] Waiting for price button..."
    );

    priceButton =
      await waitForPriceButton(
        page
      );

    console.log(
      "[STEP 12] Price button unlocked."
    );

    /* =====================================================
       STEP 13
    ===================================================== */

    console.log(
      "[STEP 13] Final cookie check..."
    );

    const finalScrim =
      await getCookieScrimVisible(
        page
      );

    console.log(
      "[STEP 13] Cookie scrim visible:",
      finalScrim
    );

    if (finalScrim) {
      await safeHandleCookies(
        page
      );
    }

    /* =====================================================
       STEP 14
    ===================================================== */

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
        "Price button state timed out"
      );

    console.log(
      "[STEP 14] Price button disabled:",
      disabled
    );

    if (disabled) {
      /*
       * One final bounded recovery.
       */
      console.log(
        "[STEP 14] Button became disabled. Performing final recovery..."
      );

      const recovered =
        await performUnlockHover(
          page,
          "STEP 14 RECOVERY"
        );

      if (!recovered) {
        throw new Error(
          "Price button is disabled after final recovery"
        );
      }
    }

    /* =====================================================
       STEP 15
       QUOTE LISTENER BEFORE CLICK
    ===================================================== */

    console.log(
      "[STEP 15] Preparing quote API listener..."
    );

    const quotePromise =
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
            )
          );
        },
        {
          timeout: 45000,
        }
      );

    console.log(
      "[STEP 15] Quote listener ready."
    );

    /* =====================================================
       STEP 16
    ===================================================== */

    console.log(
      "[STEP 16] Clicking price button..."
    );

    const clickButton =
      await getPriceButton(page);

    if (!clickButton) {
      throw new Error(
        "Price button not found before click"
      );
    }

    const clickReady =
      await isPriceButtonReady(
        clickButton
      );

    if (!clickReady) {
      throw new Error(
        "Price button is not ready before click"
      );
    }

    await withTimeout(
      clickButton.click({
        force: true,
        timeout: 5000,
      }),
      6000,
      "Price button click timed out"
    );

    console.log(
      "[STEP 16] Playwright click completed."
    );

    /* =====================================================
       STEP 17
    ===================================================== */

    console.log(
      "[STEP 17] Waiting for quote API..."
    );

    let quoteResponse;

    try {
      quoteResponse =
        await quotePromise;
    } catch (error) {
      throw new Error(
        `Quote API did not respond within 45 seconds: ${error.message}`
      );
    }

    console.log(
      "[STEP 17] Quote response received:",
      quoteResponse.status(),
      quoteResponse.url()
    );

    if (!quoteResponse.ok()) {
      throw new Error(
        `Quote API returned HTTP ${quoteResponse.status()}`
      );
    }

    /* =====================================================
       STEP 18
    ===================================================== */

    console.log(
      "[STEP 18] Waiting for rendered offer data..."
    );

    const offerResult =
      await waitForOfferResult(
        page,
        30000
      );

    console.log(
      "[STEP 18] Valid offer data detected."
    );

    /* =====================================================
       STEP 19
    ===================================================== */

    console.log(
      "[STEP 19] Reading offer panel..."
    );

    console.log(
      "\n========== OFFER PANEL ==========\n"
    );

    console.log(
      offerResult.text
    );

    /* =====================================================
       STEP 20
    ===================================================== */

    console.log(
      "[STEP 20] Extracting price..."
    );

    const prices =
      offerResult.prices;

    console.log(
      "Detected prices:",
      prices
    );

    if (prices.length === 0) {
      throw new Error(
        "No valid price found"
      );
    }

    const price =
      prices[prices.length - 1];

    /* =====================================================
       STEP 21
    ===================================================== */

    console.log(
      "[STEP 21] Extracting stock..."
    );

    const stock =
      offerResult.stock;

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