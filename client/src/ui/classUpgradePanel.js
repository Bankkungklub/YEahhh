import { TANK_CLASS_CONFIG } from "../../../shared/config/tankClassConfig.js";
import { getChoiceShortcut, getClassUpgradeViewModel } from "../../../shared/sim/classUpgradeViewModel.js";
import { getLocalTank } from "../game/clientState.js";
import { createTankClassIcon } from "../render/tankClassIcons.js";
import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";

const CLASS_UPGRADE_UI_CONFIG = HUD_LAYOUT_CONFIG.classUpgradeUi;

export function createClassUpgradePanel({ state, onSelectClass, config: uiConfig = CLASS_UPGRADE_UI_CONFIG }) {
  const root = document.createElement("section");
  root.className = "class-upgrade-panel hidden";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "Tank class upgrades");
  let pendingClassId = null;
  let pendingUntilMs = 0;
  let collapsedTierKey = null;
  let cacheSignature = "";
  let lastModel = getClassUpgradeViewModel({ screen: "menu" });
  let lastTierKey = "";

  function update(now = performance.now(), options = {}) {
    const localTank = getLocalTank(state);
    if (pendingClassId && (localTank?.classId === pendingClassId || now > pendingUntilMs)) {
      pendingClassId = null;
    }

    const config = state.publicConfig?.tankClasses ?? TANK_CLASS_CONFIG;
    const model = getClassUpgradeViewModel({
      localTank,
      screen: state.screen,
      pendingClassId,
      config
    });
    const tierKey = getClassUpgradeTierKey(model);
    if (tierKey !== lastTierKey) {
      lastTierKey = tierKey;
      collapsedTierKey = null;
    }
    const suspended = Boolean(options.suspended);
    const compact = Boolean(model.visible && collapsedTierKey === tierKey);
    const visible = Boolean(model.visible && !suspended);
    lastModel = model;
    state.classUpgradeUi = {
      visible,
      status: !visible ? (suspended && model.visible ? "suspended" : "hidden") : compact ? "collapsed" : "visible",
      choices: model.choices.map((choice) => choice.id),
      tierLevel: model.tierLevel,
      currentClassId: model.currentClassId,
      classPath: model.classPath,
      pendingClassId: model.pendingClassId,
      collapsedTierKey: compact ? collapsedTierKey : null,
      suspendedByModal: suspended
    };

    const signature = `${model.signature}|${visible}|${compact}|${suspended}|${collapsedTierKey ?? ""}`;
    if (cacheSignature === signature) {
      return;
    }
    cacheSignature = signature;
    root.classList.toggle("hidden", !visible);
    root.classList.toggle("compact", compact);
    root.replaceChildren();
    if (!visible) {
      return state.classUpgradeUi;
    }
    if (compact) {
      root.append(createCollapsedPill({ model, expand: expandCurrentTier }));
      return state.classUpgradeUi;
    }
    if (!model.visible) {
      return;
    }

    const header = document.createElement("div");
    header.className = "class-upgrade-header";
    const title = document.createElement("strong");
    title.textContent = `LEVEL ${model.tierLevel} UPGRADE`;
    const hint = document.createElement("span");
    hint.textContent = "Choose a tank form";
    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "class-upgrade-collapse";
    collapseButton.textContent = "HIDE";
    collapseButton.setAttribute("aria-label", "Hide class upgrade choices");
    collapseButton.addEventListener("click", collapseCurrentTier);
    header.append(title, hint, collapseButton);

    const cards = document.createElement("div");
    cards.className = "class-upgrade-cards";
    for (const choice of model.choices) {
      cards.append(createChoiceCard({ choice, config, selectClass }));
    }

    root.append(header, cards);
    return state.classUpgradeUi;
  }

  function selectClass(classId) {
    if (pendingClassId || !lastModel.choices.some((choice) => choice.id === classId)) {
      return false;
    }
    pendingClassId = classId;
    pendingUntilMs = performance.now() + uiConfig.pendingTimeoutMs;
    onSelectClass?.(classId);
    update();
    return true;
  }

  function handleKeyDown(event) {
    if (!isClassUpgradeInputAllowed(event) || !lastModel.visible || pendingClassId) {
      return false;
    }
    if (event.code === uiConfig.dismissHotkey || event.key === "Escape") {
      if (collapsedTierKey !== getClassUpgradeTierKey(lastModel)) {
        event.preventDefault();
        collapseCurrentTier();
        return true;
      }
      return false;
    }
    const index = lastModel.choices.findIndex((choice) => choice.shortcut === event.key);
    if (index < 0) {
      return false;
    }
    event.preventDefault();
    return selectClass(lastModel.choices[index].id);
  }

  function collapseCurrentTier() {
    collapsedTierKey = getClassUpgradeTierKey(lastModel);
    cacheSignature = "";
    update();
  }

  function expandCurrentTier() {
    collapsedTierKey = null;
    cacheSignature = "";
    update();
  }

  return {
    element: root,
    update,
    handleKeyDown,
    collapseCurrentTier,
    expandCurrentTier
  };
}

export function isClassUpgradeInputAllowed(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  const target = event.target;
  const tag = target?.tagName?.toLowerCase?.() ?? "";
  return !(tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable);
}

function createChoiceCard({ choice, config, selectClass }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "class-upgrade-card";
  button.dataset.classId = choice.id;
  button.style.setProperty("--class-color", choice.themeColor);
  button.disabled = choice.pending;
  button.setAttribute("aria-label", `Upgrade to ${choice.name}`);

  const shortcut = document.createElement("span");
  shortcut.className = "class-upgrade-shortcut";
  shortcut.textContent = getChoiceShortcut(Number(choice.shortcut) - 1) || choice.shortcut;

  const name = document.createElement("strong");
  name.textContent = choice.pending ? `${choice.name}...` : choice.name;

  const role = document.createElement("span");
  role.className = "class-upgrade-role";
  role.textContent = choice.identity?.roleLabel ?? "Tank Form";

  const weapon = document.createElement("span");
  weapon.className = "class-upgrade-weapon";
  weapon.textContent = choice.identity?.weaponLine ?? choice.description;

  const weakness = document.createElement("span");
  weakness.className = "class-upgrade-weakness";
  weakness.textContent = choice.identity?.weaknessLine ?? "";

  const desc = document.createElement("small");
  desc.textContent = choice.identity?.strengthLine ?? choice.description;

  const facts = document.createElement("span");
  facts.className = "class-upgrade-facts";
  for (const chip of choice.weaponFacts?.facts?.slice(0, 3) ?? []) {
    const fact = document.createElement("span");
    fact.className = "class-upgrade-fact";
    fact.textContent = chip;
    facts.append(fact);
  }

  button.append(
    shortcut,
    createTankClassIcon(choice.id, choice.pending ? "selecting" : "available", config),
    name,
    role,
    weapon,
    desc,
    facts,
    weakness
  );
  button.addEventListener("click", () => selectClass(choice.id));
  return button;
}

function createCollapsedPill({ model, expand }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "class-upgrade-pill";
  button.textContent = `CLASS +${model.choices.length}`;
  button.title = `Show level ${model.tierLevel} class upgrades`;
  button.addEventListener("click", expand);
  return button;
}

export function getClassUpgradeTierKey(model) {
  if (!model?.visible || !model.choices?.length) {
    return "none";
  }
  return [
    model.currentClassId ?? "basic",
    model.tierLevel ?? "none",
    model.choices.map((choice) => choice.id).join(",")
  ].join("|");
}
