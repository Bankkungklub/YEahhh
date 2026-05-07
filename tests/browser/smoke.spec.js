import { expect, test } from "@playwright/test";
import {
  boxesOverlapOnPage,
  collectRuntimeErrors,
  dispatchCanvasTouch,
  expectNoRuntimeErrors,
  getVisibleClassFactCount,
  joinArena,
  loginAsDeveloper,
  openTreeAndClose,
  selectClassPath,
  setDeveloperLevel,
  showDebugOverlay
} from "./helpers/gameSmoke.js";

test.describe("browser gameplay smoke", () => {
  test("boots, joins, uses developer level, selects a level 60 class path, opens tree, and shows debug", async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto("/");
    await expect(page.locator("#gameCanvas")).toBeVisible();
    await expect(page.locator("#menu")).toBeVisible();
    await expect(page.locator("#joinForm")).toBeVisible();
    await expect(page.locator("#playerName")).toBeVisible();
    await expect(page.locator("#joinButton")).toBeVisible();

    await loginAsDeveloper(page);
    await joinArena(page, "SmokeAdmin");
    await setDeveloperLevel(page, 60);
    await selectClassPath(page, ["flankGuard", "triAngle", "fighter", "comet"]);
    await expect(page.locator(".class-upgrade-card")).toHaveCount(0);

    await openTreeAndClose(page);
    await showDebugOverlay(page);
    await expect(page.locator("#debugOverlay")).toContainText("hudAction");
    await expect(page.locator("#debugOverlay")).toContainText("botRivals");
    await expect(page.locator("#debugOverlay")).toContainText("metrics");
    expectNoRuntimeErrors(runtimeErrors);
  });

  test("mobile viewport boots and joins without runtime errors", async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 390, height: 720 });

    await page.goto("/");
    await loginAsDeveloper(page);
    await joinArena(page, "MobileSmoke");
    await expect(page.locator("#hud")).toBeVisible();
    await expect(page.locator("#gameCanvas")).toBeVisible();
    await expect(page.locator("#healthText")).toContainText(/HP \d+ \/ \d+/);
    await expect(page.locator("#touchControls")).toBeVisible();
    await expect(page.locator("#touchFireLockButton")).toBeVisible();

    await dispatchCanvasTouch(page, "touchstart", [
      { id: 1, x: 62, y: 552 },
      { id: 2, x: 328, y: 520 }
    ]);
    await dispatchCanvasTouch(page, "touchmove", [
      { id: 1, x: 112, y: 552 },
      { id: 2, x: 376, y: 520 }
    ]);
    await expect(page.locator(".touch-stick-move")).toBeVisible();
    await expect(page.locator(".touch-stick-aim")).toBeVisible();
    await expect(page.locator("#touchControls")).toHaveClass(/firing/);

    await page.locator("#touchFireLockButton").click();
    await dispatchCanvasTouch(page, "touchend", [{ id: 2, x: 376, y: 520 }]);
    await expect(page.locator("#touchFireLockButton")).toHaveText("FIRING");

    await setDeveloperLevel(page, 15);
    await expect(page.locator(".class-upgrade-card")).toHaveCount(4);
    await expect(page.locator(".class-upgrade-fact").first()).toBeVisible();
    expect(await getVisibleClassFactCount(page)).toBeLessThanOrEqual(2);
    expect(await boxesOverlapOnPage(page, ".class-upgrade-panel", ".bars", 4)).toBe(false);
    expect(await boxesOverlapOnPage(page, ".class-upgrade-panel", "#touchFireLockButton", 4)).toBe(false);

    await dispatchCanvasTouch(page, "touchend", [{ id: 1, x: 112, y: 552 }]);
    expectNoRuntimeErrors(runtimeErrors);
  });
});
