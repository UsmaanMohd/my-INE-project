async function handleCookies(page) {
  console.log("Checking cookie consent...");

  try {
    const consent =
      page.locator(".consent-scrim");

    /*
     * Give dynamically rendered consent UI
     * a short chance to appear.
     */
    await page.waitForTimeout(300);

    const count =
      await consent.count();

    console.log(
      "Consent popup count:",
      count
    );

    if (count === 0) {
      console.log(
        "No cookie popup found."
      );

      return false;
    }

    const visible =
      await consent
        .first()
        .isVisible()
        .catch(() => false);

    console.log(
      "Consent popup visible:",
      visible
    );

    if (!visible) {
      console.log(
        "Cookie popup is not visible."
      );

      return false;
    }

    console.log(
      "COOKIE POPUP FOUND"
    );

    const popup =
      consent.first();

    const allowButton =
      popup
        .locator("button")
        .filter({
          hasText: /^ALLOW$/i
        })
        .first();

    const allowCount =
      await allowButton.count();

    console.log(
      "ALLOW buttons:",
      allowCount
    );

    if (allowCount === 0) {
      console.log(
        "ALLOW button not found."
      );

      console.log(
        "Popup buttons:",
        await popup
          .locator("button")
          .allTextContents()
      );

      return false;
    }

    console.log(
      "ALLOW BUTTON FOUND"
    );

    /*
     * Use force because the consent overlay itself
     * can sometimes interfere with normal Playwright
     * pointer action.
     */
    await allowButton.click({
      force: true,
      timeout: 5000
    });

    console.log(
      "ALLOW CLICK EXECUTED"
    );

    /*
     * Wait for overlay to disappear.
     */
    await page
      .waitForFunction(
        () => {
          const element =
            document.querySelector(
              ".consent-scrim"
            );

          if (!element) {
            return true;
          }

          const style =
            window.getComputedStyle(element);

          return (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
          );
        },
        null,
        {
          timeout: 5000
        }
      )
      .catch(() => {});

    await page.waitForTimeout(500);

    const finalVisible =
      await consent
        .first()
        .isVisible()
        .catch(() => false);

    console.log(
      "Final cookie popup visible:",
      finalVisible
    );

    if (!finalVisible) {
      console.log(
        "COOKIE CONSENT HANDLED SUCCESSFULLY"
      );

      return true;
    }

    /*
     * Last fallback: press Escape.
     */
    console.log(
      "Popup still visible. Trying Escape..."
    );

    await page.keyboard.press("Escape");

    await page.waitForTimeout(500);

    const afterEscape =
      await consent
        .first()
        .isVisible()
        .catch(() => false);

    console.log(
      "Popup visible after Escape:",
      afterEscape
    );

    return !afterEscape;

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