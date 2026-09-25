const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const page = await browser.newPage();

  // =========================================================
  // NETWORK LOGGING
  // =========================================================

  console.log("\n========== NETWORK LOGGING ==========\n");

  page.on("request", request => {
    const type = request.resourceType();

    if (
      type === "xhr" ||
      type === "fetch" ||
      type === "document"
    ) {
      console.log(
        "REQUEST:",
        type,
        request.method(),
        request.url()
      );
    }
  });

  page.on("response", response => {
    const type = response.request().resourceType();

    if (
      type === "xhr" ||
      type === "fetch"
    ) {
      console.log(
        "RESPONSE:",
        response.status(),
        response.url()
      );
    }
  });

  page.on("console", msg => {
    console.log(
      "PAGE CONSOLE:",
      msg.text()
    );
  });

  page.on("pageerror", error => {
    console.log(
      "PAGE ERROR:",
      error.message
    );
  });

  // =========================================================
  // OPEN PAGE
  // =========================================================

  console.log(
    "\n========== OPENING PAGE ==========\n"
  );

  await page.goto(
    "https://demo.inelabteamdev.com/item/2638",
    {
      waitUntil: "networkidle",
      timeout: 60000
    }
  );

  console.log("Page loaded");

  await page.waitForTimeout(3000);

  // =========================================================
  // COOKIE HANDLER
  // =========================================================

  console.log(
    "\n========== COOKIE HANDLER ==========\n"
  );

  const consentScrim =
    page.locator(".consent-scrim");

  const consentBox =
    page.locator(".consent-box");

  console.log(
    "Consent scrim count:",
    await consentScrim.count()
  );

  if (await consentScrim.count()) {

    const visible =
      await consentScrim
        .first()
        .isVisible()
        .catch(() => false);

    console.log(
      "Consent visible:",
      visible
    );

    if (visible) {

      console.log(
        "COOKIE POPUP FOUND"
      );

      const allowButton =
        consentBox
          .first()
          .locator("button")
          .filter({
            hasText: /^ALLOW$/i
          });

      console.log(
        "ALLOW button count:",
        await allowButton.count()
      );

      if (await allowButton.count()) {

        console.log(
          "Clicking ALLOW..."
        );

        await allowButton
          .first()
          .click({
            force: true,
            timeout: 5000
          })
          .catch(error => {
            console.log(
              "Normal force click failed:",
              error.message
            );
          });

        await page.waitForTimeout(1500);
      }

      // -------------------------------------------------------
      // Check if popup actually disappeared
      // -------------------------------------------------------

      let popupStillVisible =
        await consentScrim
          .first()
          .isVisible()
          .catch(() => false);

      console.log(
        "Popup visible after ALLOW:",
        popupStillVisible
      );

      // -------------------------------------------------------
      // If still blocking page, hide overlay
      // -------------------------------------------------------

      if (popupStillVisible) {

        console.log(
          "Popup still blocking page."
        );

        console.log(
          "Removing consent overlay..."
        );

        await page.evaluate(() => {

          const scrim =
            document.querySelector(
              ".consent-scrim"
            );

          if (scrim) {
            scrim.style.display = "none";
            scrim.style.pointerEvents = "none";
          }

          const box =
            document.querySelector(
              ".consent-box"
            );

          if (box) {
            box.style.display = "none";
          }
        });

        await page.waitForTimeout(500);

        popupStillVisible =
          await consentScrim
            .first()
            .isVisible()
            .catch(() => false);

        console.log(
          "Popup visible after force removal:",
          popupStillVisible
        );
      }

    } else {

      console.log(
        "Consent popup exists but is not visible."
      );
    }

  } else {

    console.log(
      "No cookie popup found."
    );
  }

  // =========================================================
  // VERIFY PAGE IS CLICKABLE
  // =========================================================

  console.log(
    "\n========== VERIFYING PAGE ==========\n"
  );

  console.log(
    "Consent scrim visible:",
    await consentScrim
      .first()
      .isVisible()
      .catch(() => false)
  );

  // =========================================================
  // PRODUCT OPTIONS
  // =========================================================

  console.log(
    "\n========== PRODUCT OPTIONS ==========\n"
  );

  const optionButtons =
    page.locator(
      ".opt-picker .opt-chip"
    );

  console.log(
    "Option buttons:",
    await optionButtons.count()
  );

  if (await optionButtons.count()) {

    console.log(
      "Available options:",
      await optionButtons
        .allTextContents()
    );

    const twoPack =
      optionButtons.filter({
        hasText: /^2-pack$/i
      });

    console.log(
      "2-pack count:",
      await twoPack.count()
    );

    if (await twoPack.count()) {

      console.log(
        "Selecting 2-pack..."
      );

      await twoPack
        .first()
        .click({
          timeout: 10000
        });

      await page.waitForTimeout(2000);

      console.log(
        "2-pack selected"
      );

    } else {

      console.log(
        "2-pack not found."
      );
    }
  }

  // =========================================================
  // PRICE PANEL
  // =========================================================

  console.log(
    "\n========== PRICE PANEL ==========\n"
  );

  const panel =
    page
      .locator(
        ".offer-panel.offer-locked"
      )
      .first();

  console.log(
    "Panel count:",
    await panel.count()
  );

  if (await panel.count()) {

    console.log(
      "\nPANEL HTML:\n"
    );

    console.log(
      await panel.evaluate(
        el => el.outerHTML
      )
    );

    console.log(
      "\nPARENT HTML:\n"
    );

    console.log(
      await panel.evaluate(
        el => el.parentElement?.outerHTML
      )
    );
  }

  // =========================================================
  // PRICE BUTTON
  // =========================================================

  const button =
    page.locator(
      'button[aria-label="Check today’s price"]'
    );

  console.log(
    "\nPrice button count:",
    await button.count()
  );

  if (await button.count()) {

    console.log(
      "Initial disabled:",
      await button.isDisabled()
    );
  }

  // =========================================================
  // REAL MOUSE MOVEMENT
  // =========================================================

  console.log(
    "\n========== REAL HOVER ==========\n"
  );

  if (await panel.count()) {

    const box =
      await panel.boundingBox();

    console.log(
      "Panel box:",
      box
    );

    if (box) {

      // -------------------------------------------------------
      // Start outside panel
      // -------------------------------------------------------

      await page.mouse.move(
        box.x - 100,
        box.y + box.height / 2
      );

      await page.waitForTimeout(500);

      // -------------------------------------------------------
      // Enter panel
      // -------------------------------------------------------

      await page.mouse.move(
        box.x + 10,
        box.y + 10
      );

      console.log(
        "Entered price panel"
      );

      // -------------------------------------------------------
      // Generate 120 mouse movements
      // -------------------------------------------------------

      for (let i = 0; i < 120; i++) {

        const x =
          box.x +
          20 +
          (
            (i * 37) %
            Math.max(
              50,
              box.width - 40
            )
          );

        const y =
          box.y +
          15 +
          (
            (i * 17) %
            Math.max(
              30,
              box.height - 30
            )
          );

        await page.mouse.move(
          x,
          y
        );

        await page.waitForTimeout(50);
      }

      console.log(
        "120 mouse movements completed"
      );

      // -------------------------------------------------------
      // Stay inside panel
      // -------------------------------------------------------

      await page.mouse.move(
        box.x + box.width / 2,
        box.y + box.height / 2
      );

      console.log(
        "Mouse kept inside panel"
      );

      // -------------------------------------------------------
      // Wait for unlock
      // -------------------------------------------------------

      console.log(
        "\nWaiting for price unlock..."
      );

      for (let i = 1; i <= 10; i++) {

        await page.waitForTimeout(
          1000
        );

        const disabled =
          await button
            .isDisabled()
            .catch(() => true);

        console.log(
          `Second ${i}: disabled =`,
          disabled
        );

        if (!disabled) {

          console.log(
            "\n🔥 PRICE BUTTON UNLOCKED!"
          );

          break;
        }
      }
    }
  }

  // =========================================================
  // CLICK PRICE
  // =========================================================

  console.log(
    "\n========== PRICE BUTTON ==========\n"
  );

  if (await button.count()) {

    const disabled =
      await button.isDisabled();

    console.log(
      "Button disabled:",
      disabled
    );

    if (!disabled) {

      console.log(
        "🔥 Clicking CHECK TODAY'S PRICE..."
      );

      await button.click();

      console.log(
        "Price button clicked"
      );

      await page.waitForTimeout(
        5000
      );

    } else {

      console.log(
        "❌ Button is still disabled."
      );
    }
  }

  // =========================================================
  // FINAL PAGE
  // =========================================================

  console.log(
    "\n========== FINAL PAGE TEXT ==========\n"
  );

  console.log(
    await page
      .locator("body")
      .innerText()
  );

  // =========================================================
  // FINAL BUTTON HTML
  // =========================================================

  console.log(
    "\n========== FINAL BUTTON HTML ==========\n"
  );

  if (await button.count()) {

    console.log(
      await button.evaluate(
        el => el.outerHTML
      )
    );
  }

  // =========================================================
  // SCREENSHOT
  // =========================================================

  await page.screenshot({
    path: "final-debug.png",
    fullPage: true
  });

  console.log(
    "\nScreenshot saved: final-debug.png"
  );

  // =========================================================
  // DONE
  // =========================================================

  console.log(
    "\n======================================"
  );

  console.log(
    "DONE"
  );

  console.log(
    "======================================"
  );

  await page.waitForTimeout(
    10000
  );

  await browser.close();

})();