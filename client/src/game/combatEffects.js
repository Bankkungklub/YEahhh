import { getProjectileVisual } from "../../../shared/config/combatFeelConfig.js";

export function appendCombatEffects({ previousSnapshot, nextSnapshot, append }) {
  if (!previousSnapshot || !nextSnapshot || typeof append !== "function") {
    return;
  }

  const previousProjectiles = mapById(previousSnapshot.projectiles ?? []);
  const nextProjectiles = mapById(nextSnapshot.projectiles ?? []);

  for (const projectile of nextProjectiles.values()) {
    if (previousProjectiles.has(projectile.id)) {
      continue;
    }
    const visual = getProjectileEffectVisual(projectile);
    append({
      type: "muzzleFlash",
      ttlMs: projectile.kind === "rocket" ? 130 : 90,
      x: projectile.spawnX ?? projectile.x,
      y: projectile.spawnY ?? projectile.y,
      angle: projectile.angle ?? 0,
      radius: Math.max(10, (projectile.radius ?? 6) * 2.4),
      color: visual.core,
      outlineColor: visual.outlineColor,
      impactStyle: visual.impactStyle,
      kind: projectile.kind ?? "bullet"
    });
  }

  for (const projectile of previousProjectiles.values()) {
    if (nextProjectiles.has(projectile.id)) {
      continue;
    }
    const visual = getProjectileEffectVisual(projectile);
    append({
      type: "impactBurst",
      ttlMs: projectile.kind === "rocket" ? 220 : 150,
      x: projectile.x,
      y: projectile.y,
      radius: projectile.kind === "rocket" ? Math.max(30, (projectile.radius ?? 6) * 4) : Math.max(16, (projectile.radius ?? 6) * 2.6),
      color: visual.fill,
      outlineColor: visual.outlineColor,
      pulseColor: visual.pulseColor,
      impactStyle: visual.impactStyle,
      kind: projectile.kind ?? "bullet"
    });
  }
}

function getProjectileEffectVisual(projectile) {
  const visual = getProjectileVisual(projectile.kind ?? "bullet");
  return {
    ...visual,
    fill: projectile.fillColor ?? visual.fill,
    core: projectile.coreColor ?? visual.core,
    outlineColor: projectile.outlineColor ?? visual.outlineColor,
    pulseColor: projectile.pulseColor ?? visual.pulseColor,
    impactStyle: projectile.impactStyle ?? visual.impactStyle
  };
}

function mapById(items) {
  return new Map(items.map((item) => [item.id, item]));
}
