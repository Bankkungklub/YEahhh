import { expect } from "@playwright/test";

export const ADMIN_CREDENTIALS = Object.freeze({
  username: "Admin",
  password: "123456@@##$$"
});

export function collectRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

export function expectNoRuntimeErrors(errors) {
  expect(errors, errors.join("\n")).toEqual([]);
}

export async function postJson(page, path, body) {
  return page.evaluate(async ({ path: requestPath, body: requestBody }) => {
    const response = await fetch(requestPath, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  }, { path, body });
}

export async function loginAsDeveloper(page) {
  const result = await postJson(page, "/api/auth/login", ADMIN_CREDENTIALS);
  expect(result, result.data?.error ?? "Developer login failed.").toMatchObject({ ok: true, status: 200 });
  expect(result.data.account?.isDeveloper).toBe(true);
  return result.data.account;
}

export async function joinArena(page, name = "SmokeTester") {
  await expect(page.locator("#menu")).toBeVisible();
  await page.locator("#playerName").fill(name);
  await page.locator("#joinButton").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#healthText")).toContainText(/HP \d+ \/ \d+/);
  await expect(page.locator("#levelText")).toContainText(/Level \d+/);
  await expect(page.locator("#gameCanvas")).toBeVisible();
}

export async function setDeveloperLevel(page, level) {
  const result = await postJson(page, "/api/developer/level", { level });
  expect(result, result.data?.error ?? "Developer level request failed.").toMatchObject({ ok: true, status: 200 });
  expect(result.data.updated?.length).toBeGreaterThan(0);
  return result.data;
}

export async function selectClassPath(page, classIds) {
  for (const classId of classIds) {
    const card = page.locator(`.class-upgrade-card[data-class-id="${classId}"]`);
    await expect(card).toBeVisible();
    await card.click();
  }
}

export async function openTreeAndClose(page) {
  await page.locator("#treeButton").click();
  await expect(page.locator(".modal-overlay")).toBeVisible();
  await expect(page.locator(".modal-header h2")).toHaveText("Tank Tree");
  await expect(page.locator(".evolution-tree-panel")).toBeVisible();
  await page.locator(".modal-close").click();
  await expect(page.locator(".modal-overlay")).toBeHidden();
}

export async function showDebugOverlay(page) {
  await page.keyboard.press("F3");
  await expect(page.locator("#debugOverlay")).toBeVisible();
  await expect(page.locator("#debugOverlay")).toContainText(/class|fps|room/i);
}

export async function dispatchCanvasTouch(page, type, touches) {
  await page.evaluate(({ eventType, touchPoints }) => {
    const target = document.querySelector("#gameCanvas");
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "changedTouches", {
      value: touchPoints.map((touch) => ({
        identifier: touch.id,
        clientX: touch.x,
        clientY: touch.y
      }))
    });
    target.dispatchEvent(event);
  }, { eventType: type, touchPoints: touches });
}

export async function getVisibleClassFactCount(page) {
  return page.locator(".class-upgrade-card").first().locator(".class-upgrade-fact").evaluateAll((facts) => (
    facts.filter((fact) => {
      const style = window.getComputedStyle(fact);
      return style.display !== "none" && style.visibility !== "hidden" && fact.getBoundingClientRect().width > 0;
    }).length
  ));
}

export async function boxesOverlapOnPage(page, firstSelector, secondSelector, padding = 0) {
  return page.evaluate(({ first, second, pad }) => {
    const a = document.querySelector(first)?.getBoundingClientRect();
    const b = document.querySelector(second)?.getBoundingClientRect();
    if (!a || !b) {
      return false;
    }
    return !(
      a.right + pad <= b.left ||
      b.right + pad <= a.left ||
      a.bottom + pad <= b.top ||
      b.bottom + pad <= a.top
    );
  }, { first: firstSelector, second: secondSelector, pad: padding });
}
