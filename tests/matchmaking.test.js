import test from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../server/src/roomManager.js";
import { APP_CONFIG } from "../shared/config/appConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";

test("quickplay creates another public room when the first one is full", () => {
  const appConfig = JSON.parse(JSON.stringify(APP_CONFIG));
  appConfig.matchmaking.maxPlayersPerRoom = 1;
  const gameConfig = JSON.parse(JSON.stringify(GAME_CONFIG));
  gameConfig.shapes.targetCount = 0;
  gameConfig.bots.baseCount = 0;
  const manager = new RoomManager({ config: gameConfig, appConfig });
  const first = manager.chooseQuickplayRoom();
  first.clients.set("client-1", { id: "client-1" });

  const second = manager.chooseQuickplayRoom();

  assert.notEqual(second.id, first.id);
  assert.equal(second.type, "public");
});

test("matchmaking status reports region and rooms", () => {
  const manager = new RoomManager({ config: GAME_CONFIG });
  const status = manager.getStatus();

  assert.equal(status.defaultRegion, "local-public");
  assert.ok(status.regions.length >= 1);
  assert.ok(status.rooms.length >= 1);
});
