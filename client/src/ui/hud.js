import { UPGRADE_KEYS } from "../../../shared/config/gameConfig.js";
import { getUpgradePreviewViewModel } from "../../../shared/sim/upgradePreview.js";
import { apiClient } from "../api/apiClient.js";
import { getLocalTank } from "../game/clientState.js";
import { getPredictionDebugState } from "../game/localPrediction.js";
import { getClassBalanceSummary } from "../../../shared/sim/tankClassBalance.js";
import { getClassPhysicsSummary } from "../../../shared/sim/classPhysicsAudit.js";
import { formatDamageCause } from "../../../shared/sim/damageSources.js";
import {
  dismissOnboarding,
  getOnboardingPrompt,
  loadOnboardingState,
  markOnboardingTreeOpened,
  persistOnboardingState
} from "../game/onboarding.js";
import { MENU_CONFIG } from "./menuConfig.js";
import { updateAccountHud } from "./accountHud.js";
import { createAuthPanel } from "./authPanel.js";
import { createClassUpgradePanel } from "./classUpgradePanel.js";
import { createEvolutionTreePanel } from "./evolutionTreePanel.js";
import { getHudActionPriority } from "./hudActionPriority.js";
import { applyHudLayoutVariables, computeHudSafeZones } from "./hudLayout.js";
import { createModalManager } from "./modalManager.js";
import { getHudVisibility } from "./hudVisibility.js";
import {
  createMenuViewModel,
  readStorageValue,
  sanitizeMenuName,
  writeStorageValue
} from "./menuViewModel.js";
import { createRoomsPanel } from "./roomsPanel.js";
import { createSettingsPanel } from "./settingsPanel.js";
import {
  createUpgradePanelState,
  getUpgradePanelViewModel,
  markUpgradePointsChanged,
  shouldHandleUpgradePanelHotkey,
  toggleUpgradePanelState
} from "./upgradePanelState.js";
import { createShopPanel } from "./shopPanel.js";

export function createHud({ state, audio, input, onJoin, onUpgrade, onSelectClass, onRespawn }) {
  const menu = document.querySelector("#menu");
  const hud = document.querySelector("#hud");
  const deathScreen = document.querySelector("#deathScreen");
  const joinForm = document.querySelector("#joinForm");
  const loginMenuButton = document.querySelector("#loginMenuButton");
  const shopMenuButton = document.querySelector("#shopMenuButton");
  const customGamesButton = document.querySelector("#customGamesButton");
  const settingsMenuButton = document.querySelector("#settingsMenuButton");
  const regionButton = document.querySelector("#regionButton");
  const menuEyebrow = document.querySelector("#menuEyebrow");
  const menuTitle = document.querySelector("#menuTitle");
  const menuTagline = document.querySelector("#menuTagline");
  const menuGoal = document.querySelector("#menuGoal");
  const playerNameLabel = document.querySelector("#playerNameLabel");
  const playerName = document.querySelector("#playerName");
  const joinButton = document.querySelector("#joinButton");
  const menuStatus = document.querySelector("#menuStatus");
  const menuStatusWrap = document.querySelector("#menuStatusWrap");
  const menuControlsTitle = document.querySelector("#menuControlsTitle");
  const menuControlChips = document.querySelector("#menuControlChips");
  const menuMobileChips = document.querySelector("#menuMobileChips");
  const healthText = document.querySelector("#healthText");
  const levelText = document.querySelector("#levelText");
  const healthFill = document.querySelector("#healthFill");
  const xpFill = document.querySelector("#xpFill");
  const upgradePanel = document.querySelector("#upgradePanel");
  const treeButton = document.querySelector("#treeButton");
  const leaderboardList = document.querySelector("#leaderboardList");
  const debugOverlay = document.querySelector("#debugOverlay");
  const bars = document.querySelector(".bars");
  const deathText = document.querySelector("#deathText");
  const respawnButton = document.querySelector("#respawnButton");
  const levelToast = document.createElement("div");
  const objectivePill = document.createElement("div");
  const actionPriorityPill = document.createElement("div");
  const touchControlsOverlay = document.createElement("div");
  const touchMoveStick = document.createElement("div");
  const touchMoveKnob = document.createElement("span");
  const touchAimStick = document.createElement("div");
  const touchAimKnob = document.createElement("span");
  const touchFireLockButton = document.createElement("button");
  const upgradeToggleButton = document.createElement("button");
  const developerPanel = document.createElement("div");
  const developerLevelInput = document.createElement("input");
  const developerStatus = document.createElement("span");
  const onboardingPrompt = document.createElement("div");
  const onboardingText = document.createElement("span");
  const onboardingDismiss = document.createElement("button");
  const modal = createModalManager();
  const classUpgradePanel = createClassUpgradePanel({ state, onSelectClass });
  let activeEvolutionTree = null;
  levelToast.className = "level-toast hidden";
  objectivePill.className = "objective-pill hidden";
  actionPriorityPill.className = "action-priority-pill hidden";
  buildTouchControlsOverlay();
  upgradeToggleButton.type = "button";
  upgradeToggleButton.className = "upgrade-toggle";
  developerPanel.className = "developer-panel hidden";
  developerLevelInput.type = "number";
  developerLevelInput.min = "1";
  developerLevelInput.max = "60";
  developerLevelInput.step = "1";
  developerLevelInput.value = "15";
  developerLevelInput.setAttribute("aria-label", "Developer level");
  developerStatus.className = "developer-status";
  developerStatus.textContent = "Admin only";
  buildDeveloperPanel();
  onboardingPrompt.className = "onboarding-prompt hidden";
  onboardingDismiss.className = "onboarding-dismiss";
  onboardingDismiss.type = "button";
  onboardingDismiss.textContent = "Skip";
  onboardingPrompt.append(onboardingText, onboardingDismiss);
  hud.append(levelToast);
  hud.append(objectivePill);
  hud.append(actionPriorityPill);
  hud.append(touchControlsOverlay);
  hud.append(classUpgradePanel.element);
  hud.append(developerPanel);
  hud.append(onboardingPrompt);
  const uiCache = {
    screen: "",
    menu: "",
    bars: "",
    account: "",
    upgrades: "",
    leaderboard: "",
    treeButton: "",
    objective: "",
    action: "",
    developer: "",
    death: "",
    onboarding: "",
    feedback: "",
    touchControls: "",
    visibility: "",
    layout: "",
    debugVisible: null,
    debugAt: 0
  };

  state.onboarding = loadOnboardingState();
  state.upgradePanelUi = createUpgradePanelState(localStorage);
  setupMenuContent();
  refreshAccountState();
  playerName.value = readStorageValue(localStorage, "tankArena.name", "");
  buildUpgradeButtons(upgradePanel, onUpgrade);
  upgradePanel.prepend(upgradeToggleButton);

  joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    audio?.unlock();
    const name = sanitizeMenuName(playerName.value);
    playerName.value = name;
    writeStorageValue(localStorage, "tankArena.name", name);
    await quickJoin(name);
  });

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("button")) {
      audio?.playUiClick();
    }
  }, true);

  loginMenuButton?.addEventListener("click", () => {
    modal.open("Account", createAuthPanel({
      state,
      close: modal.close,
      onAccountChanged: (account) => {
        state.account = account;
        updateAccountHud(loginMenuButton, account);
      }
    }));
  });

  shopMenuButton?.addEventListener("click", () => {
    modal.open("Shop", createShopPanel({
      state,
      onAccountChanged: (account) => {
        state.account = account;
        updateAccountHud(loginMenuButton, account);
      }
    }));
  });

  customGamesButton?.addEventListener("click", () => {
    openRoomsModal();
  });

  regionButton?.addEventListener("click", () => {
    openRoomsModal();
  });

  settingsMenuButton?.addEventListener("click", () => {
    modal.open("Menu", createSettingsPanel({ state, audio }));
  });

  respawnButton.addEventListener("click", () => {
    onRespawn();
  });

  upgradeToggleButton.addEventListener("click", () => {
    if (!state.hudVisibility?.showStatUpgrades) {
      return;
    }
    state.upgradePanelUi = toggleUpgradePanelState(state.upgradePanelUi, localStorage);
    uiCache.upgrades = "";
  });

  treeButton?.addEventListener("click", () => {
    if (!state.hudVisibility?.showTreeButton) {
      return;
    }
    openEvolutionTree();
  });

  touchFireLockButton.addEventListener("click", () => {
    input?.toggleTouchControlsFireLock?.(performance.now());
    uiCache.touchControls = "";
  });

  onboardingDismiss.addEventListener("click", () => {
    dismissOnboarding(state.onboarding);
  });

  window.addEventListener("keydown", (event) => {
    if (!modal.isOpen?.() && classUpgradePanel.handleKeyDown(event)) {
      return;
    }
    if (event.code === "F3") {
      event.preventDefault();
      state.debugVisible = !state.debugVisible;
    }
    if (event.code === "KeyT" && state.hudVisibility?.showTreeButton) {
      event.preventDefault();
      openEvolutionTree();
    }
    if (shouldHandleUpgradePanelHotkey(event) && state.hudVisibility?.showStatUpgrades) {
      event.preventDefault();
      state.upgradePanelUi = toggleUpgradePanelState(state.upgradePanelUi, localStorage);
      uiCache.upgrades = "";
    }
    if (event.code === "Escape" && !state.onboarding.completed) {
      dismissOnboarding(state.onboarding);
    }
  });

  function update(now = performance.now()) {
    const menuView = createMenuViewModel(state);
    const localTank = getLocalTank(state);
    const visibility = getHudVisibility({ state, localTank, modalOpen: modal.isOpen?.() });
    const classCardChoices = localTank?.classUnlockChoices?.length ?? 0;
    const layout = computeHudSafeZones({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      upgradeCollapsed: state.upgradePanelUi?.collapsed ?? false,
      classCardsVisible: visibility.showClassCards && classCardChoices > 0
    });
    state.hudVisibility = visibility;
    state.hudLayout = layout;
    updateScreenVisibility(menuView, visibility);
    updateHudLayout(layout);
    updateMenuState(menuView);
    updateBars(localTank);
    updateAccount();
    updateUpgrades(localTank, now, visibility);
    updateTreeButton(localTank, visibility);
    classUpgradePanel.update(now, { suspended: !visibility.showClassCards });
    updateHudPanelClasses(visibility);
    updateEvolutionTreeModal();
    updateObjectiveHud();
    updateDeveloperPanel(localTank, visibility);
    updateLeaderboard();
    updateDeath();
    updateOnboarding(now);
    updateActionPriority(localTank, now, visibility);
    updateTouchControls(localTank, now, visibility);
    updateFeedbackUi(now);
    updateDebug(localTank, now);
  }

  function updateScreenVisibility(menuView, visibility) {
    const signature = `${menuView.visible}|${state.screen}|${visibility.showDeathOverlay}`;
    if (uiCache.screen === signature) {
      return;
    }
    uiCache.screen = signature;
    menu.classList.toggle("hidden", !menuView.visible);
    hud.classList.toggle("hidden", state.screen === "menu" || state.screen === "connecting");
    deathScreen.classList.toggle("hidden", !visibility.showDeathOverlay);
  }

  function updateHudLayout(layout) {
    const signature = JSON.stringify(layout.cssVars);
    if (uiCache.layout === signature) {
      return;
    }
    uiCache.layout = signature;
    applyHudLayoutVariables(hud, layout);
  }

  function updateHudPanelClasses(visibility) {
    const classCardStatus = state.classUpgradeUi?.status ?? "hidden";
    const signature = [
      visibility.showDeathOverlay,
      visibility.modalOpen,
      visibility.showStatUpgrades,
      visibility.showTreeButton,
      visibility.showDeveloperPanel,
      classCardStatus
    ].join("|");
    if (uiCache.visibility === signature) {
      return;
    }
    uiCache.visibility = signature;
    hud.classList.toggle("gameplay-dead", visibility.showDeathOverlay);
    hud.classList.toggle("modal-open", visibility.modalOpen);
    hud.classList.toggle("class-cards-visible", classCardStatus === "visible");
    hud.classList.toggle("class-cards-collapsed", classCardStatus === "collapsed");
  }

  function updateMenuState(menuView) {
    const signature = [
      menuView.buttonDisabled,
      menuView.buttonLabel,
      menuView.statusText,
      menuView.statusTone
    ].join("|");
    if (uiCache.menu === signature) {
      return;
    }
    uiCache.menu = signature;
    joinButton.disabled = menuView.buttonDisabled;
    joinButton.textContent = menuView.buttonLabel;
    menuStatus.textContent = menuView.statusText;
    menuStatusWrap.classList.toggle("ready", menuView.statusTone === "ready");
    menuStatusWrap.classList.toggle("pending", menuView.statusTone === "pending");
    menuStatusWrap.classList.toggle("error", menuView.statusTone === "error");
  }

  function updateBars(localTank) {
    if (!localTank) {
      if (uiCache.bars === "none") {
        return;
      }
      uiCache.bars = "none";
      healthText.textContent = "HP 0 / 0";
      levelText.textContent = "Level 1";
      healthFill.style.width = "0%";
      xpFill.style.width = "0%";
      return;
    }

    const hpRatio = Math.max(0, Math.min(1, localTank.hp / localTank.maxHp));
    const xpRatio = Math.max(0, Math.min(1, localTank.xp / localTank.xpNext));
    const coins = localTank.matchCoinsEarned ? ` | Coins +${localTank.matchCoinsEarned}` : "";
    const droneStatus = formatDroneStatus(localTank.droneStatus);
    const signature = [
      localTank.hp,
      localTank.maxHp,
      localTank.xp,
      localTank.xpNext,
      localTank.level,
      localTank.upgradePoints,
      localTank.matchCoinsEarned ?? 0,
      localTank.accountCoins ?? "guest",
      droneStatus
    ].join("|");
    if (state.account && Number.isFinite(localTank.accountCoins)) {
      state.account = { ...state.account, coins: localTank.accountCoins };
    }
    if (uiCache.bars === signature) {
      return;
    }
    uiCache.bars = signature;
    healthText.textContent = `HP ${localTank.hp} / ${localTank.maxHp}`;
    levelText.textContent = `Level ${localTank.level} | Points ${localTank.upgradePoints}${coins}${droneStatus ? ` | ${droneStatus}` : ""}`;
    healthFill.style.width = `${hpRatio * 100}%`;
    xpFill.style.width = `${xpRatio * 100}%`;
  }

  function updateAccount() {
    const signature = state.account
      ? `${state.account.username}|${state.account.coins}`
      : "guest";
    if (uiCache.account === signature) {
      return;
    }
    uiCache.account = signature;
    updateAccountHud(loginMenuButton, state.account);
  }

  function updateUpgrades(localTank, now, visibility) {
    const labels = state.publicConfig?.upgrades?.labels ?? {};
    const points = Math.max(0, Math.trunc(Number(localTank?.upgradePoints) || 0));
    const upgradePreviews = getUpgradePreviewViewModel({ localTank, labels });
    const previewByKey = new Map(upgradePreviews.map((preview) => [preview.key, preview]));
    state.upgradePanelUi = markUpgradePointsChanged(state.upgradePanelUi, points, now);
    const viewModel = getUpgradePanelViewModel({
      panelState: state.upgradePanelUi,
      localTank,
      nowMs: now,
      visible: visibility.showStatUpgrades
    });
    const signature = [
      viewModel.status,
      viewModel.label,
      viewModel.pulse,
      localTank?.state ?? "none",
      localTank?.classId ?? "none",
      points,
      state.publicConfig?.upgrades?.maxLevel ?? 7,
      JSON.stringify(localTank?.upgrades ?? {}),
      upgradePreviews.map((preview) => `${preview.key}:${preview.summary}:${preview.detail}`).join(","),
      state.upgradePanelUi?.collapsed ?? false
    ].join("|");
    if (uiCache.upgrades === signature) {
      return;
    }
    uiCache.upgrades = signature;
    upgradePanel.classList.toggle("hidden", !viewModel.visible);
    upgradePanel.classList.toggle("collapsed", viewModel.collapsed);
    upgradePanel.classList.toggle("has-points", viewModel.canUpgrade);
    upgradePanel.classList.toggle("collapsed-pulse", viewModel.pulse);
    upgradeToggleButton.textContent = viewModel.label;
    upgradeToggleButton.title = viewModel.collapsed ? "Show stat upgrades (U)" : "Hide stat upgrades (U)";

    for (const button of upgradePanel.querySelectorAll(".upgrade-button")) {
      const key = button.dataset.key;
      const current = localTank?.upgrades?.[key] ?? 0;
      const max = state.publicConfig?.upgrades?.maxLevel ?? 7;
      const available = Boolean(localTank && localTank.upgradePoints > 0 && current < max && localTank.state === "alive");
      const preview = previewByKey.get(key);
      button.disabled = !available;
      button.classList.toggle("available", available);
      button.classList.toggle("no-direct-effect", Boolean(preview && preview.applies === false && !preview.maxed));
      button.querySelector("[data-upgrade-label]").textContent = preview?.label ?? labels[key] ?? key;
      button.querySelector("[data-upgrade-level]").textContent = preview?.maxed ? "MAX" : `${current}/${max}`;
      button.querySelector("[data-upgrade-preview]").textContent = preview?.summary ?? "";
      button.title = preview?.detail ?? `${labels[key] ?? key} ${current}/${max}`;
    }
  }

  function updateLeaderboard() {
    const leaderboard = state.latestSnapshot?.leaderboard ?? [];
    const signature = leaderboard
      .map((entry) => `${entry.id}:${entry.name}:${entry.score}:${entry.level}`)
      .join("|");
    if (uiCache.leaderboard === signature) {
      return;
    }
    uiCache.leaderboard = signature;
    leaderboardList.replaceChildren();

    for (const entry of leaderboard) {
      const item = document.createElement("li");
      item.className = entry.id === state.playerId ? "you" : "";
      item.textContent = `${entry.name} ${entry.score} L${entry.level}`;
      leaderboardList.append(item);
    }
  }

  function updateTreeButton(localTank, visibility) {
    if (!treeButton) {
      return;
    }
    const choices = localTank?.classUnlockChoices ?? [];
    const signature = [
      state.screen,
      visibility.showTreeButton,
      localTank?.classId ?? "none",
      localTank?.level ?? 0,
      choices.join(",")
    ].join("|");
    if (uiCache.treeButton === signature) {
      return;
    }
    uiCache.treeButton = signature;
    treeButton.classList.toggle("hidden", !visibility.showTreeButton);
    treeButton.disabled = !visibility.showTreeButton || !localTank;
    treeButton.classList.toggle("available", choices.length > 0);
    treeButton.textContent = choices.length > 0 ? `TREE +${choices.length}` : "TREE";
    treeButton.title = localTank
      ? `Current class: ${localTank.className ?? localTank.classId ?? "Basic"}`
      : "Join the arena first";
  }

  function updateObjectiveHud() {
    const objective = state.latestSnapshot?.centerObjective;
    const visible = state.screen === "playing" && objective?.enabled;
    const signature = visible
      ? [
          objective.state,
          objective.hp,
          objective.maxHp,
          objective.xp,
          objective.respawnInMs,
          objective.lastKillerName
        ].join("|")
      : "hidden";
    if (uiCache.objective === signature) {
      return;
    }
    uiCache.objective = signature;
    objectivePill.classList.toggle("hidden", !visible);
    objectivePill.classList.toggle("down", objective?.state === "down");
    if (!visible) {
      objectivePill.textContent = "";
      return;
    }
    if (objective.state === "alive") {
      const percent = Math.max(0, Math.round((objective.hp / Math.max(1, objective.maxHp)) * 100));
      objectivePill.textContent = `ALPHA PENTAGON ${percent}% | +${objective.xp} XP`;
      return;
    }
    const seconds = Math.max(0, Math.ceil((objective.respawnInMs ?? 0) / 1000));
    objectivePill.textContent = seconds > 0
      ? `ALPHA RESPAWNS ${seconds}s`
      : "ALPHA RESPAWNING";
  }

  function updateDeveloperPanel(localTank, visibility) {
    const visible = Boolean(visibility.showDeveloperPanel);
    const signature = [
      visible,
      localTank?.level ?? 0,
      localTank?.classId ?? "none",
      localTank?.upgradePoints ?? 0
    ].join("|");
    if (uiCache.developer === signature) {
      return;
    }
    uiCache.developer = signature;
    developerPanel.classList.toggle("hidden", !visible);
    if (!visible) {
      return;
    }
    if (document.activeElement !== developerLevelInput) {
      developerLevelInput.value = String(localTank?.level ?? 15);
    }
    developerStatus.textContent = localTank
      ? `${localTank.className ?? localTank.classId ?? "Basic"} | ${localTank.upgradePoints} pts`
      : "Join first";
  }

  function updateDeath() {
    if (!state.death) {
      uiCache.death = "none";
      return;
    }
    const delay = Math.max(0, Math.ceil((state.death.respawnAtMs - (state.latestSnapshot?.timeMs ?? 0)) / 1000));
    const penalty = state.death.deathPenalty;
    const deathCauseLabel = state.death.deathCause
      ? formatDamageCause(state.death.deathCause)
      : state.death.killerName;
    const signature = `${deathCauseLabel}|${state.death.score}|${state.death.level}|${state.death.oldLevel}|${state.death.newLevel}|${state.death.oldClassId}|${state.death.newClassId}|${state.death.scoreLost}|${delay}`;
    if (uiCache.death === signature) {
      return;
    }
    uiCache.death = signature;
    deathText.textContent = penalty?.applied
      ? `Destroyed by ${deathCauseLabel}. Level ${state.death.oldLevel} -> ${state.death.newLevel}. Score -${state.death.scoreLost}. Re-spend upgrade points after respawn.`
      : `Destroyed by ${deathCauseLabel}. Score ${state.death.score}, level ${state.death.level}.`;
    respawnButton.disabled = delay > 0;
    respawnButton.textContent = delay > 0 ? `Respawn in ${delay}` : "Respawn";
  }

  function updateDebug(localTank, now) {
    if (uiCache.debugVisible !== state.debugVisible) {
      uiCache.debugVisible = state.debugVisible;
      debugOverlay.classList.toggle("hidden", !state.debugVisible);
    }
    if (!state.debugVisible) {
      return;
    }
    if (now - uiCache.debugAt < 200) {
      return;
    }
    uiCache.debugAt = now;
    const snapshot = state.latestSnapshot;
    const classBalance = localTank ? getClassBalanceSummary()[localTank.classId] : null;
    const classPhysics = localTank ? getClassPhysicsSummary()[localTank.classId] : null;
    debugOverlay.textContent = JSON.stringify({
      fps: state.fps,
      frameMs: state.renderMetrics.frameMs,
      renderMs: state.renderMetrics.renderMs,
      hudMs: state.renderMetrics.hudMs,
      renderQuality: state.renderMetrics.renderQuality,
      rttMs: state.rttMs,
      screen: state.screen,
      hud: {
        visibility: state.hudVisibility,
        layout: state.hudLayout?.cssVars ?? {},
        statUpgrades: state.upgradePanelUi?.collapsed ? "collapsed" : "expanded",
        classCards: state.classUpgradeUi?.status ?? "hidden",
        activeModal: modal.getTitle?.() || null,
        deathOverlay: state.hudVisibility?.showDeathOverlay ?? false
      },
      account: state.account ? { username: state.account.username, coins: state.account.coins } : "guest",
      room: state.room,
      roomStepMs: state.room?.stepMs ?? null,
      tick: snapshot?.tick ?? 0,
      snapshotAgeMs: state.renderMetrics.snapshotAgeMs,
      snapshotBuffer: state.renderMetrics.snapshotBufferSize,
      interpolation: state.renderMetrics.interpolationMode,
      prediction: getPredictionDebugState(state.prediction),
      visible: {
        shapes: state.renderMetrics.visibleShapes,
        projectiles: state.renderMetrics.visibleProjectiles,
        drones: state.renderMetrics.visibleDrones,
        tanks: state.renderMetrics.visibleTanks
      },
      counts: snapshot?.counts ?? {},
      botProfiles: snapshot?.debug?.botProfiles ?? state.room?.botProfiles ?? {},
      classCounts: snapshot?.debug?.classCounts ?? state.room?.classCounts ?? {},
      botClassCounts: snapshot?.debug?.botClassCounts ?? state.room?.botClassCounts ?? {},
      botBehavior: snapshot?.debug?.botBehavior ?? state.room?.botBehavior ?? {},
      botRivals: snapshot?.debug?.botRivals ?? { active: snapshot?.rivals?.length ?? 0 },
      classUpgrade: state.classUpgradeUi,
      classVisual: classBalance
        ? {
            classId: classBalance.classId,
            role: classBalance.role,
            body: String(classBalance.visualSignature).split("|")[0],
            barrelStyles: String(classBalance.visualSignature)
              .match(/b\((.*)\)$/)?.[1]
              ?.split(",")
              .map((entry) => entry.split(":").at(-1))
              .filter(Boolean) ?? [],
            visualSignature: classBalance.visualSignature,
            focusedDps: Math.round(classBalance.focusedDps * 10) / 10,
            totalDps: Math.round(classBalance.totalDps * 10) / 10,
            focusedDpsRatio: Math.round(classBalance.focusedDpsRatio * 100) / 100,
            totalDpsRatio: Math.round(classBalance.totalDpsRatio * 100) / 100
          }
        : null,
      classPhysics: classPhysics
        ? {
            classId: classPhysics.classId,
            recoilRole: classPhysics.dominantRole,
            expectedFireImpulse: {
              x: classPhysics.x,
              y: classPhysics.y,
              speed: classPhysics.speed
            },
            currentRecoil: {
              x: Math.round((localTank?.recoilX ?? 0) * 10) / 10,
              y: Math.round((localTank?.recoilY ?? 0) * 10) / 10,
              speed: Math.round(Math.hypot(localTank?.recoilX ?? 0, localTank?.recoilY ?? 0) * 10) / 10
            },
            lastFireImpulse: localTank?.lastFireImpulse ?? state.prediction?.lastFireImpulse ?? null
          }
        : null,
      upgradePanel: state.upgradePanelUi,
      combatFeel: snapshot?.debug?.performance
        ? {
            projectileKinds: snapshot.debug.performance.projectileKinds,
            contactPairs: snapshot.debug.performance.contactPairs,
            contactDamage: snapshot.debug.performance.contactDamage,
            explosionSparksCreated: snapshot.debug.performance.explosionSparksCreated
          }
        : null,
      centerObjective: snapshot?.debug?.centerObjective ?? snapshot?.centerObjective ?? state.room?.centerObjective ?? null,
      eventObjectives: snapshot?.debug?.eventObjectives ?? { active: snapshot?.eventObjectives ?? [] },
      drones: snapshot?.debug?.drones ?? { active: snapshot?.drones?.length ?? 0 },
      hudAction: state.hudAction,
      shapeCounts: snapshot?.debug?.shapeCounts ?? state.room?.shapeCounts ?? {},
      balanceVersion: snapshot?.debug?.balanceVersion ?? null,
      serverPerformance: snapshot?.debug?.performance ?? state.room?.performance ?? {},
      audio: state.audioDebug,
      touchControls: state.touchControlsDebug ?? null,
      effects: state.effects.length,
      onboarding: state.onboarding.milestones,
      you: localTank
        ? {
            id: localTank.id,
            hp: localTank.hp,
            level: localTank.level,
            classId: localTank.classId,
            droneStatus: localTank.droneStatus ?? null,
            classChoices: localTank.classUnlockChoices,
            classPath: state.classUpgradeUi?.classPath,
            score: localTank.score,
            upgrades: localTank.upgrades
          }
        : null
    }, null, 2);
  }

  function updateOnboarding(now) {
    if (state.onboarding.completed && !state.onboarding.dismissed) {
      persistOnboardingState(state.onboarding);
    }

    const classCardsVisible = state.classUpgradeUi?.status === "visible";
    const prompt = getOnboardingPrompt(state.onboarding, state.screen, now, {
      modalOpen: modal.isOpen?.(),
      classCardsVisible,
      death: state.death
    });
    const signature = prompt ? `${prompt.id}|${prompt.text}` : "hidden";
    state.onboardingPrompt = prompt ? { id: prompt.id, text: prompt.text } : null;
    if (uiCache.onboarding === signature) {
      return;
    }
    uiCache.onboarding = signature;
    onboardingPrompt.className = prompt
      ? `onboarding-prompt onboarding-${prompt.id}`
      : "onboarding-prompt hidden";
    onboardingPrompt.dataset.promptId = prompt?.id ?? "";
    if (!prompt) {
      onboardingText.textContent = "";
      return;
    }
    onboardingText.textContent = prompt.text;
  }

  function updateActionPriority(localTank, now, visibility) {
    const action = getHudActionPriority({
      state,
      localTank,
      visibility,
      now,
      onboardingPrompt: state.onboardingPrompt
    });
    state.hudAction = action;
    const signature = [
      action.id,
      action.label,
      action.detail,
      action.tone,
      action.visible
    ].join("|");
    if (uiCache.action === signature) {
      return;
    }
    uiCache.action = signature;
    actionPriorityPill.className = action.visible
      ? `action-priority-pill action-${action.id} tone-${action.tone}`
      : "action-priority-pill hidden";
    actionPriorityPill.dataset.actionId = action.id;
    actionPriorityPill.replaceChildren();
    if (!action.visible) {
      return;
    }
    const label = document.createElement("strong");
    label.textContent = action.label;
    actionPriorityPill.append(label);
    if (action.detail) {
      const detail = document.createElement("span");
      detail.textContent = action.detail;
      actionPriorityPill.append(detail);
    }
  }

  function updateFeedbackUi(now) {
    const levelPulseActive = now < state.levelPulseUntilMs;
    const upgradePulseActive = now < state.upgradePulseUntilMs;
    const toast = [...state.effects]
      .reverse()
      .find((effect) => effect.type === "levelToast" || effect.type === "upgradeReady");
    const signature = [
      levelPulseActive,
      upgradePulseActive,
      toast?.id ?? "",
      toast?.text ?? "",
      toast?.color ?? ""
    ].join("|");
    if (uiCache.feedback === signature) {
      return;
    }
    uiCache.feedback = signature;

    bars.classList.toggle("level-pulse", levelPulseActive);
    upgradePanel.classList.toggle("upgrade-pulse", upgradePulseActive);
    if (toast) {
      levelToast.textContent = toast.text;
      levelToast.classList.remove("hidden");
      levelToast.style.color = toast.color;
    } else {
      levelToast.classList.add("hidden");
      levelToast.textContent = "";
    }
  }

  return { update };

  function buildTouchControlsOverlay() {
    touchControlsOverlay.id = "touchControls";
    touchControlsOverlay.className = "touch-controls hidden";
    touchControlsOverlay.setAttribute("aria-hidden", "true");
    touchMoveStick.className = "touch-stick touch-stick-move hidden";
    touchMoveStick.dataset.label = "MOVE";
    touchMoveKnob.className = "touch-stick-knob";
    touchMoveStick.append(touchMoveKnob);
    touchAimStick.className = "touch-stick touch-stick-aim hidden";
    touchAimStick.dataset.label = "AIM";
    touchAimKnob.className = "touch-stick-knob";
    touchAimStick.append(touchAimKnob);
    touchFireLockButton.id = "touchFireLockButton";
    touchFireLockButton.type = "button";
    touchFireLockButton.className = "touch-fire-lock";
    touchFireLockButton.textContent = "LOCK";
    touchFireLockButton.setAttribute("aria-label", "Toggle mobile fire lock");
    touchControlsOverlay.append(touchMoveStick, touchAimStick, touchFireLockButton);
  }

  function updateTouchControls(localTank, now, visibility) {
    const gameplayActive = Boolean(
      state.screen === "playing" &&
      localTank?.state === "alive" &&
      !visibility.modalOpen &&
      !visibility.showDeathOverlay
    );
    input?.setTouchControlsActive?.(gameplayActive, now);
    const viewModel = input?.getTouchControlsViewModel?.(now) ?? { visible: false };
    state.touchControlsDebug = {
      enabled: Boolean(viewModel.enabled),
      visible: Boolean(viewModel.visible),
      fireLocked: Boolean(viewModel.fireLocked),
      firing: Boolean(viewModel.firing),
      moveActive: Boolean(viewModel.move?.active),
      aimActive: Boolean(viewModel.aim?.active)
    };
    const signature = [
      viewModel.visible,
      viewModel.fireLockVisible,
      viewModel.fireLocked,
      viewModel.firing,
      viewModel.move?.visible,
      viewModel.move?.active,
      viewModel.move?.baseX,
      viewModel.move?.baseY,
      viewModel.move?.knobX,
      viewModel.move?.knobY,
      viewModel.aim?.visible,
      viewModel.aim?.active,
      viewModel.aim?.baseX,
      viewModel.aim?.baseY,
      viewModel.aim?.knobX,
      viewModel.aim?.knobY
    ].join("|");
    if (uiCache.touchControls === signature) {
      return;
    }
    uiCache.touchControls = signature;
    touchControlsOverlay.classList.toggle("hidden", !viewModel.visible);
    touchControlsOverlay.classList.toggle("firing", Boolean(viewModel.firing));
    touchMoveStick.classList.toggle("hidden", !viewModel.move?.visible);
    touchMoveStick.classList.toggle("active", Boolean(viewModel.move?.active));
    touchAimStick.classList.toggle("hidden", !viewModel.aim?.visible);
    touchAimStick.classList.toggle("active", Boolean(viewModel.aim?.active));
    touchFireLockButton.classList.toggle("hidden", !viewModel.fireLockVisible);
    touchFireLockButton.classList.toggle("locked", Boolean(viewModel.fireLocked));
    touchFireLockButton.textContent = viewModel.fireLocked ? "FIRING" : "LOCK";
    applyStickView(touchMoveStick, touchMoveKnob, viewModel.move);
    applyStickView(touchAimStick, touchAimKnob, viewModel.aim);
  }

  function applyStickView(stick, knob, view) {
    if (!view) {
      return;
    }
    stick.style.setProperty("--stick-x", `${view.baseX}px`);
    stick.style.setProperty("--stick-y", `${view.baseY}px`);
    knob.style.setProperty("--knob-x", `${view.knobX - view.baseX}px`);
    knob.style.setProperty("--knob-y", `${view.knobY - view.baseY}px`);
  }

  function buildDeveloperPanel() {
    const title = document.createElement("strong");
    title.textContent = "DEV LEVEL";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "Set";
    applyButton.addEventListener("click", () => applyDeveloperLevel(Number(developerLevelInput.value)));
    const presetRow = document.createElement("div");
    presetRow.className = "developer-presets";
    for (const level of [15, 30, 45, 60]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `L${level}`;
      button.addEventListener("click", () => applyDeveloperLevel(level));
      presetRow.append(button);
    }
    const row = document.createElement("div");
    row.className = "developer-row";
    row.append(developerLevelInput, applyButton);
    developerPanel.append(title, row, presetRow, developerStatus);
  }

  async function applyDeveloperLevel(level) {
    if (!state.account?.isDeveloper) {
      developerStatus.textContent = "Developer account required";
      return;
    }
    developerStatus.textContent = "Applying...";
    try {
      const result = await apiClient.setDeveloperLevel(level);
      const first = result.updated?.[0];
      developerStatus.textContent = first
        ? `Set L${first.after.level} | ${first.after.upgradePoints} pts`
        : "Join first";
    } catch (error) {
      developerStatus.textContent = error.message;
    }
  }

  function setupMenuContent() {
    menuEyebrow.textContent = MENU_CONFIG.eyebrow;
    menuTitle.textContent = MENU_CONFIG.title;
    menuTagline.textContent = MENU_CONFIG.tagline;
    menuGoal.textContent = MENU_CONFIG.goal;
    playerNameLabel.textContent = MENU_CONFIG.nameLabel;
    playerName.placeholder = MENU_CONFIG.namePlaceholder;
    joinButton.textContent = MENU_CONFIG.joinLabel;
    menuControlsTitle.textContent = MENU_CONFIG.controlsTitle;
    renderChips(menuControlChips, MENU_CONFIG.controls);
    renderChips(menuMobileChips, MENU_CONFIG.mobileControls);
  }

  async function quickJoin(name) {
    joinButton.disabled = true;
    state.error = "";
    state.screen = "checking";
    try {
      await apiClient.ready();
      const result = await apiClient.quickplay();
      state.selectedRoomId = result.room.id;
      onJoin(name, result.room.id);
    } catch (error) {
      state.error = error.message;
      state.screen = "menu";
      joinButton.disabled = false;
    }
  }

  async function refreshAccountState() {
    try {
      const result = await apiClient.me();
      state.account = result.account;
      updateAccountHud(loginMenuButton, state.account);
    } catch {
      state.account = null;
      updateAccountHud(loginMenuButton, null);
    }
  }

  function openRoomsModal() {
    modal.open("Custom Games", createRoomsPanel({
      close: modal.close,
      onJoinRoom: (room) => {
        const name = sanitizeMenuName(playerName.value);
        playerName.value = name;
        writeStorageValue(localStorage, "tankArena.name", name);
        state.selectedRoomId = room.id;
        onJoin(name, room.id);
      }
    }));
  }

  function openEvolutionTree() {
    markOnboardingTreeOpened(state.onboarding);
    uiCache.onboarding = "";
    activeEvolutionTree = createEvolutionTreePanel({
      state,
      onSelectClass
    });
    modal.open("Tank Tree", activeEvolutionTree);
  }

  function updateEvolutionTreeModal() {
    if (!activeEvolutionTree?.isConnected) {
      activeEvolutionTree = null;
      return;
    }
    activeEvolutionTree.update?.();
  }
}

function buildUpgradeButtons(container, onUpgrade) {
  container.replaceChildren();
  for (const key of UPGRADE_KEYS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-button";
    button.dataset.key = key;
    const label = document.createElement("strong");
    const level = document.createElement("span");
    const preview = document.createElement("span");
    label.dataset.upgradeLabel = "";
    level.className = "upgrade-level";
    level.dataset.upgradeLevel = "";
    preview.className = "upgrade-preview";
    preview.dataset.upgradePreview = "";
    button.append(label, level, preview);
    button.addEventListener("click", () => onUpgrade(key));
    container.append(button);
  }
}

function renderChips(container, labels) {
  container.replaceChildren();
  for (const label of labels) {
    const chip = document.createElement("span");
    chip.className = "menu-chip";
    chip.textContent = label;
    container.append(chip);
  }
}

function formatDroneStatus(status) {
  if (!status || !Number.isFinite(Number(status.max)) || Number(status.max) <= 0) {
    return "";
  }
  const current = Math.max(0, Math.min(Number(status.max), Number(status.current) || 0));
  const max = Number(status.max);
  const label = String(status.label || "DRONES").toUpperCase();
  return `${label} ${current}/${max}`;
}
