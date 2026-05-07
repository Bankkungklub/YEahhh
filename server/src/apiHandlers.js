import { isOriginAllowed } from "./runtimeConfig.js";

export function requireAccount(account) {
  if (!account) {
    const error = new Error("Login required.");
    error.status = 401;
    throw error;
  }
  return account;
}

export { requireDeveloperAccount } from "./developerAdmin.js";

export function assertAllowedOrigin(request, runtime) {
  if (!request || !runtime || request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }
  const origin = request.headers?.origin ?? "";
  if (isOriginAllowed(origin, runtime)) {
    return true;
  }
  const error = new Error("Request origin is not allowed.");
  error.status = 403;
  throw error;
}

export function getClientIp(request, runtime = null) {
  if (runtime?.trustProxy) {
    const forwardedFor = String(request.headers?.["x-forwarded-for"] ?? "")
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    if (forwardedFor) {
      return forwardedFor;
    }
    const realIp = String(request.headers?.["x-real-ip"] ?? "").trim();
    if (realIp) {
      return realIp;
    }
  }
  return request.socket?.remoteAddress ?? "local";
}
