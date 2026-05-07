import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";

export function computeHudSafeZones({
  viewport = {},
  upgradeCollapsed = false,
  classCardsVisible = false,
  config = HUD_LAYOUT_CONFIG.hudLayout
} = {}) {
  const width = Math.max(1, Number(viewport.width) || 1280);
  const height = Math.max(1, Number(viewport.height) || 720);
  const mobile = width < config.desktopBreakpoint;
  const inset = mobile ? config.mobileInset : config.sideInset;
  const gap = config.panelGap;
  const bottomHudHeight = config.bottomHudHeight;
  const touchZoneHeight = mobile
    ? clampNumber(
        Math.round(height * config.mobileTouchZoneHeightRatio),
        config.mobileTouchZoneMinHeight,
        config.mobileTouchZoneMaxHeight
      )
    : 0;
  const classCardsHeight = mobile ? config.mobileClassCardsHeight : config.classCardsHeight;
  const classCardBottom = mobile && classCardsVisible
    ? bottomHudHeight + gap + touchZoneHeight + gap
    : bottomHudHeight + gap;
  const leftWidth = upgradeCollapsed ? config.upgradeCollapsedWidth : config.upgradeExpandedWidth;
  const rightWidth = mobile ? Math.min(190, width - inset * 2) : config.leaderboardWidth;
  const minimap = makeBox(
    width - inset - Math.min(config.minimapSize, Math.max(112, width * 0.16)),
    height - inset - Math.min(config.minimapSize, Math.max(112, width * 0.16)),
    Math.min(config.minimapSize, Math.max(112, width * 0.16)),
    Math.min(config.minimapSize, Math.max(112, width * 0.16))
  );
  const bottomStatus = makeBox(inset, height - inset - bottomHudHeight + 14, Math.min(560, width - inset * 2), bottomHudHeight - 14);
  const topLeftDock = mobile && classCardsVisible
    ? makeBox(inset, inset, Math.min(176, width - inset * 2), upgradeCollapsed ? config.upgradeCollapsedHeight : 236)
    : makeBox(inset, mobile ? height - 86 - (upgradeCollapsed ? config.upgradeCollapsedHeight : 236) : inset, Math.min(leftWidth, width - inset * 2), upgradeCollapsed ? config.upgradeCollapsedHeight : config.upgradeExpandedHeight);
  const rightDock = makeBox(width - inset - rightWidth, inset, rightWidth, mobile ? 176 : config.leaderboardHeight);
  const safeLeft = mobile ? inset : inset + Math.max(leftWidth, config.treeButtonWidth + gap + config.developerPanelWidth) + gap;
  const safeRight = mobile ? inset : inset + rightWidth + gap;
  const classWidth = Math.min(config.classCardsMaxWidth, Math.max(0, width - safeLeft - safeRight));
  const classCards = classCardsVisible
    ? makeBox(
        safeLeft + Math.max(0, width - safeLeft - safeRight - classWidth) / 2,
        height - classCardBottom - classCardsHeight,
        classWidth,
        classCardsHeight
      )
    : null;
  const touchZones = mobile
    ? makeTouchZones({ width, height, inset, gap, bottomHudHeight, touchZoneHeight, config })
    : {
        move: null,
        aim: null,
        fireLock: null
      };
  const actionPill = makeBox(
    (width - Math.min(config.actionPillWidth, Math.max(0, width - inset * 2))) / 2,
    mobile ? 54 : 64,
    Math.min(config.actionPillWidth, Math.max(0, width - inset * 2)),
    mobile ? 34 : config.actionPillHeight
  );

  return {
    viewport: { width, height, mobile },
    cssVars: {
      "--hud-panel-gap": `${gap}px`,
      "--hud-bottom-height": `${bottomHudHeight}px`,
      "--hud-left-width": `${safeLeft}px`,
      "--hud-right-width": `${safeRight}px`,
      "--class-card-bottom": `${classCardBottom}px`,
      "--mobile-class-card-height": `${classCardsHeight}px`,
      "--touch-fire-lock-bottom": `${bottomHudHeight + gap}px`,
      "--touch-stick-radius": `${config.touchStickVisualRadius}px`,
      "--touch-stick-knob": `${config.touchStickKnobSize}px`
    },
    topLeftDock,
    rightDock,
    bottomStatus,
    minimap,
    touchZones,
    actionPill,
    classCards
  };
}

export function applyHudLayoutVariables(element, layout) {
  if (!element || !layout?.cssVars) {
    return;
  }
  for (const [key, value] of Object.entries(layout.cssVars)) {
    element.style.setProperty(key, value);
  }
}

export function boxesOverlap(a, b, padding = 0) {
  if (!a || !b) {
    return false;
  }
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function makeBox(x, y, width, height) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height))
  };
}

function makeTouchZones({ width, height, inset, gap, bottomHudHeight, touchZoneHeight, config }) {
  const zoneY = height - bottomHudHeight - gap - touchZoneHeight;
  const zoneWidth = Math.round(Math.max(0, width - inset * 2) * config.mobileTouchZoneWidthRatio);
  return {
    move: makeBox(inset, zoneY, zoneWidth, touchZoneHeight),
    aim: makeBox(width - inset - zoneWidth, zoneY, zoneWidth, touchZoneHeight),
    fireLock: makeBox(
      width - inset - config.mobileFireLockWidth,
      height - bottomHudHeight - gap - config.mobileFireLockHeight,
      config.mobileFireLockWidth,
      config.mobileFireLockHeight
    )
  };
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}
