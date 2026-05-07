import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";

export function getHudVisibility({
  state,
  localTank,
  modalOpen = false,
  viewportProfile = null,
  config = HUD_LAYOUT_CONFIG.hudVisibility
} = {}) {
  const screen = state?.screen ?? "menu";
  const tankDead = localTank?.state === "dead";
  const deathOverlay = screen === "dead" || Boolean(state?.death && tankDead);
  const playing = screen === "playing";
  const gameplayControlsBlocked = !playing || (config.hideGameplayControlsWhenDead && deathOverlay);
  const classCardsSuspended = Boolean(modalOpen && config.suspendClassCardsWhenModalOpen);
  const compactHud = Boolean(viewportProfile?.compactHud);

  return {
    screen,
    modalOpen: Boolean(modalOpen),
    compactHud,
    phonePortrait: Boolean(viewportProfile?.phonePortrait),
    phoneLandscape: Boolean(viewportProfile?.phoneLandscape),
    showDeathOverlay: deathOverlay,
    suspendGameplayPanels: gameplayControlsBlocked,
    showStatUpgrades: !gameplayControlsBlocked,
    showClassCards: !gameplayControlsBlocked && !classCardsSuspended,
    showTreeButton: !gameplayControlsBlocked,
    showDeveloperPanel: Boolean(state?.account?.isDeveloper && !gameplayControlsBlocked),
    showLeaderboard: (config.showLeaderboardBehindDeath || !deathOverlay) && !(playing && compactHud),
    classCardsSuspended
  };
}

export function isGameplayPanelInteractive(visibility) {
  return Boolean(
    visibility?.showStatUpgrades ||
    visibility?.showClassCards ||
    visibility?.showTreeButton ||
    visibility?.showDeveloperPanel
  );
}
