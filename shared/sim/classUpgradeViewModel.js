import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getClassChoiceIdentityViewModel } from "./tankClassIdentity.js";
import { getAvailableClassChoices, getClassPath } from "./tankClasses.js";
import { getTankWeaponFacts } from "./tankWeaponFacts.js";

export const CLASS_UPGRADE_SHORTCUTS = Object.freeze(["1", "2", "3", "4"]);

export function getClassUpgradeViewModel({
  localTank,
  screen = "playing",
  pendingClassId = null,
  config = TANK_CLASS_CONFIG
} = {}) {
  if (screen !== "playing" || !localTank || localTank.state === "dead") {
    return createHiddenModel(config, localTank, pendingClassId);
  }

  const choices = getUpgradeChoiceIds(localTank, config)
    .slice(0, CLASS_UPGRADE_SHORTCUTS.length)
    .map((classId, index) => {
      const tankClass = config.classes[classId];
      return {
        id: classId,
        name: tankClass.name,
        description: tankClass.description,
        identity: getClassChoiceIdentityViewModel(classId),
        weaponFacts: getTankWeaponFacts(classId, { tankClassConfig: config }),
        unlockLevel: tankClass.unlockLevel,
        themeColor: tankClass.themeColor,
        shortcut: CLASS_UPGRADE_SHORTCUTS[index],
        pending: pendingClassId === classId
      };
    });

  const tierLevel = choices[0]?.unlockLevel ?? null;
  return {
    visible: choices.length > 0,
    choices,
    tierLevel,
    currentClassId: localTank.classId ?? config.defaultClassId,
    currentClassName: config.classes[localTank.classId]?.name ?? config.classes[config.defaultClassId].name,
    classPath: getClassPath(localTank.classId ?? config.defaultClassId, config),
    pendingClassId: choices.some((choice) => choice.pending) ? pendingClassId : null,
    signature: buildUpgradeSignature(localTank, choices, pendingClassId, tierLevel)
  };
}

export function getUpgradeChoiceIds(localTank, config = TANK_CLASS_CONFIG) {
  if (!localTank) {
    return [];
  }
  const snapshotChoices = Array.isArray(localTank.classUnlockChoices)
    ? localTank.classUnlockChoices
    : [];
  if (snapshotChoices.length > 0) {
    return snapshotChoices.filter((classId) => config.classes[classId]?.active);
  }
  return getAvailableClassChoices(localTank, config);
}

export function getBranchOrderedClasses(config = TANK_CLASS_CONFIG) {
  const ordered = [];
  const visited = new Set();

  function visit(classId) {
    const tankClass = config.classes[classId];
    if (!tankClass || visited.has(classId)) {
      return;
    }
    visited.add(classId);
    ordered.push(tankClass);
    for (const childId of tankClass.children ?? []) {
      visit(childId);
    }
  }

  visit(config.defaultClassId);
  for (const tankClass of Object.values(config.classes)) {
    visit(tankClass.id);
  }
  return ordered;
}

export function getClassesByLevelInBranchOrder(config = TANK_CLASS_CONFIG) {
  const result = new Map(config.levels.map((level) => [level, []]));
  for (const tankClass of getBranchOrderedClasses(config)) {
    if (!result.has(tankClass.unlockLevel)) {
      result.set(tankClass.unlockLevel, []);
    }
    result.get(tankClass.unlockLevel).push(tankClass);
  }
  return result;
}

export function getNextClassTier(localTank, config = TANK_CLASS_CONFIG) {
  const choices = getUpgradeChoiceIds(localTank, config);
  if (choices.length > 0) {
    return config.classes[choices[0]]?.unlockLevel ?? null;
  }
  const current = config.classes[localTank?.classId ?? config.defaultClassId];
  const childLevels = (current?.children ?? [])
    .map((classId) => config.classes[classId]?.unlockLevel)
    .filter((level) => Number.isFinite(level));
  return childLevels.length > 0 ? Math.min(...childLevels) : null;
}

export function getChoiceShortcut(index) {
  return CLASS_UPGRADE_SHORTCUTS[index] ?? "";
}

function createHiddenModel(config, localTank, pendingClassId) {
  return {
    visible: false,
    choices: [],
    tierLevel: null,
    currentClassId: localTank?.classId ?? config.defaultClassId,
    currentClassName: config.classes[localTank?.classId]?.name ?? config.classes[config.defaultClassId].name,
    classPath: getClassPath(localTank?.classId ?? config.defaultClassId, config),
    pendingClassId: null,
    signature: `hidden|${localTank?.classId ?? "none"}|${localTank?.level ?? 0}|${pendingClassId ?? ""}`
  };
}

function buildUpgradeSignature(localTank, choices, pendingClassId, tierLevel) {
  return [
    localTank?.state ?? "none",
    localTank?.level ?? 0,
    localTank?.classId ?? "none",
    tierLevel ?? "none",
    choices.map((choice) => `${choice.id}:${choice.pending ? "p" : "r"}`).join(","),
    pendingClassId ?? ""
  ].join("|");
}
