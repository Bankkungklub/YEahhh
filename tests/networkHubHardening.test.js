import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { NetworkHub } from "../server/src/networkHub.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";

function createHub({ runtime = {}, now = () => Date.now() } = {}) {
  const httpServer = createServer();
  const hub = new NetworkHub({
    httpServer,
    roomManager: { rooms: new Map() },
    authService: null,
    config: GAME_CONFIG,
    runtime: {
      allowedOrigins: ["https://arena.example"],
      production: true,
      websocket: {
        maxClients: 2,
        heartbeatMs: 1000,
        heartbeatTimeoutMs: 500,
        messageRateLimit: 2
      },
      ...runtime
    },
    now
  });
  return {
    hub,
    close: () => {
      hub.stop();
      httpServer.close();
    }
  };
}

test("websocket origin guard rejects explicit bad origins", () => {
  const fixture = createHub();
  try {
    assert.equal(fixture.hub.validateSocketOrigin({ headers: { origin: "https://arena.example" } }), true);
    assert.equal(fixture.hub.validateSocketOrigin({ headers: { origin: "https://evil.example" } }), false);
  } finally {
    fixture.close();
  }
});

test("message rate guard closes clients that exceed the configured rate", () => {
  let nowMs = 1000;
  const fixture = createHub({ now: () => nowMs });
  const closeCalls = [];
  const client = {
    id: "client-rate",
    messageWindowStartMs: nowMs,
    messageCountInWindow: 0,
    ws: {
      close: (code, reason) => closeCalls.push({ code, reason })
    }
  };

  try {
    assert.equal(fixture.hub.checkMessageRate(client), true);
    assert.equal(fixture.hub.checkMessageRate(client), true);
    assert.equal(fixture.hub.checkMessageRate(client), false);
    assert.equal(closeCalls[0].code, 1008);

    nowMs += 1000;
    assert.equal(fixture.hub.checkMessageRate(client), true);
  } finally {
    fixture.close();
  }
});

test("heartbeat closes stale clients and pings healthy clients", () => {
  let nowMs = 5000;
  const fixture = createHub({ now: () => nowMs });
  const events = [];
  const stale = {
    id: "client-stale",
    lastPongAtMs: 3000,
    ws: {
      ping: () => events.push("stale-ping"),
      close: (code, reason) => events.push(`${code}:${reason}`)
    }
  };
  const healthy = {
    id: "client-healthy",
    lastPongAtMs: 4600,
    ws: {
      ping: () => events.push("healthy-ping"),
      close: (code, reason) => events.push(`${code}:${reason}`)
    }
  };

  try {
    fixture.hub.clients.set(stale.id, stale);
    fixture.hub.clients.set(healthy.id, healthy);

    fixture.hub.checkHeartbeat();

    assert.ok(events.some((event) => event.startsWith("4000:Heartbeat timeout")));
    assert.ok(events.includes("healthy-ping"));
    assert.equal(events.includes("stale-ping"), false);
  } finally {
    fixture.close();
  }
});
