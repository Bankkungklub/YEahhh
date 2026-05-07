import test from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../server/src/roomManager.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return config;
}

test("room manager creates default public room and quickplay chooses it", () => {
  const manager = new RoomManager({ config: createTestConfig() });
  const room = manager.chooseQuickplayRoom();

  assert.equal(room.type, "public");
  assert.equal(room.id, "public-local-public");
  assert.equal(manager.listRooms().length, 1);
});

test("custom rooms are listed and run isolated games", () => {
  const manager = new RoomManager({ config: createTestConfig() });
  const custom = manager.createCustomRoom({ name: "Bank Room", maxPlayers: 4 });
  const publicRoom = manager.getOrCreatePublicRoom();

  custom.game.createHumanPlayer("client-custom", "Custom");
  publicRoom.game.createHumanPlayer("client-public", "Public");

  assert.notEqual(custom.id, publicRoom.id);
  assert.equal(custom.game.tanks.size, 1);
  assert.equal(publicRoom.game.tanks.size, 1);
  assert.ok(manager.listRooms().some((room) => room.name === "Bank Room"));
});

test("empty custom rooms expire after inactive ttl", () => {
  const manager = new RoomManager({ config: createTestConfig() });
  const custom = manager.createCustomRoom({ name: "Expire Me" });
  custom.lastHumanAtMs = 0;
  custom.game.timeMs = 300000;

  manager.cleanupInactiveRooms();

  assert.equal(manager.getRoom(custom.id), null);
});

test("stepAll records per-room simulation timing metrics", () => {
  const manager = new RoomManager({ config: createTestConfig() });
  const room = manager.getOrCreatePublicRoom();

  manager.stepAll(1 / 30);

  assert.equal(room.stepMetrics.samples, 1);
  assert.ok(room.getSummary().stepMs.avgMs >= 0);
  assert.equal(room.game.tick, 1);
});
