async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      },
      ...options,
      body: options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
    });
  } catch {
    throw new Error("Server unreachable. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

export const apiClient = Object.freeze({
  health() {
    return requestJson("/healthz");
  },
  ready() {
    return requestJson("/readyz");
  },
  me() {
    return requestJson("/api/auth/me");
  },
  register(username, password) {
    return requestJson("/api/auth/register", { method: "POST", body: { username, password } });
  },
  login(username, password) {
    return requestJson("/api/auth/login", { method: "POST", body: { username, password } });
  },
  logout() {
    return requestJson("/api/auth/logout", { method: "POST", body: {} });
  },
  getCatalog() {
    return requestJson("/api/shop/catalog");
  },
  buyItem(itemId) {
    return requestJson("/api/shop/buy", { method: "POST", body: { itemId } });
  },
  equipItem(itemId) {
    return requestJson("/api/shop/equip", { method: "POST", body: { itemId } });
  },
  quickplay() {
    return requestJson("/api/matchmaking/quickplay", { method: "POST", body: {} });
  },
  matchmakingStatus() {
    return requestJson("/api/matchmaking/status");
  },
  listRooms() {
    return requestJson("/api/rooms");
  },
  createRoom(name, maxPlayers = 32) {
    return requestJson("/api/rooms", { method: "POST", body: { name, maxPlayers } });
  },
  setDeveloperLevel(level) {
    return requestJson("/api/developer/level", { method: "POST", body: { level } });
  }
});
