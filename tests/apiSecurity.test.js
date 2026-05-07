import test from "node:test";
import assert from "node:assert/strict";
import { assertAllowedOrigin, getClientIp } from "../server/src/apiHandlers.js";

function createRequest({ method = "POST", headers = {}, remoteAddress = "127.0.0.1" } = {}) {
  return {
    method,
    headers,
    socket: { remoteAddress }
  };
}

test("state-changing API requests reject explicit bad origins", () => {
  const runtime = {
    production: true,
    allowedOrigins: ["https://arena.example"]
  };

  assert.equal(assertAllowedOrigin(createRequest({
    headers: { origin: "https://arena.example" }
  }), runtime), true);
  assert.throws(() => assertAllowedOrigin(createRequest({
    headers: { origin: "https://evil.example" }
  }), runtime), /origin/i);
});

test("GET requests and missing origins remain compatible with health checks and curl", () => {
  const runtime = {
    production: true,
    allowedOrigins: ["https://arena.example"]
  };

  assert.equal(assertAllowedOrigin(createRequest({ method: "GET" }), runtime), true);
  assert.equal(assertAllowedOrigin(createRequest({ method: "POST" }), runtime), true);
});

test("trusted proxy mode reads forwarded client IP for login rate limits", () => {
  assert.equal(getClientIp(createRequest({
    headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.2" },
    remoteAddress: "10.0.0.1"
  }), { trustProxy: true }), "203.0.113.5");

  assert.equal(getClientIp(createRequest({
    headers: { "x-forwarded-for": "203.0.113.5" },
    remoteAddress: "10.0.0.1"
  }), { trustProxy: false }), "10.0.0.1");
});
