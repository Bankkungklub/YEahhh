import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";

export const UPGRADE_PANEL_CONFIG = HUD_LAYOUT_CONFIG.upgradePanel;

export function createUpgradePanelState(storage = globalThis.localStorage, config = UPGRADE_PANEL_CONFIG) {
  const collapsed = readCollapsed(storage, config);
  return {
    collapsed,
    userCollapsed: collapsed,
    lastAvailablePoints: 0,
    pulseUntilMs: 0
  };
}

export function toggleUpgradePanelState(state, storage = globalThis.localStorage, config = UPGRADE_PANEL_CONFIG) {
  const next = {
    collapsed: !Boolean(state?.collapsed),
    userCollapsed: !Boolean(state?.collapsed),
    lastAvailablePoints: Math.max(0, Number(state?.lastAvailablePoints) || 0),
    pulseUntilMs: Math.max(0, Number(state?.pulseUntilMs) || 0)
  };
  writeCollapsed(storage, next.collapsed, config);
  return next;
}

export function markUpgradePointsChanged(panelState, points, nowMs = 0, config = UPGRADE_PANEL_CONFIG) {
  const safePoints = Math.max(0, Math.trunc(Number(points) || 0));
  const previousPoints = Math.max(0, Math.trunc(Number(panelState?.lastAvailablePoints) || 0));
  const gainedPoints = safePoints > previousPoints;
  const shouldAutoExpand = (
    gainedPoints &&
    config.autoExpandOnFirstPoints &&
    !panelState?.userCollapsed &&
    panelState?.collapsed
  );
  return {
    collapsed: shouldAutoExpand ? false : Boolean(panelState?.collapsed),
    userCollapsed: Boolean(panelState?.userCollapsed),
    lastAvailablePoints: safePoints,
    pulseUntilMs: gainedPoints
      ? nowMs + config.pulseMs
      : Math.max(0, Number(panelState?.pulseUntilMs) || 0)
  };
}

export function getUpgradePanelViewModel({
  panelState,
  localTank,
  nowMs = 0,
  visible = true,
  config = UPGRADE_PANEL_CONFIG
}) {
  const points = Math.max(0, Math.trunc(Number(localTank?.upgradePoints) || 0));
  const collapsed = Boolean(panelState?.collapsed);
  const canUpgrade = Boolean(visible && localTank && localTank.state === "alive" && points > 0);
  const status = !visible ? "hidden" : collapsed ? "collapsed" : "expanded";
  return {
    status,
    visible,
    collapsed,
    points,
    label: collapsed ? `${config.collapsedLabel} +${points}` : config.expandedLabel,
    canUpgrade,
    pulse: Boolean(
      visible &&
      collapsed &&
      canUpgrade &&
      config.autoPulseWhenPointsAvailable &&
      nowMs < (Number(panelState?.pulseUntilMs) || 0)
    )
  };
}

export function shouldHandleUpgradePanelHotkey(event, config = UPGRADE_PANEL_CONFIG) {
  if (!event || event.code !== config.hotkey) {
    return false;
  }
  const tag = event.target?.tagName?.toLowerCase?.() ?? "";
  return tag !== "input" && tag !== "textarea" && tag !== "select" && event.target?.isContentEditable !== true;
}

function readCollapsed(storage, config) {
  try {
    return storage?.getItem(config.storageKey) === "collapsed";
  } catch {
    return false;
  }
}

function writeCollapsed(storage, collapsed, config) {
  try {
    storage?.setItem(config.storageKey, collapsed ? "collapsed" : "expanded");
  } catch {
    // Storage is optional; blocked storage must not affect gameplay.
  }
}
