import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig, validateRuntimeConfig, isOriginAllowed } from "../server/src/runtimeConfig.js";

test("runtime config keeps local/test boot simple", () => {
  const runtime = loadRuntimeConfig({ NODE_ENV: "test-browser", PORT: "3101" }, { rootDir: process.cwd() });

  assert.equal(runtime.nodeEnv, "test-browser");
  assert.equal(runtime.port, 3101);
  assert.equal(runtime.allowedOrigins.length, 0);
  assert.deepEqual(validateRuntimeConfig(runtime), []);
  assert.equal(isOriginAllowed("http://localhost:3101", runtime), true);
});

test("production runtime requires an explicit public origin", () => {
  const runtime = loadRuntimeConfig({ NODE_ENV: "production" }, { rootDir: process.cwd() });

  assert.match(validateRuntimeConfig(runtime).join(" "), /PUBLIC_BASE_URL|ALLOWED_ORIGINS/);
});

test("production runtime normalizes allowed origins and secure cookies", () => {
  const runtime = loadRuntimeConfig({
    NODE_ENV: "production",
    PUBLIC_BASE_URL: "https://arena.example/play",
    ALLOWED_ORIGINS: "https://backup.example, https://arena.example/other",
    TRUST_PROXY: "1",
    SESSION_COOKIE_SECURE: "auto"
  }, { rootDir: process.cwd() });

  assert.deepEqual(validateRuntimeConfig(runtime), []);
  assert.equal(runtime.sessionCookieSecure, true);
  assert.equal(runtime.trustProxy, true);
  assert.equal(isOriginAllowed("https://arena.example", runtime), true);
  assert.equal(isOriginAllowed("https://backup.example", runtime), true);
  assert.equal(isOriginAllowed("https://evil.example", runtime), false);
});

test("Render external URL can satisfy production public origin requirements", () => {
  const runtime = loadRuntimeConfig({
    NODE_ENV: "production",
    RENDER_EXTERNAL_URL: "https://tank-arena-public-beta.onrender.com"
  }, { rootDir: process.cwd() });

  assert.deepEqual(validateRuntimeConfig(runtime), []);
  assert.equal(runtime.publicBaseUrl, "https://tank-arena-public-beta.onrender.com");
  assert.equal(isOriginAllowed("https://tank-arena-public-beta.onrender.com", runtime), true);
});

test("Render external URL stays allowed when manual public URL is stale", () => {
  const runtime = loadRuntimeConfig({
    NODE_ENV: "production",
    PUBLIC_BASE_URL: "https://old-name.onrender.com",
    ALLOWED_ORIGINS: "https://old-name.onrender.com",
    RENDER_EXTERNAL_URL: "https://tankarenaplubic.onrender.com"
  }, { rootDir: process.cwd() });

  assert.deepEqual(validateRuntimeConfig(runtime), []);
  assert.equal(isOriginAllowed("https://old-name.onrender.com", runtime), true);
  assert.equal(isOriginAllowed("https://tankarenaplubic.onrender.com", runtime), true);
  assert.equal(isOriginAllowed("https://evil.example", runtime), false);
});
