import { MENU_CONFIG } from "./menuConfig.js";

export function createMenuViewModel(state, config = MENU_CONFIG) {
  const screen = state?.screen ?? "menu";
  const error = String(state?.error ?? "").trim();
  const isChecking = screen === "checking";
  const isConnecting = screen === "connecting";
  const hasError = Boolean(error) && !isConnecting;

  return {
    visible: screen === "menu" || isChecking || isConnecting,
    buttonDisabled: isChecking || isConnecting,
    buttonLabel: getJoinButtonLabel(state, config),
    statusText: getMenuStatus(state, config),
    statusTone: isChecking || isConnecting ? "pending" : hasError ? "error" : "ready"
  };
}

export function getMenuStatus(state, config = MENU_CONFIG) {
  if (state?.screen === "checking") {
    return config.checkingStatus;
  }
  if (state?.screen === "connecting") {
    return config.connectingStatus;
  }
  const error = String(state?.error ?? "").trim();
  return error || config.idleStatus;
}

export function getJoinButtonLabel(state, config = MENU_CONFIG) {
  if (state?.screen === "checking") {
    return config.checkingLabel;
  }
  return state?.screen === "connecting" ? config.connectingLabel : config.joinLabel;
}

export function sanitizeMenuName(value, config = MENU_CONFIG) {
  const clean = String(value ?? "").trim().slice(0, 16);
  return clean || config.defaultName;
}

export function readStorageValue(storage, key, fallback = "") {
  try {
    return storage?.getItem?.(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageValue(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}
