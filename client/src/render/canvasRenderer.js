import { GAME_CONFIG } from "../../../shared/config/gameConfig.js";
import { getProjectileVisual } from "../../../shared/config/combatFeelConfig.js";
import { DRONE_CONFIG } from "../../../shared/config/droneConfig.js";
import { TANK_CLASS_CONFIG } from "../../../shared/config/tankClassConfig.js";
import { getActiveScreenShake, getEffectProgress, pruneEffects } from "../game/effects.js";
import { getRenderSnapshot, getTankFromSnapshot } from "../game/clientState.js";
import { getPredictedLocalTank } from "../game/localPrediction.js";
import { ARCADE_WORLD_THEME } from "./arcadeWorldTheme.js";

const VIEWPORT_PADDING = 160;
const SHAPE_HEALTH_NEARBY_DISTANCE = 320;

export function createCanvasRenderer(canvas, state) {
  const context = canvas.getContext("2d");
  const camera = state.camera;

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.width = window.innerWidth;
    camera.height = window.innerHeight;
    camera.scale = 1;
  }

  function render(now) {
    resize();
    const qualityFlags = getCurrentQualityFlags();
    state.effects = pruneEffects(state.effects, now, qualityFlags.effectCap);
    const snapshot = getRenderSnapshot(state, now);
    const localTank = getPredictedLocalTank(state.prediction, snapshot, state.playerId, now)
      ?? getTankFromSnapshot(snapshot, state.playerId);
    const shake = getActiveScreenShake(state.effects, now);
    updateCamera(snapshot, localTank);
    const bounds = getCameraWorldBounds(camera, VIEWPORT_PADDING);
    state.renderMetrics.visibleShapes = 0;
    state.renderMetrics.visibleProjectiles = 0;
    state.renderMetrics.visibleDrones = 0;
    state.renderMetrics.visibleTanks = 0;

    context.clearRect(0, 0, camera.width, camera.height);
    drawBackground(qualityFlags);

    if (!snapshot) {
      drawCenterText("Waiting for arena state...");
      return;
    }

    context.save();
    context.translate(shake.x, shake.y);
    drawWorldBounds(snapshot.world);
    drawGrid(snapshot.world);

    for (const shape of snapshot.shapes) {
      if (!isCircleVisible(shape, bounds)) {
        continue;
      }
      state.renderMetrics.visibleShapes += 1;
      drawShape(shape, shouldShowShapeHealth(shape, localTank));
    }
    for (const projectile of snapshot.projectiles) {
      if (!isCircleVisible(projectile, bounds)) {
        continue;
      }
      state.renderMetrics.visibleProjectiles += 1;
      drawProjectile(projectile, qualityFlags);
    }
    for (const drone of snapshot.drones ?? []) {
      if (!isCircleVisible(drone, bounds)) {
        continue;
      }
      state.renderMetrics.visibleDrones += 1;
      drawDrone(drone, drone.ownerId === state.playerId, qualityFlags);
    }
    for (const tank of snapshot.tanks) {
      const renderTank = tank.id === state.playerId && localTank ? localTank : tank;
      if (!isCircleVisible(renderTank, bounds)) {
        continue;
      }
      state.renderMetrics.visibleTanks += 1;
      drawTank(renderTank, tank.id === state.playerId, now);
    }
    drawEffects(now, bounds);
    context.restore();

    drawMinimap(snapshot, localTank);
  }

  function updateCamera(snapshot, localTank) {
    const world = snapshot?.world ?? GAME_CONFIG.world;
    const targetX = localTank?.x ?? world.width / 2;
    const targetY = localTank?.y ?? world.height / 2;
    camera.x += (targetX - camera.x) * 0.16;
    camera.y += (targetY - camera.y) * 0.16;
  }

  function drawBackground(qualityFlags) {
    const flags = normalizeQualityFlags(qualityFlags);
    const gradient = context.createLinearGradient(0, 0, 0, camera.height);
    gradient.addColorStop(0, ARCADE_WORLD_THEME.skyTop);
    gradient.addColorStop(0.42, ARCADE_WORLD_THEME.skyMid);
    gradient.addColorStop(0.43, ARCADE_WORLD_THEME.grassTop);
    gradient.addColorStop(0.78, ARCADE_WORLD_THEME.grassMid);
    gradient.addColorStop(1, ARCADE_WORLD_THEME.grassBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, camera.width, camera.height);
    if (flags.drawClouds) {
      drawClouds();
    }
    if (flags.drawGrassBands) {
      drawGrassBands();
    }
  }

  function drawClouds() {
    const cloudOffset = -((camera.x * 0.04) % 320);
    context.save();
    context.fillStyle = ARCADE_WORLD_THEME.cloud;
    for (let i = -1; i < 6; i += 1) {
      const x = cloudOffset + i * 320;
      const y = 68 + ((i * 47) % 95);
      context.beginPath();
      context.arc(x, y, 28, 0, Math.PI * 2);
      context.arc(x + 32, y - 10, 34, 0, Math.PI * 2);
      context.arc(x + 68, y, 27, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawGrassBands() {
    context.save();
    context.globalAlpha = 0.32;
    for (let i = 0; i < 8; i += 1) {
      const y = camera.height * 0.45 + i * 52 - ((camera.y * 0.025) % 52);
      context.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(40,130,70,0.12)";
      context.fillRect(0, y, camera.width, 26);
    }
    context.restore();
  }

  function drawWorldBounds(world) {
    const topLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(world.width, world.height);
    context.strokeStyle = ARCADE_WORLD_THEME.gridStrong;
    context.lineWidth = 5;
    context.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  }

  function drawGrid(world) {
    const grid = world.gridSize ?? GAME_CONFIG.world.gridSize;
    const left = camera.x - camera.width / 2;
    const right = camera.x + camera.width / 2;
    const top = camera.y - camera.height / 2;
    const bottom = camera.y + camera.height / 2;
    const startX = Math.max(0, Math.floor(left / grid) * grid);
    const endX = Math.min(world.width, Math.ceil(right / grid) * grid);
    const startY = Math.max(0, Math.floor(top / grid) * grid);
    const endY = Math.min(world.height, Math.ceil(bottom / grid) * grid);

    context.strokeStyle = ARCADE_WORLD_THEME.gridColor;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = startX; x <= endX; x += grid) {
      const a = worldToScreen(x, startY);
      const b = worldToScreen(x, endY);
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    }
    for (let y = startY; y <= endY; y += grid) {
      const a = worldToScreen(startX, y);
      const b = worldToScreen(endX, y);
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    }
    context.stroke();
  }

  function shouldShowShapeHealth(shape, localTank) {
    if (shape.hp < shape.maxHp) {
      return true;
    }
    if (!localTank) {
      return false;
    }
    return distanceSquared(shape, localTank) <= SHAPE_HEALTH_NEARBY_DISTANCE ** 2;
  }

  function drawShape(shape, showHealth) {
    if (shape.isCenterObjective) {
      drawCenterObjectiveShape(shape);
      return;
    }
    if (shape.isEventObjective) {
      drawEventObjectiveShape(shape, showHealth);
      return;
    }
    const point = worldToScreen(shape.x, shape.y);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(shape.x * 0.001 + shape.y * 0.0007);
    context.beginPath();
    for (let i = 0; i < shape.sides; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / shape.sides;
      const x = Math.cos(angle) * shape.radius;
      const y = Math.sin(angle) * shape.radius;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fillStyle = shape.color;
    context.shadowColor = ARCADE_WORLD_THEME.shadow;
    context.shadowBlur = 0;
    context.shadowOffsetY = 4;
    context.strokeStyle = ARCADE_WORLD_THEME.outline;
    context.lineWidth = 5;
    context.fill();
    context.stroke();
    if (showHealth) {
      drawHealthBarLocal(shape.hp, shape.maxHp, shape.radius + 11);
    }
    context.restore();
  }

  function drawEventObjectiveShape(shape, showHealth) {
    const point = worldToScreen(shape.x, shape.y);
    const ratio = Math.max(0, Math.min(1, shape.hp / Math.max(1, shape.maxHp)));
    const pulse = (Math.sin(Date.now() * 0.006) + 1) * 0.5;
    const color = shape.eventColor ?? shape.color;
    const outline = shape.eventOutlineColor ?? ARCADE_WORLD_THEME.outline;
    const pulseColor = shape.eventPulseColor ?? "rgba(255,255,255,0.28)";
    const warning = shape.eventHasDeathBurst && ratio <= 0.32;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(shape.x * 0.0013 + shape.y * 0.0009 + Date.now() * 0.00035);

    context.save();
    context.globalAlpha = warning ? 0.34 + pulse * 0.22 : 0.18 + pulse * 0.08;
    context.strokeStyle = warning ? "#ef4565" : pulseColor;
    context.lineWidth = warning ? 7 : 5;
    context.beginPath();
    context.arc(0, 0, shape.radius + 11 + pulse * 5, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.beginPath();
    for (let i = 0; i < shape.sides; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / shape.sides;
      const radius = shape.radius * (i % 2 === 0 ? 1 : 0.96);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.shadowColor = pulseColor;
    context.shadowBlur = 14;
    context.shadowOffsetY = 5;
    context.fillStyle = color;
    context.strokeStyle = outline;
    context.lineWidth = 6 + Math.max(0, Number(shape.eventThreatLevel) || 0) * 0.7;
    context.fill();
    context.stroke();

    context.globalAlpha = 0.22;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(-shape.radius * 0.24, -shape.radius * 0.24, shape.radius * 0.2, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.textAlign = "center";
    context.font = "900 13px 'Arial Black', Impact, system-ui, sans-serif";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(37,51,67,0.86)";
    context.fillStyle = "#ffffff";
    const percent = Math.max(0, Math.round(ratio * 100));
    const label = `${shape.eventShortLabel ?? "EVENT"} ${percent}%`;
    context.strokeText(label, point.x, point.y - shape.radius - 20);
    context.fillText(label, point.x, point.y - shape.radius - 20);
    context.restore();

    if (showHealth || shape.isEventObjective) {
      context.save();
      context.translate(point.x, point.y);
      drawHealthBarLocal(shape.hp, shape.maxHp, shape.radius + 14);
      context.restore();
    }
  }

  function drawCenterObjectiveShape(shape) {
    const point = worldToScreen(shape.x, shape.y);
    const ratio = Math.max(0, Math.min(1, shape.hp / Math.max(1, shape.maxHp)));
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-Math.PI / 2 + Math.sin(Date.now() * 0.001) * 0.04);
    context.beginPath();
    for (let i = 0; i < shape.sides; i += 1) {
      const angle = (Math.PI * 2 * i) / shape.sides;
      const radius = shape.radius * (i % 2 === 0 ? 1 : 0.93);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.shadowColor = "rgba(127,90,240,0.36)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 6;
    context.fillStyle = shape.color;
    context.strokeStyle = ARCADE_WORLD_THEME.outline;
    context.lineWidth = 8;
    context.fill();
    context.stroke();
    context.globalAlpha = 0.26;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(-shape.radius * 0.28, -shape.radius * 0.28, shape.radius * 0.22, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.textAlign = "center";
    context.font = "900 16px 'Arial Black', Impact, system-ui, sans-serif";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(37,51,67,0.86)";
    context.fillStyle = "#ffffff";
    context.strokeText("ALPHA PENTAGON", point.x, point.y - shape.radius - 30);
    context.fillText("ALPHA PENTAGON", point.x, point.y - shape.radius - 30);
    drawWideHealthBar(point.x, point.y + shape.radius + 16, 150, 11, ratio, "#7f5af0");
    context.restore();
  }

  function drawProjectile(projectile, qualityFlags) {
    const flags = normalizeQualityFlags(qualityFlags);
    const point = worldToScreen(projectile.x, projectile.y);
    const kind = projectile.kind ?? "bullet";
    const visual = getProjectileThreatVisual(projectile);
    const isTrap = kind === "trap";
    const isRocket = kind === "rocket";
    const isSpark = kind === "spark";
    const trailLength = isRocket ? 42 : isSpark ? 16 : 20 + Math.max(0, projectile.radius - GAME_CONFIG.projectile.radius);
    context.save();
    const trailBudget = Number.isFinite(flags.projectileTrailBudget)
      ? flags.projectileTrailBudget
      : Infinity;
    if (!isTrap && flags.drawProjectileTrails && state.renderMetrics.visibleProjectiles <= trailBudget) {
      context.globalAlpha = visual.trailAlpha;
      context.strokeStyle = visual.trail;
      context.lineWidth = isRocket ? projectile.radius * 1.12 : Math.max(1, visual.trailWidth * projectile.radius * 0.42);
      context.beginPath();
      context.moveTo(point.x - Math.cos(projectile.angle) * trailLength, point.y - Math.sin(projectile.angle) * trailLength);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.globalAlpha = 1;
    }
    if (isTrap) {
      drawTrapProjectile(projectile, point, visual);
    } else if (isRocket) {
      drawRocketProjectile(projectile, point, visual);
    } else if (isSpark) {
      drawSparkProjectile(projectile, point, visual);
    } else {
      drawRoundProjectile(projectile, point, visual);
    }
    context.restore();
  }

  function getProjectileThreatVisual(projectile) {
    const visual = getProjectileVisual(projectile.kind ?? "bullet");
    const profileVisual = getProjectileProfileVisual(projectile.feedbackProfile, projectile);
    return {
      ...visual,
      ...profileVisual,
      fill: profileVisual.fill ?? projectile.fillColor ?? visual.fill,
      core: profileVisual.core ?? projectile.coreColor ?? visual.core,
      trail: profileVisual.trail ?? projectile.trailColor ?? visual.trail,
      trailMs: profileVisual.trailMs ?? projectile.trailMs ?? visual.trailMs,
      trailAlpha: profileVisual.trailAlpha ?? projectile.trailAlpha ?? visual.trailAlpha,
      outlineColor: profileVisual.outlineColor ?? projectile.outlineColor ?? visual.outlineColor,
      outlineWidth: profileVisual.outlineWidth ?? projectile.outlineWidth ?? visual.outlineWidth,
      pulseColor: profileVisual.pulseColor ?? projectile.pulseColor ?? visual.pulseColor,
      warningRing: projectile.warningRing ?? profileVisual.warningRing ?? visual.warningRing,
      impactStyle: projectile.impactStyle ?? profileVisual.impactStyle ?? visual.impactStyle,
      feedbackProfile: projectile.feedbackProfile ?? "standard"
    };
  }

  function getProjectileProfileVisual(profile, projectile) {
    switch (profile) {
      case "missile":
        return {
          fill: "#ff7a3d",
          core: "#fff1a8",
          trail: "rgba(255,122,61,0.66)",
          trailAlpha: 0.88,
          outlineWidth: 5,
          pulseColor: "rgba(255,122,61,0.42)",
          impactStyle: "shockwave"
        };
      case "storm":
        return {
          fill: "#8de8e2",
          core: "#ffffff",
          trail: "rgba(141,232,226,0.34)",
          trailAlpha: 0.42,
          outlineWidth: 2.4,
          pulseColor: "rgba(141,232,226,0.2)"
        };
      case "rapid":
        return {
          fill: "#b8f28e",
          core: "#ffffff",
          trail: "rgba(141,232,226,0.38)",
          trailAlpha: 0.5,
          trailWidth: 0.95,
          outlineWidth: 2.2,
          pulseColor: "rgba(141,232,226,0.2)"
        };
      case "precision":
        return {
          fill: "#ffe75c",
          core: "#ffffff",
          trail: "rgba(255,255,255,0.48)",
          trailAlpha: 0.7,
          trailWidth: 1.55,
          outlineWidth: 3.2,
          pulseColor: "rgba(255,255,255,0.28)"
        };
      case "spread":
        return {
          fill: "#ffe75c",
          core: "#fff9b0",
          trail: "rgba(255,231,92,0.25)",
          trailAlpha: 0.38,
          outlineWidth: 2.6,
          pulseColor: "rgba(255,231,92,0.18)"
        };
      case "heavy":
        return {
          fill: "#ffe75c",
          core: "#fff9b0",
          trail: "rgba(255,231,92,0.48)",
          trailAlpha: 0.72,
          outlineWidth: Math.max(4.8, (projectile?.radius ?? 0) * 0.28),
          pulseColor: "rgba(255,231,92,0.44)"
        };
      case "trap":
        return {
          fill: "#7f5af0",
          core: "#ffffff",
          pulseColor: "rgba(214,188,250,0.62)",
          outlineWidth: 4.2,
          warningRing: "armed"
        };
      case "booster":
        return {
          fill: "#87f36f",
          core: "#ffffff",
          trail: "rgba(135,243,111,0.48)",
          trailAlpha: 0.58,
          trailWidth: 1.35,
          outlineWidth: 2.8,
          pulseColor: "rgba(135,243,111,0.24)"
        };
      default:
        return {};
    }
  }

  function drawRoundProjectile(projectile, point, visual) {
    const heavyScale = visual.feedbackProfile === "heavy"
      ? 1.55
      : projectile.radius >= GAME_CONFIG.projectile.radius * 1.45 ? 1.35 : 1;
    if (heavyScale > 1) {
      context.save();
      context.globalAlpha = 0.22;
      context.strokeStyle = visual.pulseColor;
      context.lineWidth = Math.max(2, visual.outlineWidth * 0.7);
      context.beginPath();
      context.arc(point.x, point.y, projectile.radius * 1.42, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.beginPath();
    context.arc(point.x, point.y, projectile.radius, 0, Math.PI * 2);
    context.fillStyle = visual.fill ?? ARCADE_WORLD_THEME.projectile;
    context.fill();
    context.strokeStyle = visual.outlineColor ?? ARCADE_WORLD_THEME.outline;
    context.lineWidth = Math.max(2, visual.outlineWidth * heavyScale);
    context.stroke();
    context.beginPath();
    context.arc(point.x - 1, point.y - 1, projectile.radius * 0.36, 0, Math.PI * 2);
    context.fillStyle = visual.core ?? ARCADE_WORLD_THEME.projectileCore;
    context.fill();
  }

  function drawRocketProjectile(projectile, point, visual) {
    if (visual.feedbackProfile === "missile") {
      context.save();
      const steerRatio = Math.max(0, Math.min(1, 1 - (projectile.ageMs ?? 0) / 850));
      context.globalAlpha = 0.18 + steerRatio * 0.18;
      context.strokeStyle = visual.pulseColor ?? "rgba(255,122,61,0.42)";
      context.lineWidth = Math.max(2, projectile.radius * 0.36);
      context.beginPath();
      context.arc(point.x, point.y, projectile.radius * (2.05 - steerRatio * 0.28), 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.save();
    context.translate(point.x, point.y);
    context.rotate(projectile.angle ?? 0);
    context.fillStyle = visual.fill ?? "#ff8c42";
    context.strokeStyle = visual.outlineColor ?? ARCADE_WORLD_THEME.outline;
    context.lineWidth = Math.max(3, visual.outlineWidth);
    context.beginPath();
    context.moveTo(-projectile.radius * 0.95, -projectile.radius * 0.9);
    context.lineTo(-projectile.radius * 1.65, -projectile.radius * 1.32);
    context.lineTo(-projectile.radius * 1.28, -projectile.radius * 0.22);
    context.moveTo(-projectile.radius * 0.95, projectile.radius * 0.9);
    context.lineTo(-projectile.radius * 1.65, projectile.radius * 1.32);
    context.lineTo(-projectile.radius * 1.28, projectile.radius * 0.22);
    context.stroke();
    context.roundRect(-projectile.radius * 1.2, -projectile.radius * 0.72, projectile.radius * 2.4, projectile.radius * 1.44, 5);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(projectile.radius * 0.45, -projectile.radius * 0.12, projectile.radius * 0.28, 0, Math.PI * 2);
    context.fillStyle = visual.core ?? "#fff1a8";
    context.fill();
    context.restore();
  }

  function drawSparkProjectile(projectile, point, visual) {
    context.save();
    context.translate(point.x, point.y);
    context.rotate(projectile.angle ?? 0);
    const size = projectile.radius * 1.35;
    context.fillStyle = visual.fill ?? "#f25f4c";
    context.strokeStyle = visual.outlineColor ?? ARCADE_WORLD_THEME.outline;
    context.lineWidth = Math.max(2, visual.outlineWidth);
    context.beginPath();
    context.moveTo(size, 0);
    context.lineTo(-size * 0.22, -size * 0.62);
    context.lineTo(-size * 0.84, 0);
    context.lineTo(-size * 0.22, size * 0.62);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(size * 0.05, 0, projectile.radius * 0.28, 0, Math.PI * 2);
    context.fillStyle = visual.core ?? "#ffe75c";
    context.fill();
    context.restore();
  }

  function drawTrapProjectile(projectile, point, visual) {
    context.save();
    context.translate(point.x, point.y);
    context.rotate((projectile.angle ?? 0) + Math.PI / 4);
    const pulse = projectile.armed ? 1 + Math.sin((projectile.createdAtMs ?? 0) * 0.01 + performance.now() * 0.006) * 0.08 : 0.82;
    const size = projectile.radius * 1.45 * pulse;
    if (visual.warningRing === "always" || visual.warningRing === "armed" && projectile.armed) {
      context.save();
      context.globalAlpha = projectile.armed ? 0.62 : 0.26;
      context.strokeStyle = visual.pulseColor ?? "rgba(214,188,250,0.45)";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, size * 0.88, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.fillStyle = projectile.armed ? (visual.fill ?? "#7f5af0") : "rgba(127,90,240,0.46)";
    context.strokeStyle = projectile.armed ? (visual.core ?? "#ffffff") : (visual.outlineColor ?? ARCADE_WORLD_THEME.outline);
    context.lineWidth = projectile.armed ? Math.max(3.5, visual.outlineWidth) : 2.5;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.strokeRect(-size / 2, -size / 2, size, size);
    context.fillStyle = visual.core ?? "#d6bcfa";
    context.fillRect(-size * 0.18, -size * 0.18, size * 0.36, size * 0.36);
    context.restore();
  }

  function drawDrone(drone, isLocal, qualityFlags) {
    const flags = normalizeQualityFlags(qualityFlags);
    const point = worldToScreen(drone.x, drone.y);
    const radius = Math.max(6, Number(drone.radius) || 10);
    const maxHp = Math.max(1, Number(drone.maxHp) || 1);
    const hpRatio = Math.max(0, Math.min(1, (Number(drone.hp) || 0) / maxHp));
    const angle = Number.isFinite(drone.angle) ? drone.angle : 0;

    if (isLocal && flags.mode !== "low" && drone.mode === "attack") {
      drawDroneCommandLine(drone);
    }

    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    context.globalAlpha = drone.converted ? 0.88 : 1;
    context.shadowColor = isLocal ? "rgba(255,255,255,0.2)" : "rgba(37,51,67,0.18)";
    context.shadowBlur = isLocal ? 8 : 4;
    context.fillStyle = drone.fillColor ?? drone.ownerColor ?? "#b8f28e";
    context.strokeStyle = isLocal
      ? DRONE_CONFIG.render.localOutlineColor
      : drone.outlineColor ?? DRONE_CONFIG.render.enemyOutlineColor;
    context.lineWidth = isLocal ? 3.2 : 2.6;
    context.beginPath();
    context.moveTo(radius * 1.12, 0);
    context.lineTo(-radius * 0.72, -radius * 0.78);
    context.lineTo(-radius * 0.42, 0);
    context.lineTo(-radius * 0.72, radius * 0.78);
    context.closePath();
    context.fill();
    context.stroke();
    context.globalAlpha = 0.25 + hpRatio * 0.22;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(-radius * 0.12, -radius * 0.18, radius * 0.24, 0, Math.PI * 2);
    context.fill();
    context.restore();

    if (hpRatio < 1 && flags.mode !== "low") {
      context.save();
      context.translate(point.x, point.y);
      drawHealthBarLocal(drone.hp, maxHp, radius + 8);
      context.restore();
    }
  }

  function drawDroneCommandLine(drone) {
    const from = worldToScreen(drone.x, drone.y);
    const targetX = Number.isFinite(drone.targetX) ? drone.targetX : drone.x;
    const targetY = Number.isFinite(drone.targetY) ? drone.targetY : drone.y;
    const to = worldToScreen(targetX, targetY);
    context.save();
    context.strokeStyle = DRONE_CONFIG.render.commandLineColor;
    context.lineWidth = 1.5;
    context.setLineDash([6, 7]);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  }

  function drawTank(tank, isLocal, now) {
    const point = worldToScreen(tank.x, tank.y);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(tank.angle);
    const cosmetics = tank.cosmetics ?? {};
    const tankClass = TANK_CLASS_CONFIG.classes[tank.classId] ?? TANK_CLASS_CONFIG.classes.basic;
    const bodyColor = tank.invulnerable && Math.floor(now / 120) % 2 === 0
      ? "rgba(255,255,255,0.45)"
      : cosmetics.bodyColor ?? tank.color;
    context.shadowColor = ARCADE_WORLD_THEME.shadow;
    context.shadowBlur = 0;
    context.shadowOffsetY = 4;
    drawTankBarrels(tank, tankClass);
    drawTankAccents(tank, tankClass, bodyColor, isLocal ? (cosmetics.outlineColor ?? "#faae2b") : (cosmetics.outlineColor ?? ARCADE_WORLD_THEME.outline));
    context.fillStyle = bodyColor;
    context.strokeStyle = isLocal ? (cosmetics.outlineColor ?? "#faae2b") : (cosmetics.outlineColor ?? ARCADE_WORLD_THEME.outline);
    context.lineWidth = isLocal ? 6 : 5;
    drawTankBody(tank, tankClass);
    drawTankRingAndCore(tank, tankClass, isLocal);
    drawTankBadge(tank);
    context.restore();

    drawTankLabel(tank, point, isLocal);
  }

  function drawTankBarrels(tank, tankClass) {
    const barrels = tankClass.icon?.barrels ?? TANK_CLASS_CONFIG.classes.basic.icon.barrels;
    const kick = Math.max(0, Math.min(1, tank.barrelKickRatio ?? 0)) * 7;
    for (const barrel of barrels) {
      context.save();
      context.rotate(barrel.angle ?? 0);
      const style = barrel.style ?? "standard";
      const length = Math.max(style === "mini" ? 18 : 26, barrel.length ?? tank.radius + 22);
      const width = Math.max(style === "mini" ? 6 : 10, barrel.width ?? 14);
      const rounded = style === "rocket" || style === "trap" || style === "heavy" ? 7 : 3;
      context.fillStyle = getBarrelFill(style);
      context.strokeStyle = ARCADE_WORLD_THEME.outline;
      context.lineWidth = 4;
      context.beginPath();
      context.roundRect(-kick, -width / 2, length, width, rounded);
      context.fill();
      context.stroke();
      if (style === "rocket") {
        drawRocketFins(length - kick, width);
      } else if (style === "trap") {
        drawTrapMouth(length - kick, width);
      } else {
        context.fillStyle = ARCADE_WORLD_THEME.barrelDark;
        context.fillRect(length - 7 - kick, -width / 2 + 3, 5, Math.max(2, width - 6));
      }
      context.restore();
    }
  }

  function drawTankAccents(tank, tankClass, bodyColor, outlineColor) {
    const accents = tankClass.icon?.accents ?? [];
    if (accents.length === 0) {
      return;
    }
    for (const accent of accents) {
      context.save();
      context.rotate(accent.angle ?? 0);
      const offset = tank.radius * (accent.offset ?? 0.9);
      const size = tank.radius * (accent.size ?? 0.5);
      context.translate(offset, 0);
      context.fillStyle = accent.type === "rocketFin" ? "#ffb86c" : bodyColor;
      context.strokeStyle = outlineColor;
      context.lineWidth = 4;
      if (accent.type === "spike") {
        context.beginPath();
        context.moveTo(size * 0.9, 0);
        context.lineTo(-size * 0.35, -size * 0.42);
        context.lineTo(-size * 0.35, size * 0.42);
        context.closePath();
        context.fill();
        context.stroke();
      } else if (accent.type === "shield") {
        context.beginPath();
        context.roundRect(-size * 0.55, -size * 0.42, size * 1.1, size * 0.84, 6);
        context.fill();
        context.stroke();
      } else if (accent.type === "rocketFin") {
        context.beginPath();
        context.moveTo(size * 0.45, 0);
        context.lineTo(-size * 0.5, -size * 0.38);
        context.lineTo(-size * 0.22, 0);
        context.lineTo(-size * 0.5, size * 0.38);
        context.closePath();
        context.fill();
        context.stroke();
      } else {
        context.beginPath();
        context.arc(0, 0, size * 0.45, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.restore();
    }
  }

  function drawTankBody(tank, tankClass) {
    const body = tankClass.icon?.body ?? "circle";
    const radius = tank.radius * Math.max(0.5, Number(tankClass.icon?.bodyScale) || 1);
    context.beginPath();
    if (body === "diamond") {
      context.moveTo(0, -radius);
      context.lineTo(radius, 0);
      context.lineTo(0, radius);
      context.lineTo(-radius, 0);
      context.closePath();
    } else if (body === "square") {
      context.roundRect(-radius * 0.82, -radius * 0.82, radius * 1.64, radius * 1.64, 5);
    } else if (body === "triangle") {
      drawPolygonPath(3, radius * 1.05, 0);
    } else if (body === "hex") {
      drawPolygonPath(6, radius, Math.PI / 6);
    } else if (body === "spike") {
      drawSpikeBodyPath(radius);
    } else {
      context.arc(0, 0, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
  }

  function drawTankRingAndCore(tank, tankClass, isLocal) {
    const icon = tankClass.icon ?? {};
    const radius = tank.radius * Math.max(0.5, Number(icon.bodyScale) || 1);
    if (icon.ring && icon.ring !== "none") {
      context.save();
      context.strokeStyle = isLocal ? "#ffffff" : "rgba(255,255,255,0.82)";
      context.lineWidth = icon.ring === "heavy" ? 4 : 2.5;
      if (icon.ring === "dashed") {
        context.setLineDash([5, 4]);
      }
      context.beginPath();
      context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    if (!icon.core || icon.core === "none") {
      return;
    }
    context.save();
    context.fillStyle = "rgba(255,255,255,0.88)";
    context.strokeStyle = ARCADE_WORLD_THEME.outline;
    context.lineWidth = 2.5;
    if (icon.core === "diamond") {
      const core = radius * 0.32;
      context.beginPath();
      context.moveTo(0, -core);
      context.lineTo(core, 0);
      context.lineTo(0, core);
      context.lineTo(-core, 0);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (icon.core === "star") {
      drawStarPath(radius * 0.34, radius * 0.16);
      context.fill();
      context.stroke();
    } else {
      context.beginPath();
      context.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function drawPolygonPath(sides, radius, rotation = 0) {
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + (Math.PI * 2 * index) / sides;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }

  function drawSpikeBodyPath(radius) {
    for (let index = 0; index < 12; index += 1) {
      const r = index % 2 === 0 ? radius * 1.06 : radius * 0.72;
      const angle = (Math.PI * 2 * index) / 12;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }

  function drawStarPath(outerRadius, innerRadius) {
    context.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 10;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }

  function getBarrelFill(style) {
    if (style === "rocket") {
      return "#ff8c42";
    }
    if (style === "trap") {
      return "#7f5af0";
    }
    if (style === "mini") {
      return "#9aa8b5";
    }
    if (style === "heavy") {
      return "#6f7884";
    }
    if (style === "long") {
      return "#a5b3bd";
    }
    return ARCADE_WORLD_THEME.barrel;
  }

  function drawRocketFins(length, width) {
    context.fillStyle = "#f25f4c";
    context.beginPath();
    context.moveTo(length - 8, -width / 2);
    context.lineTo(length - 18, -width * 0.9);
    context.lineTo(length - 15, -width / 2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(length - 8, width / 2);
    context.lineTo(length - 18, width * 0.9);
    context.lineTo(length - 15, width / 2);
    context.closePath();
    context.fill();
  }

  function drawTrapMouth(length, width) {
    context.fillStyle = "#d6bcfa";
    context.save();
    context.translate(length - 9, 0);
    context.rotate(Math.PI / 4);
    const size = Math.max(6, width * 0.42);
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }

  function drawTankBadge(tank) {
    if (tank.cosmetics?.badge !== "star") {
      return;
    }
    context.save();
    context.rotate(-tank.angle);
    context.fillStyle = "#faae2b";
    context.strokeStyle = "rgba(0,0,0,0.55)";
    context.lineWidth = 2;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 8 : 3.6;
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawTankLabel(tank, point, isLocal) {
    context.save();
    context.textAlign = "center";
    context.font = "700 12px system-ui, sans-serif";
    context.fillStyle = isLocal ? "#ffffff" : "rgba(247,251,255,0.86)";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(37,51,67,0.8)";
    const label = `${tank.name} L${tank.level} ${tank.className ?? ""}`.trim();
    context.strokeText(label, point.x, point.y - tank.radius - 23);
    context.fillText(label, point.x, point.y - tank.radius - 23);
    context.translate(point.x, point.y);
    drawHealthBarLocal(tank.hp, tank.maxHp, tank.radius + 12);
    context.restore();
  }

  function drawHealthBarLocal(hp, maxHp, y) {
    const width = 48;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    context.fillStyle = "rgba(0,0,0,0.42)";
    context.fillRect(-width / 2, y, width, 5);
    context.fillStyle = ratio > 0.38 ? "#2cb67d" : "#ef4565";
    context.fillRect(-width / 2, y, width * ratio, 5);
  }

  function drawWideHealthBar(x, y, width, height, ratio, fill) {
    context.fillStyle = "rgba(0,0,0,0.48)";
    context.fillRect(x - width / 2, y, width, height);
    context.fillStyle = fill;
    context.fillRect(x - width / 2, y, width * ratio, height);
    context.strokeStyle = ARCADE_WORLD_THEME.outline;
    context.lineWidth = 3;
    context.strokeRect(x - width / 2, y, width, height);
  }

  function drawMinimap(snapshot, localTank) {
    const size = Math.min(150, Math.max(112, camera.width * 0.16));
    const padding = 16;
    const x = camera.width - size - padding;
    const y = camera.height - size - padding;
    const world = snapshot.world;

    context.save();
    context.fillStyle = "rgba(8,13,24,0.72)";
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 1;
    context.fillRect(x, y, size, size);
    context.strokeRect(x, y, size, size);

    for (const tank of snapshot.tanks) {
      const px = x + (tank.x / world.width) * size;
      const py = y + (tank.y / world.height) * size;
      context.fillStyle = tank.id === state.playerId ? "#faae2b" : tank.color;
      context.fillRect(px - 2, py - 2, 4, 4);
    }

    if (snapshot.centerObjective?.enabled && snapshot.centerObjective?.uiHidden !== true) {
      const objective = snapshot.centerObjective;
      const px = x + (objective.x / world.width) * size;
      const py = y + (objective.y / world.height) * size;
      context.save();
      context.translate(px, py);
      context.rotate(Math.PI / 4);
      context.fillStyle = objective.state === "alive" ? "#7f5af0" : "rgba(127,90,240,0.35)";
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.5;
      context.fillRect(-4, -4, 8, 8);
      context.strokeRect(-4, -4, 8, 8);
      context.restore();
    }

    for (const eventObjective of snapshot.eventObjectives ?? []) {
      const px = x + (eventObjective.x / world.width) * size;
      const py = y + (eventObjective.y / world.height) * size;
      const markerSize = Math.max(5, Math.min(10, eventObjective.ui?.minimapSize ?? 6));
      context.save();
      context.translate(px, py);
      context.rotate(eventObjective.shapeType === "square" ? Math.PI / 4 : -Math.PI / 2);
      context.fillStyle = eventObjective.ui?.color ?? "#ffe75c";
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.3;
      context.beginPath();
      const sides = eventObjective.shapeType === "triangle" ? 3 : eventObjective.shapeType === "square" ? 4 : 5;
      for (let i = 0; i < sides; i += 1) {
        const angle = (Math.PI * 2 * i) / sides;
        const mx = Math.cos(angle) * markerSize;
        const my = Math.sin(angle) * markerSize;
        if (i === 0) {
          context.moveTo(mx, my);
        } else {
          context.lineTo(mx, my);
        }
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }

    if (localTank) {
      const px = x + (localTank.x / world.width) * size;
      const py = y + (localTank.y / world.height) * size;
      context.strokeStyle = "#ffffff";
      context.strokeRect(px - 5, py - 5, 10, 10);
    }
    context.restore();
  }

  function drawEffects(now, bounds) {
    for (const effect of state.effects) {
      if (effect.type === "hitFlash" || effect.type === "muzzleFlash" || effect.type === "impactBurst" || effect.type === "damageDirection") {
        if (!isCircleVisible({ x: effect.x, y: effect.y, radius: (effect.radius ?? 80) + 24 }, bounds)) {
          continue;
        }
        if (effect.type === "muzzleFlash") {
          drawMuzzleFlash(effect, now);
        } else if (effect.type === "impactBurst") {
          drawImpactBurst(effect, now);
        } else if (effect.type === "damageDirection") {
          drawDamageDirection(effect, now);
        } else {
          drawHitFlash(effect, now);
        }
      }
    }
    for (const effect of state.effects) {
      if (effect.type === "damageText" || effect.type === "xpText" || effect.type === "damageCauseToast") {
        if (!isCircleVisible({ x: effect.x, y: effect.y, radius: 80 }, bounds)) {
          continue;
        }
        drawFloatingText(effect, now);
      }
    }
  }

  function drawHitFlash(effect, now) {
    const progress = getEffectProgress(effect, now);
    if (progress >= 1) {
      return;
    }

    const point = worldToScreen(effect.x, effect.y);
    const radius = effect.radius + progress * 18;
    context.save();
    context.globalAlpha = 1 - progress;
    context.strokeStyle = effect.color;
    context.lineWidth = 4 - progress * 2;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawMuzzleFlash(effect, now) {
    const progress = getEffectProgress(effect, now);
    if (progress >= 1) {
      return;
    }
    const point = worldToScreen(effect.x, effect.y);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(effect.angle ?? 0);
    context.globalAlpha = 1 - progress;
    context.fillStyle = effect.color ?? "#fff1a8";
    context.strokeStyle = effect.outlineColor ?? "rgba(37,51,67,0.55)";
    context.lineWidth = 2;
    const length = effect.radius * (1.1 + progress * 0.8);
    context.beginPath();
    context.moveTo(length, 0);
    context.lineTo(-effect.radius * 0.35, -effect.radius * 0.42);
    context.lineTo(-effect.radius * 0.12, 0);
    context.lineTo(-effect.radius * 0.35, effect.radius * 0.42);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawImpactBurst(effect, now) {
    const progress = getEffectProgress(effect, now);
    if (progress >= 1) {
      return;
    }
    const point = worldToScreen(effect.x, effect.y);
    const radius = effect.radius * (0.45 + progress * 0.85);
    const style = effect.impactStyle ?? "ring";
    context.save();
    context.globalAlpha = 1 - progress;
    context.strokeStyle = effect.color ?? "#ffe75c";
    context.lineWidth = Math.max(1, style === "shockwave" ? 6 - progress * 4.5 : 5 - progress * 4);
    if (style === "shockwave") {
      context.strokeStyle = effect.pulseColor ?? effect.color ?? "#ff8c42";
      context.beginPath();
      context.arc(point.x, point.y, radius * 0.92, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = Math.max(0, 0.58 - progress * 0.5);
      context.strokeStyle = effect.outlineColor ?? "rgba(37,51,67,0.7)";
      context.beginPath();
      context.arc(point.x, point.y, radius * 1.18, 0, Math.PI * 2);
      context.stroke();
    } else if (style === "shards") {
      context.strokeStyle = effect.color ?? "#f25f4c";
      for (let index = 0; index < 7; index += 1) {
        const angle = (Math.PI * 2 * index) / 7 + progress * 0.45;
        context.beginPath();
        context.moveTo(point.x + Math.cos(angle) * radius * 0.26, point.y + Math.sin(angle) * radius * 0.26);
        context.lineTo(point.x + Math.cos(angle) * radius * 1.05, point.y + Math.sin(angle) * radius * 1.05);
        context.stroke();
      }
    } else {
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        context.beginPath();
        context.moveTo(point.x + Math.cos(angle) * radius * 0.38, point.y + Math.sin(angle) * radius * 0.38);
        context.lineTo(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius);
        context.stroke();
      }
    }
    context.restore();
  }

  function drawDamageDirection(effect, now) {
    const progress = getEffectProgress(effect, now);
    if (progress >= 1) {
      return;
    }
    const point = worldToScreen(effect.x, effect.y);
    const intensity = Math.max(0.15, Math.min(1, effect.intensity ?? 0.35));
    const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
    const offset = 34 + intensity * 26;
    const x = point.x - Math.cos(angle) * offset;
    const y = point.y - Math.sin(angle) * offset;
    const size = 10 + intensity * 10;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.globalAlpha = Math.max(0, 1 - progress);
    context.fillStyle = effect.color ?? "#ff8ba7";
    context.strokeStyle = "rgba(37,51,67,0.82)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(size, 0);
    context.lineTo(-size * 0.62, -size * 0.55);
    context.lineTo(-size * 0.28, 0);
    context.lineTo(-size * 0.62, size * 0.55);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawFloatingText(effect, now) {
    const progress = getEffectProgress(effect, now);
    if (progress >= 1) {
      return;
    }

    const floatY = effect.type === "xpText" ? 44 : 34;
    const point = worldToScreen(effect.x, effect.y - progress * floatY);
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.textAlign = "center";
    context.font = effect.type === "xpText"
      ? "800 16px system-ui, sans-serif"
      : effect.type === "damageCauseToast"
        ? "900 13px system-ui, sans-serif"
        : "800 14px system-ui, sans-serif";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(0,0,0,0.68)";
    context.fillStyle = effect.color;
    context.strokeText(effect.text, point.x, point.y);
    context.fillText(effect.text, point.x, point.y);
    context.restore();
  }

  function drawCenterText(text) {
    context.fillStyle = "rgba(247,251,255,0.75)";
    context.font = "700 16px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(text, camera.width / 2, camera.height / 2);
  }

  function worldToScreen(x, y) {
    return {
      x: (x - camera.x) * camera.scale + camera.width / 2,
      y: (y - camera.y) * camera.scale + camera.height / 2
    };
  }

  function getCurrentQualityFlags() {
    return normalizeQualityFlags(state.renderQuality?.flags);
  }

  return {
    render,
    getCamera() {
      return camera;
    }
  };
}

export function getCameraWorldBounds(camera, padding = 0) {
  const scale = Math.max(0.001, camera.scale || 1);
  const halfWidth = camera.width / (2 * scale);
  const halfHeight = camera.height / (2 * scale);
  return {
    left: camera.x - halfWidth - padding,
    right: camera.x + halfWidth + padding,
    top: camera.y - halfHeight - padding,
    bottom: camera.y + halfHeight + padding
  };
}

export function isCircleVisible(entity, bounds) {
  const radius = Math.max(0, Number(entity.radius) || 0);
  return (
    entity.x + radius >= bounds.left &&
    entity.x - radius <= bounds.right &&
    entity.y + radius >= bounds.top &&
    entity.y - radius <= bounds.bottom
  );
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalizeQualityFlags(flags) {
  return {
    mode: "high",
    drawClouds: true,
    drawGrassBands: true,
    drawProjectileTrails: true,
    effectCap: 80,
    projectileTrailBudget: Infinity,
    ...(flags && typeof flags === "object" ? flags : {})
  };
}
