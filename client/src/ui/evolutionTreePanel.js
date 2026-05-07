import { TANK_CLASS_CONFIG } from "../../../shared/config/tankClassConfig.js";
import { getClassesByLevelInBranchOrder } from "../../../shared/sim/classUpgradeViewModel.js";
import { getClassChoiceIdentityViewModel } from "../../../shared/sim/tankClassIdentity.js";
import { getTankWeaponFactChips } from "../../../shared/sim/tankWeaponFacts.js";
import { getClassNodeStatus } from "../../../shared/sim/tankClasses.js";
import { getLocalTank } from "../game/clientState.js";
import { createTankClassIcon } from "../render/tankClassIcons.js";

export function createEvolutionTreePanel({ state, onSelectClass }) {
  const root = document.createElement("div");
  root.className = "evolution-tree-panel";
  let renderSignature = "";

  function render() {
    const localTank = getLocalTank(state);
    const config = state.publicConfig?.tankClasses ?? TANK_CLASS_CONFIG;
    const currentClass = config.classes[localTank?.classId ?? config.defaultClassId];
    const signature = [
      localTank?.state ?? "none",
      localTank?.level ?? 0,
      localTank?.classId ?? "none",
      (localTank?.classUnlockChoices ?? []).join(","),
      Object.keys(config.classes).length
    ].join("|");
    if (renderSignature === signature) {
      return;
    }
    renderSignature = signature;
    root.replaceChildren();

    const summary = document.createElement("div");
    summary.className = "evolution-summary";
    const choiceLevels = config.levels.filter((level) => level > (config.classes[config.defaultClassId]?.unlockLevel ?? 1));
    summary.innerHTML = `
      <strong>${currentClass?.name ?? "Basic"}</strong>
      <span>Level ${localTank?.level ?? 1} / next class choices at levels ${choiceLevels.join(", ")}</span>
    `;
    root.append(summary);

    const scroller = document.createElement("div");
    scroller.className = "evolution-tree-scroller";
    const tree = document.createElement("div");
    tree.className = "evolution-tree-grid";
    const classesByLevel = getClassesByLevelInBranchOrder(config);

    for (const level of config.levels) {
      const column = document.createElement("section");
      column.className = "evolution-column";
      const heading = document.createElement("h3");
      heading.textContent = `LEVEL ${level}`;
      column.append(heading);

      const classesAtLevel = classesByLevel.get(level) ?? [];
      for (const tankClass of classesAtLevel) {
        column.append(createNode({ tankClass, localTank, config, onSelectClass, rerender: render }));
      }
      tree.append(column);
    }

    scroller.append(tree);
    root.append(scroller);
  }

  render();
  root.update = render;
  return root;
}

export function getEvolutionNodeStatus(localTank, classId, config = TANK_CLASS_CONFIG) {
  return getClassNodeStatus({ localTank, classId, config });
}

function createNode({ tankClass, localTank, config, onSelectClass, rerender }) {
  const status = getEvolutionNodeStatus(localTank, tankClass.id, config);
  const identity = getClassChoiceIdentityViewModel(tankClass.id);
  const isAvailable = status === "available";
  const node = document.createElement(isAvailable ? "button" : "div");
  node.className = `evolution-node ${status} ${tankClass.parentId ? "child" : "root"}`;
  node.dataset.classId = tankClass.id;
  node.dataset.parentId = tankClass.parentId ?? "";
  node.style.setProperty("--class-color", tankClass.themeColor);

  const meta = document.createElement("span");
  meta.className = "evolution-node-meta";
  meta.textContent = getNodeMetaText({ tankClass, status });

  const name = document.createElement("strong");
  name.textContent = tankClass.name;

  const desc = document.createElement("small");
  desc.textContent = identity.weaponLine ?? tankClass.description;
  const factTitle = getTankWeaponFactChips(tankClass.id, { tankClassConfig: config })
    .slice(0, 2)
    .join(", ");
  node.title = `${tankClass.name}: ${identity.roleLabel ?? "Tank"} - ${identity.weaponLine ?? tankClass.description}${factTitle ? ` (${factTitle})` : ""}`;

  node.append(createTankClassIcon(tankClass.id, status, config), name, meta, desc);

  if (tankClass.parentId) {
    const parent = config.classes[tankClass.parentId];
    const parentLabel = document.createElement("span");
    parentLabel.className = "evolution-parent-label";
    parentLabel.textContent = parent ? `from ${parent.name}` : "from ?";
    node.append(parentLabel);
  }

  if (isAvailable) {
    node.type = "button";
    node.addEventListener("click", () => {
      onSelectClass?.(tankClass.id);
      node.disabled = true;
      node.classList.add("selecting");
      window.setTimeout(rerender, 180);
    });
  }

  return node;
}

function getNodeMetaText({ tankClass, status }) {
  if (status === "selected") {
    return "CURRENT";
  }
  if (status === "available") {
    return "CHOOSE";
  }
  if (status === "path") {
    return "PATH";
  }
  if (!tankClass.active) {
    return `LV ${tankClass.unlockLevel} PREVIEW`;
  }
  if (status === "locked") {
    return `LOCKED LV${tankClass.unlockLevel}`;
  }
  if (status === "unreachable") {
    return "WRONG BRANCH";
  }
  return `LV ${tankClass.unlockLevel}`;
}
