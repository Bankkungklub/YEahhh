import test from "node:test";
import assert from "node:assert/strict";
import { getSocketCloseMessage } from "../client/src/net/clientSocket.js";

test("socket close messages are readable for public beta failures", () => {
  assert.equal(getSocketCloseMessage({ code: 1006 }), "Connection lost. The server may be restarting.");
  assert.equal(getSocketCloseMessage({ code: 1008 }), "Connection rejected by the server.");
  assert.equal(getSocketCloseMessage({ code: 4000 }), "Connection timed out. Please rejoin.");
  assert.equal(getSocketCloseMessage({ code: 4000, reason: "Heartbeat timeout." }), "Heartbeat timeout.");
});
