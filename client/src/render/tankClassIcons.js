import { TANK_CLASS_CONFIG } from "../../../shared/config/tankClassConfig.js";

export function createTankClassIcon(classId, status = "locked", config = TANK_CLASS_CONFIG) {
  const fallbackClass = TANK_CLASS_CONFIG.classes[classId]
    ?? TANK_CLASS_CONFIG.classes[TANK_CLASS_CONFIG.defaultClassId];
  const tankClass = config.classes[classId] ?? config.classes[config.defaultClassId] ?? fallbackClass;
  const iconConfig = fallbackClass.icon ?? tankClass.icon ?? TANK_CLASS_CONFIG.classes.basic.icon;
  const icon = document.createElement("div");
  const body = document.createElement("span");
  icon.className = `tank-class-icon ${status}`;
  icon.style.setProperty("--class-color", tankClass.themeColor ?? fallbackClass.themeColor);
  body.className = `tank-class-icon-body ${iconConfig.body ?? "circle"}`;
  body.style.setProperty("--body-scale", iconConfig.bodyScale ?? 1);

  for (const barrel of iconConfig.barrels ?? []) {
    const barrelNode = document.createElement("span");
    barrelNode.className = `tank-class-icon-barrel ${barrel.style ?? "standard"}`;
    barrelNode.style.width = `${barrel.length ?? 30}px`;
    barrelNode.style.height = `${barrel.width ?? 12}px`;
    barrelNode.style.transform = `translateY(-50%) rotate(${barrel.angle ?? 0}rad)`;
    icon.append(barrelNode);
  }

  for (const accent of iconConfig.accents ?? []) {
    const accentNode = document.createElement("span");
    accentNode.className = `tank-class-icon-accent ${accent.type}`;
    accentNode.style.setProperty("--accent-angle", `${accent.angle ?? 0}rad`);
    accentNode.style.setProperty("--accent-size", accent.size ?? 0.5);
    accentNode.style.setProperty("--accent-offset", accent.offset ?? 0.9);
    icon.append(accentNode);
  }

  icon.append(body);
  if (iconConfig.ring && iconConfig.ring !== "none") {
    const ring = document.createElement("span");
    ring.className = `tank-class-icon-ring ${iconConfig.ring}`;
    ring.style.setProperty("--body-scale", iconConfig.bodyScale ?? 1);
    icon.append(ring);
  }
  if (iconConfig.core && iconConfig.core !== "none") {
    const core = document.createElement("span");
    core.className = `tank-class-icon-core ${iconConfig.core}`;
    icon.append(core);
  }
  return icon;
}
