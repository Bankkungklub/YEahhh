import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";

export function getTankClass(classId, config = TANK_CLASS_CONFIG) {
  return config.classes[classId] ?? config.classes[config.defaultClassId];
}

export function getTankClassName(classId, config = TANK_CLASS_CONFIG) {
  return getTankClass(classId, config).name;
}

export function getClassPath(classId, config = TANK_CLASS_CONFIG) {
  const classes = config.classes;
  const path = [];
  let current = classes[classId];
  const guard = new Set();

  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    path.unshift(current.id);
    current = current.parentId ? classes[current.parentId] : null;
  }

  return path.length > 0 ? path : [config.defaultClassId];
}

export function getAvailableClassChoices(tank, config = TANK_CLASS_CONFIG) {
  const current = getTankClass(tank.classId, config);
  return current.children.filter((classId) => canSelectClass(tank, classId, config));
}

export function canSelectClass(tank, classId, config = TANK_CLASS_CONFIG) {
  const current = getTankClass(tank.classId, config);
  const target = config.classes[classId];
  if (!target || !target.active) {
    return false;
  }
  if (target.id === current.id) {
    return false;
  }
  return (
    target.parentId === current.id &&
    tank.level >= target.unlockLevel &&
    target.unlockLevel <= config.maxSelectableLevel
  );
}

export function selectTankClass(tank, classId, config = TANK_CLASS_CONFIG) {
  if (!canSelectClass(tank, classId, config)) {
    return false;
  }
  tank.classId = classId;
  tank.classHistory = [...(tank.classHistory ?? []), classId];
  tank.classUnlockChoices = getAvailableClassChoices(tank, config);
  return true;
}

export function refreshClassUnlocks(tank, config = TANK_CLASS_CONFIG) {
  tank.classId = getTankClass(tank.classId, config).id;
  tank.classHistory ??= [tank.classId];
  tank.classUnlockChoices = getAvailableClassChoices(tank, config);
  return tank.classUnlockChoices;
}

export function downgradeClassForLevel(tank, level, config = TANK_CLASS_CONFIG) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  const fallbackPath = getClassPath(tank.classId, config);
  const history = Array.isArray(tank.classHistory) && tank.classHistory.length > 0
    ? tank.classHistory.filter((classId) => config.classes[classId])
    : fallbackPath;
  const path = history.length > 0 ? history : [config.defaultClassId];
  let selected = config.defaultClassId;
  const selectedPath = [];

  for (const classId of path) {
    const tankClass = config.classes[classId];
    if (!tankClass || tankClass.unlockLevel > safeLevel) {
      break;
    }
    if (selectedPath.length > 0 && tankClass.parentId !== selectedPath[selectedPath.length - 1]) {
      break;
    }
    selected = classId;
    selectedPath.push(classId);
  }

  tank.classId = selected;
  tank.classHistory = selectedPath.length > 0 ? selectedPath : [config.defaultClassId];
  tank.classUnlockChoices = getAvailableClassChoices(tank, config);
  return {
    classId: tank.classId,
    classHistory: tank.classHistory,
    classUnlockChoices: tank.classUnlockChoices
  };
}

export function getClassAdjustedTankStats(stats, classId, config = TANK_CLASS_CONFIG) {
  const tankClass = getTankClass(classId, config);
  const modifiers = tankClass.statModifiers ?? {};
  const reloadMs = stats.reloadMs * (modifiers.reload ?? 1);
  return {
    ...stats,
    maxHp: stats.maxHp * (modifiers.maxHp ?? 1),
    radius: stats.radius * (modifiers.radius ?? 1),
    bulletDamage: stats.bulletDamage * (modifiers.damage ?? 1),
    bulletSpeed: stats.bulletSpeed * (modifiers.bulletSpeed ?? 1),
    moveSpeed: stats.moveSpeed * (modifiers.moveSpeed ?? 1),
    projectileRadius: (stats.projectileRadius ?? 6) * (modifiers.projectileRadius ?? 1),
    projectileTtlMs: (stats.projectileTtlMs ?? 1400) * (modifiers.bulletTtl ?? 1),
    bodyDamageMultiplier: modifiers.bodyDamage ?? 1,
    bodyResistance: modifiers.bodyResistance ?? 1,
    recoilMultiplier: modifiers.recoilMultiplier ?? 1,
    reloadMs: Math.max(140, reloadMs)
  };
}

export function getWeaponPattern(classId, config = TANK_CLASS_CONFIG) {
  const tankClass = getTankClass(classId, config);
  return config.weaponPatterns[tankClass.weaponPattern] ?? config.weaponPatterns.single;
}

export function getDroneLoadoutId(classId, config = TANK_CLASS_CONFIG) {
  return getTankClass(classId, config).droneLoadoutId ?? null;
}

export function isDroneClass(classId, config = TANK_CLASS_CONFIG) {
  return Boolean(getDroneLoadoutId(classId, config));
}

export function getClassNodeStatus({ localTank, classId, config = TANK_CLASS_CONFIG }) {
  const tankClass = config.classes[classId];
  if (!tankClass) {
    return "unknown";
  }
  if (!localTank) {
    return classId === config.defaultClassId ? "selected" : "locked";
  }
  if (localTank.classId === classId) {
    return "selected";
  }
  const path = getClassPath(localTank.classId, config);
  if (path.includes(classId)) {
    return "path";
  }
  if (canSelectClass(localTank, classId, config)) {
    return "available";
  }
  const targetPath = getClassPath(classId, config);
  const isFutureOnCurrentBranch = path.every((nodeId, index) => targetPath[index] === nodeId);
  if (isFutureOnCurrentBranch) {
    return "locked";
  }
  return "unreachable";
}

export function sanitizeClassId(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .trim()
    .slice(0, 32);
}
