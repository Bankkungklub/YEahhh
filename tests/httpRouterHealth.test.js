import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHttpRouter } from "../server/src/httpRouter.js";
import { createServerHealth } from "../server/src/serverHealth.js";

async function withTestServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function createRouter({ health, runtime = { debugEndpointsEnabled: false } } = {}) {
  return createHttpRouter({
    clientDir: process.cwd(),
    sharedDir: process.cwd(),
    roomManager: { rooms: new Map() },
    authService: { getAccountFromRequest: () => null },
    shopService: {},
    accountStore: {},
    runtime,
    health
  });
}

test("healthz and readyz expose readiness without secrets", async () => {
  const health = createServerHealth({ nodeEnv: "test", now: () => 1000 });
  health.markStorageReady();
  health.markReady();

  await withTestServer(createRouter({ health }), async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/healthz`);
    const healthBody = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(healthBody.ready, true);
    assert.equal("accounts" in healthBody, false);

    const readyResponse = await fetch(`${baseUrl}/readyz`);
    assert.equal(readyResponse.status, 200);
  });
});

test("readyz returns 503 while the server is draining", async () => {
  const health = createServerHealth({ nodeEnv: "test" });
  health.markStorageReady();
  health.markReady();
  health.markDraining();

  await withTestServer(createRouter({ health }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/readyz`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.ready, false);
    assert.match(body.error, /starting/i);
  });
});

test("debug routes are unavailable when runtime disables them", async () => {
  await withTestServer(createRouter(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/debug/state`);
    assert.equal(response.status, 404);
  });
});
