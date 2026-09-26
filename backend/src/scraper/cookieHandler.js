async function handleCookies(page) {
  console.log("Checking cookie consent...");

  try {
    // Small initial wait only.
    await page.waitForTimeout(300);

    const scrim = page.locator(".consent-scrim");

    const count = await scrim.count();

    console.log("Consent popup count:", count);

    if (count === 0) {
      console.log("No cookie popup found.");
      return true;
    }

    // Check whether scrim is actually blocking interaction.
    let blocking = false;

    try {
      blocking = await Promise.race([
        page.evaluate(() => {
          const element =
            document.querySelector(".consent-scrim");

          if (!element) {
            return false;
          }

          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();

          const hidden =
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0" ||
            style.pointerEvents === "none" ||
            rect.width === 0 ||
            rect.height === 0;

          return !hidden;
        }),

        new Promise((resolve) =>
          setTimeout(() => resolve(false), 3000)
        )
      ]);
    } catch {
      blocking = false;
    }

    console.log(
      "Consent scrim blocking interaction:",
      blocking
    );

    if (!blocking) {
      console.log(
        "Consent scrim is not blocking interaction."
      );
      return true;
    }

    console.log("COOKIE POPUP FOUND");

    /*
     * Find consent button.
     */
    const buttonTexts = [
      /^ALLOW$/i,
      /^ACCEPT$/i,
      /^ACCEPT ALL$/i,
      /^I AGREE$/i,
      /^OK$/i,
      /^CONTINUE$/i
    ];

    let consentButton = null;

    /*
     * First search inside dialog.
     */
    try {
      const dialog = page
        .locator('[role="dialog"][aria-modal="true"]')
        .first();

      const dialogCount = await dialog.count();

      console.log("Consent dialogs:", dialogCount);

      if (dialogCount > 0) {
        for (const pattern of buttonTexts) {
          try {
            const button = dialog
              .locator("button")
              .filter({ hasText: pattern })
              .first();

            if ((await button.count()) > 0) {
              consentButton = button;
              break;
            }
          } catch {
            // Continue searching.
          }
        }
      }
    } catch (error) {
      console.log(
        "Dialog search failed:",
        error.message
      );
    }

    /*
     * Fallback: search whole page.
     */
    if (!consentButton) {
      for (const pattern of buttonTexts) {
        try {
          const button = page
            .locator("button")
            .filter({ hasText: pattern })
            .first();

          if ((await button.count()) > 0) {
            consentButton = button;
            break;
          }
        } catch {
          // Continue searching.
        }
      }
    }

    if (!consentButton) {
      console.log("No consent button found.");

      /*
       * Try Escape without waiting for the page.
       */
      try {
        await Promise.race([
          page.keyboard.press("Escape"),
          new Promise((resolve) =>
            setTimeout(resolve, 1000)
          )
        ]);
      } catch {
        // Ignore.
      }

      return true;
    }

    console.log("Consent button found.");

    /*
     * Read button text with a hard timeout.
     */
    try {
      const text = await Promise.race([
        consentButton.innerText(),
        new Promise((resolve) =>
          setTimeout(() => resolve("UNKNOWN"), 1000)
        )
      ]);

      console.log("Consent button text:", text);
    } catch {
      console.log("Could not read consent button text.");
    }

    /*
     * IMPORTANT:
     * Click with a very small timeout.
     *
     * We DO NOT wait for the overlay to disappear.
     * We DO NOT run another DOM evaluation after click.
     *
     * This prevents Render from hanging here.
     */
    try {
      await consentButton.click({
        force: true,
        timeout: 2000,
        noWaitAfter: true
      });

      console.log("Consent button clicked.");
    } catch (error) {
      console.log(
        "Consent button click failed:",
        error.message
      );
    }

    /*
     * Do NOT wait for cookie UI/network.
     *
     * Just return immediately.
     */
    console.log(
      "Cookie handler finished without waiting for overlay."
    );

    return true;

  } catch (error) {
    console.log(
      "Cookie handler error:",
      error.message
    );

    /*
     * Cookie handling must NEVER stop the scraper.
     */
    return true;
  }
}

module.exports = {
  handleCookies
};