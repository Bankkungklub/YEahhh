import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";
import { computeCameraScale, computeVisibleWorldSize, getViewportProfile } from "../render/cameraViewport.js";

export function computeHudSafeZones({
  viewport = {},
  upgradeCollapsed = false,
  classCardsVisible = false,
  config = HUD_LAYOUT_CONFIG.hudLayout
} = {}) {
  const width = Math.max(1, Number(viewport.width) || 1280);
  const height = Math.max(1, Number(viewport.height) || 720);
  const profile = getViewportProfile({
    width,
    height
  }, {
    desktopBreakpoint: config.desktopBreakpoint,
    compactHeightBreakpoint: config.compactHeightBreakpoint
  });
  const mobile = profile.compactHud;
  const inset = mobile ? config.mobileInset : config.sideInset;
  const gap = config.panelGap;
  const bottomHudHeight = mobile ? config.mobileBottomHudHeight : config.bottomHudHeight;
  const touchZoneHeight = mobile
    ? clampNumber(
        Math.round(height * config.mobileTouchZoneHeightRatio),
        config.mobileTouchZoneMinHeight,
        config.mobileTouchZoneMaxHeight
      )
    : 0;
  const classCardsHeight = getClassCardsHeight({ mobile, profile, config });
  const classCardBottom = mobile && classCardsVisible
    ? bottomHudHeight + gap + touchZoneHeight + gap
    : bottomHudHeight + gap;
  const leftWidth = upgradeCollapsed ? config.upgradeCollapsedWidth : config.upgradeExpandedWidth;
  const rightWidth = mobile ? Math.min(190, width - inset * 2) : config.leaderboardWidth;
  const minimap = makeMinimapBox({ width, height, inset, mobile, profile, config });
  const bottomStatus = makeBox(inset, height - inset - bottomHudHeight + 14, Math.min(560, width - inset * 2), bottomHudHeight - 14);
  const topLeftDock = mobile && classCardsVisible
    ? makeBox(inset, inset, Math.min(176, width - inset * 2), upgradeCollapsed ? config.upgradeCollapsedHeight : 184)
    : makeBox(inset, mobile ? inset : inset, Math.min(leftWidth, width - inset * 2), upgradeCollapsed ? config.upgradeCollapsedHeight : (mobile ? 184 : config.upgradeExpandedHeight));
  const rightDock = mobile && config.mobileHideLeaderboard
    ? null
    : makeBox(width - inset - rightWidth, inset, rightWidth, mobile ? 176 : config.leaderboardHeight);
  const safeLeft = mobile ? inset : inset + Math.max(leftWidth, config.treeButtonWidth + gap + config.developerPanelWidth) + gap;
  const safeRight = mobile
    ? inset + (profile.phoneLandscape ? minimap.width + gap : 0)
    : inset + rightWidth + gap;
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
    viewport: {
      width,
      height,
      mobile,
      compactHud: profile.compactHud,
      phonePortrait: profile.phonePortrait,
      phoneLandscape: profile.phoneLandscape
    },
    cssVars: {
      "--hud-panel-gap": `${gap}px`,
      "--hud-bottom-height": `${bottomHudHeight}px`,
      "--hud-left-width": `${safeLeft}px`,
      "--hud-right-width": `${safeRight}px`,
      "--class-card-bottom": `${classCardBottom}px`,
      "--mobile-class-card-height": `${classCardsHeight}px`,
      "--mobile-minimap-size": `${minimap.width}px`,
      "--touch-fire-lock-bottom": `${bottomHudHeight + gap}px`,
      "--touch-stick-radius": `${config.touchStickVisualRadius}px`,
      "--touch-stick-knob": `${config.touchStickKnobSize}px`
    },
    camera: makeCameraSummary({ width, height }),
    topLeftDock,
    rightDock,
    bottomStatus,
    minimap,
    touchZones,
    actionPill,
    classCards
  };
}

function getClassCardsHeight({ mobile, profile, config }) {
  if (!mobile) {
    return config.classCardsHeight;
  }
  return profile.phoneLandscape
    ? config.mobileLandscapeClassCardsHeight
    : config.mobileClassCardsHeightCompact;
}

function makeMinimapBox({ width, height, inset, mobile, profile, config }) {
  if (mobile) {
    const size = profile.phoneLandscape
      ? config.mobileLandscapeMinimapSize
      : config.mobileMinimapSize;
    return makeBox(width - inset - size, inset, size, size);
  }
  const size = Math.min(config.minimapSize, Math.max(112, width * 0.16));
  return makeBox(width - inset - size, height - inset - size, size, size);
}

function makeCameraSummary({ width, height }) {
  const scale = computeCameraScale({ width, height });
  const visibleWorld = computeVisibleWorldSize({ width, height }, scale);
  return {
    scale,
    visibleWorldWidth: Math.round(visibleWorld.width),
    visibleWorldHeight: Math.round(visibleWorld.height)
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
