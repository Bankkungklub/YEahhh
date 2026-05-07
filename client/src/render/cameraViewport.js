export const CAMERA_VIEWPORT_CONFIG = Object.freeze({
  desktopBreakpoint: 760,
  compactHeightBreakpoint: 520,
  desktopScale: 1,
  portraitMinScale: 0.68,
  portraitMaxScale: 0.74,
  landscapeMinScale: 0.72,
  landscapeMaxScale: 0.84,
  portraitScaleWidthDivisor: 540,
  landscapeScaleHeightDivisor: 520
});

export function getViewportProfile(viewport = {}, config = CAMERA_VIEWPORT_CONFIG) {
  const width = Math.max(1, Math.round(Number(viewport.width) || 1280));
  const height = Math.max(1, Math.round(Number(viewport.height) || 720));
  const compactHud = width < config.desktopBreakpoint || height < config.compactHeightBreakpoint;
  const phonePortrait = compactHud && height >= width;
  const phoneLandscape = compactHud && width > height;
  return {
    width,
    height,
    compactHud,
    mobile: compactHud,
    phonePortrait,
    phoneLandscape
  };
}

export function computeCameraScale(viewport = {}, config = CAMERA_VIEWPORT_CONFIG) {
  const profile = getViewportProfile(viewport, config);
  if (!profile.compactHud) {
    return config.desktopScale;
  }
  if (profile.phoneLandscape) {
    return clampNumber(
      profile.height / config.landscapeScaleHeightDivisor,
      config.landscapeMinScale,
      config.landscapeMaxScale
    );
  }
  return clampNumber(
    profile.width / config.portraitScaleWidthDivisor,
    config.portraitMinScale,
    config.portraitMaxScale
  );
}

export function computeVisibleWorldSize(viewport = {}, scale = computeCameraScale(viewport)) {
  const width = Math.max(1, Number(viewport.width) || 1280);
  const height = Math.max(1, Number(viewport.height) || 720);
  const safeScale = Math.max(0.001, Number(scale) || 1);
  return {
    width: width / safeScale,
    height: height / safeScale
  };
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? numeric : min;
  return Math.max(min, Math.min(max, finite));
}
