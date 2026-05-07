import test from "node:test";
import assert from "node:assert/strict";
import { createServerHealth, createHealthSnapshot, isReady } from "../server/src/serverHealth.js";

test("server health transitions from booting to ready to draining", () => {
  let nowMs = 1000;
  const health = createServerHealth({ now: () => nowMs, nodeEnv: "test" });

  assert.equal(health.isReady(), false);
  health.markStorageReady();
  health.markReady();
  assert.equal(health.isReady(), true);

  nowMs = 1500;
  const readySnapshot = health.snapshot({ rooms: 1, clients: 2 });
  assert.equal(readySnapshot.ready, true);
  assert.equal(readySnapshot.rooms, 1);
  assert.equal(readySnapshot.clients, 2);
  assert.equal(readySnapshot.uptimeMs, 500);

  health.markDraining();
  assert.equal(health.isReady(), false);
  assert.equal(health.snapshot().draining, true);
});

test("health snapshot is not ready when storage fails", () => {
  const state = {
    startedAtMs: 0,
    ready: true,
    draining: false,
    storageReady: false,
    storageError: "disk full",
    nodeEnv: "test",
    version: "test"
  };

  assert.equal(isReady(state), false);
  assert.equal(createHealthSnapshot(state, { nowMs: 10 }).storageError, "disk full");
});
