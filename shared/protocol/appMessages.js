import { APP_CONFIG } from "../config/appConfig.js";

export function sanitizeAuthPayload(body, config = APP_CONFIG) {
  return {
    username: String(body?.username ?? "")
      .replace(/[^\w \-.]/g, "")
      .trim()
      .slice(0, config.auth.usernameMax),
    password: String(body?.password ?? "")
  };
}

export function sanitizeShopActionPayload(body) {
  return {
    itemId: String(body?.itemId ?? "")
      .replace(/[^\w\-.]/g, "")
      .trim()
      .slice(0, 48)
  };
}

export function sanitizeRoomCreatePayload(body, config = APP_CONFIG) {
  return {
    name: String(body?.name ?? "")
      .replace(/[^\w \-.]/g, "")
      .trim()
      .slice(0, config.matchmaking.customRoomNameMax),
    maxPlayers: Math.max(2, Math.min(
      config.matchmaking.maxPlayersPerRoom,
      Math.trunc(Number(body?.maxPlayers) || config.matchmaking.maxPlayersPerRoom)
    ))
  };
}
