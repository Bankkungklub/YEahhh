import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AccountStore } from "../server/src/accountStore.js";
import { AuthService, hashToken } from "../server/src/authService.js";

function createAuthFixture() {
  const dir = mkdtempSync(join(tmpdir(), "tank-auth-"));
  const store = new AccountStore({ filePath: join(dir, "accounts.json") });
  const auth = new AuthService({ store });
  return {
    dir,
    store,
    auth,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("register stores hashed password and creates session", () => {
  const fixture = createAuthFixture();
  try {
    const result = fixture.auth.register({ username: "Bank", password: "password123" });
    const raw = fixture.store.getAccountByUsername("bank");

    assert.equal(result.account.username, "Bank");
    assert.ok(result.session.token);
    assert.notEqual(raw.passwordHash, "password123");
    assert.equal(raw.passwordHash.length, 128);
    assert.ok(fixture.store.getSessionByTokenHash(hashToken(result.session.token)));
  } finally {
    fixture.cleanup();
  }
});

test("auth rejects weak password, duplicate username, and wrong login", () => {
  const fixture = createAuthFixture();
  try {
    assert.throws(() => fixture.auth.register({ username: "Bo", password: "password123" }), /Username/);
    assert.throws(() => fixture.auth.register({ username: "Bank", password: "short" }), /Password/);
    fixture.auth.register({ username: "Bank", password: "password123" });
    assert.throws(() => fixture.auth.register({ username: "bank", password: "password123" }), /taken/);
    assert.throws(() => fixture.auth.login({ username: "Bank", password: "wrong" }), /Invalid/);
  } finally {
    fixture.cleanup();
  }
});

test("session lookup and logout work from token", () => {
  const fixture = createAuthFixture();
  try {
    const result = fixture.auth.register({ username: "Bank", password: "password123" });
    assert.equal(fixture.auth.getAccountForToken(result.session.token).username, "Bank");
    assert.equal(fixture.auth.logout(result.session.token), true);
    assert.equal(fixture.auth.getAccountForToken(result.session.token), null);
  } finally {
    fixture.cleanup();
  }
});

test("auth cookies include Secure when runtime requires production cookies", () => {
  const fixture = createAuthFixture();
  try {
    const auth = new AuthService({
      store: fixture.store,
      runtime: { sessionCookieSecure: true }
    });
    const result = auth.register({ username: "SecureBank", password: "password123" });

    assert.match(auth.createCookie(result.session), /; Secure/);
    assert.match(auth.createClearCookie(), /; Secure/);
  } finally {
    fixture.cleanup();
  }
});
