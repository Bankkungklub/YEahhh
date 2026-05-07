import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { GAME_CONFIG } from "../../shared/config/gameConfig.js";
import { sanitizeAuthPayload, sanitizeRoomCreatePayload, sanitizeShopActionPayload } from "../../shared/protocol/appMessages.js";
import { sanitizeDeveloperLevelPayload } from "./developerAdmin.js";
import { assertAllowedOrigin, requireAccount, requireDeveloperAccount, getClientIp } from "./apiHandlers.js";

export function createHttpRouter({
  clientDir,
  sharedDir,
  roomManager,
  authService,
  shopService,
  accountStore,
  config = GAME_CONFIG,
  appConfig = APP_CONFIG,
  runtime = null,
  health = null
}) {
  return async function handleRequest(request, response) {
    const url = new URL(request.url, "http://localhost");
    try {
      if (url.pathname === "/healthz" || url.pathname === "/readyz") {
        handleHealthRoute({ response, url, roomManager, health });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        await handleApiRoute({
          request,
          response,
          url,
          roomManager,
          authService,
          shopService,
          config,
          appConfig,
          runtime
        });
        return;
      }

      if (url.pathname.startsWith("/debug/")) {
        handleDebugRoute({ response, url, roomManager, accountStore, shopService, config, runtime });
        return;
      }

      serveStatic({ pathname: url.pathname, response, clientDir, sharedDir });
    } catch (error) {
      sendJson(response, error.status ?? 500, { error: error.message || "Internal server error." });
    }
  };
}

async function handleApiRoute({ request, response, url, roomManager, authService, shopService, config, appConfig, runtime }) {
  assertAllowedOrigin(request, runtime);
  const account = authService.getAccountFromRequest(request);

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    sendJson(response, 200, { account });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const result = authService.register(sanitizeAuthPayload(body, appConfig));
    sendJson(response, 200, { account: result.account }, { "Set-Cookie": authService.createCookie(result.session) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const result = authService.login({ ...sanitizeAuthPayload(body, appConfig), ip: getClientIp(request, runtime) });
    sendJson(response, 200, { account: result.account }, { "Set-Cookie": authService.createCookie(result.session) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    authService.logout(authService.getSessionTokenFromRequest(request));
    sendJson(response, 200, { ok: true, account: null }, { "Set-Cookie": authService.createClearCookie() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/shop/catalog") {
    sendJson(response, 200, shopService.getCatalog(account));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/shop/buy") {
    const activeAccount = requireAccount(account);
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const updated = shopService.buyItem(activeAccount.id, sanitizeShopActionPayload(body).itemId);
    sendJson(response, 200, { account: updated, catalog: shopService.getCatalog(updated).items });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/shop/equip") {
    const activeAccount = requireAccount(account);
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const updated = shopService.equipItem(activeAccount.id, sanitizeShopActionPayload(body).itemId);
    sendJson(response, 200, { account: updated, catalog: shopService.getCatalog(updated).items });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/matchmaking/status") {
    sendJson(response, 200, roomManager.getStatus());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/matchmaking/quickplay") {
    const room = roomManager.chooseQuickplayRoom();
    sendJson(response, 200, { room: room.getSummary() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/rooms") {
    sendJson(response, 200, { rooms: roomManager.listRooms() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const room = roomManager.createCustomRoom(sanitizeRoomCreatePayload(body, appConfig));
    sendJson(response, 200, { room: room.getSummary() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/developer/level") {
    const developer = requireDeveloperAccount(account);
    const body = await readJsonBody(request, appConfig.api.maxJsonBytes);
    const payload = sanitizeDeveloperLevelPayload(body, config);
    const result = roomManager.applyDeveloperLevel(developer.id, payload.level);
    if (result.updated.length === 0) {
      const error = new Error("Join the arena before setting your level.");
      error.status = 409;
      throw error;
    }
    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

function handleHealthRoute({ response, url, roomManager, health }) {
  const roomCount = roomManager?.rooms?.size ?? null;
  const clientCount = roomManager
    ? [...roomManager.rooms.values()].reduce((sum, room) => sum + room.clients.size, 0)
    : null;
  const snapshot = health?.snapshot?.({ rooms: roomCount, clients: clientCount }) ?? {
    ok: true,
    ready: true,
    rooms: roomCount,
    clients: clientCount
  };
  const status = url.pathname === "/readyz" && !snapshot.ready ? 503 : 200;
  sendJson(response, status, {
    ...snapshot,
    error: status === 503 ? "Server is starting. Try again shortly." : undefined
  });
}

function handleDebugRoute({ response, url, roomManager, accountStore, shopService, config, runtime }) {
  const debugEnabled = runtime ? runtime.debugEndpointsEnabled : !(process.env.NODE_ENV === "production" && !config.debug.endpointEnabledInProduction);
  if (!debugEnabled) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (url.pathname === "/debug/state") {
    const publicRoom = roomManager.getOrCreatePublicRoom();
    sendJson(response, 200, {
      ...publicRoom.game.getDebugState(),
      rooms: roomManager.getDebugState(),
      accounts: accountStore.getDebugState(),
      shop: shopService.getDebugState()
    });
    return;
  }

  if (url.pathname === "/debug/rooms") {
    sendJson(response, 200, roomManager.getDebugState());
    return;
  }

  if (url.pathname === "/debug/accounts") {
    sendJson(response, 200, accountStore.getDebugState());
    return;
  }

  sendJson(response, 404, { error: "Debug route not found." });
}

export function readJsonBody(request, maxBytes = APP_CONFIG.api.maxJsonBytes) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > maxBytes) {
        const error = new Error("Request body too large.");
        error.status = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const error = new Error("Malformed JSON.");
        error.status = 400;
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

export function serveStatic({ pathname, response, clientDir, sharedDir }) {
  const decodedPath = decodeURIComponent(pathname);
  const requestPath = decodedPath === "/" ? "/client/index.html" : decodedPath;
  const baseDir = requestPath.startsWith("/shared/") ? sharedDir : clientDir;
  const relativePath = requestPath.startsWith("/shared/")
    ? requestPath.replace(/^\/shared\//, "")
    : requestPath.replace(/^\/client\//, "");
  const filePath = normalize(join(baseDir, relativePath));

  if (!filePath.startsWith(baseDir) || !existsSync(filePath)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  response.writeHead(200, { "Content-Type": getMimeType(filePath) });
  createReadStream(filePath).pipe(response);
}

export function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

function getMimeType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}
