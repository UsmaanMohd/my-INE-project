async function handleCookies(page) {
  console.log("Checking cookie consent...");

  try {
    await page.waitForTimeout(500);

    const scrim = page.locator(".consent-scrim");

    const count = await scrim.count();

    console.log("Consent popup count:", count);

    if (count === 0) {
      console.log("No cookie popup found.");
      return true;
    }

    const isBlocking = async () => {
      return await page
        .evaluate(() => {
          const scrimElement =
            document.querySelector(".consent-scrim");

          if (!scrimElement) {
            return false;
          }

          const style =
            window.getComputedStyle(
              scrimElement
            );

          const rect =
            scrimElement.getBoundingClientRect();

          const hidden =
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0" ||
            style.pointerEvents === "none" ||
            rect.width === 0 ||
            rect.height === 0;

          return !hidden;
        })
        .catch(() => false);
    };

    let blocking = await isBlocking();

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
     * Try common consent button names.
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
     * Search inside the actual consent dialog first.
     */
    const dialog =
      page.locator(
        '[role="dialog"][aria-modal="true"]'
      ).first();

    const dialogCount =
      await dialog.count();

    console.log(
      "Consent dialogs:",
      dialogCount
    );

    if (dialogCount > 0) {
      for (
        const textPattern of buttonTexts
      ) {
        const button =
          dialog
            .locator("button")
            .filter({
              hasText: textPattern
            })
            .first();

        if (
          await button.count() > 0
        ) {
          consentButton = button;
          break;
        }
      }
    }

    /*
     * Fallback: search the whole page.
     */
    if (!consentButton) {
      for (
        const textPattern of buttonTexts
      ) {
        const button =
          page
            .locator("button")
            .filter({
              hasText: textPattern
            })
            .first();

        if (
          await button.count() > 0
        ) {
          consentButton = button;
          break;
        }
      }
    }

    if (consentButton) {
      console.log(
        "Consent button found."
      );

      try {
        console.log(
          "Consent button text:",
          await consentButton.innerText()
        );
      } catch {
        // Ignore text read failure.
      }

      try {
        await consentButton.click({
          force: true,
          timeout: 5000
        });

        console.log(
          "Consent button clicked."
        );
      } catch (error) {
        console.log(
          "Consent button click failed:",
          error.message
        );
      }
    } else {
      console.log(
        "No consent button found."
      );
    }

    /*
     * Give the page time to remove/update
     * the consent overlay.
     */
    await page.waitForTimeout(700);

    blocking =
      await isBlocking();

    console.log(
      "Scrim blocking after consent click:",
      blocking
    );

    if (!blocking) {
      console.log(
        "COOKIE CONSENT HANDLED SUCCESSFULLY"
      );

      return true;
    }

    /*
     * Fallback 1: Escape.
     */
    console.log(
      "Consent scrim still blocking. Trying Escape..."
    );

    try {
      await page.keyboard.press(
        "Escape"
      );
    } catch (error) {
      console.log(
        "Escape failed:",
        error.message
      );
    }

    await page.waitForTimeout(500);

    blocking =
      await isBlocking();

    console.log(
      "Scrim blocking after Escape:",
      blocking
    );

    if (!blocking) {
      console.log(
        "COOKIE CONSENT HANDLED WITH ESCAPE"
      );

      return true;
    }

    /*
     * Fallback 2: try the consent button again.
     */
    if (consentButton) {
      console.log(
        "Trying consent button again..."
      );

      try {
        await consentButton.click({
          force: true,
          timeout: 3000
        });
      } catch (error) {
        console.log(
          "Second consent click failed:",
          error.message
        );
      }

      await page.waitForTimeout(700);

      blocking =
        await isBlocking();

      console.log(
        "Scrim blocking after second click:",
        blocking
      );

      if (!blocking) {
        console.log(
          "COOKIE CONSENT HANDLED SUCCESSFULLY"
        );

        return true;
      }
    }

    console.log(
      "WARNING: Cookie scrim is still blocking interaction."
    );

    return false;

  } catch (error) {
    console.log(
      "Cookie handler error:",
      error.message
    );

    return false;
  }
}

module.exports = {
  handleCookies
};