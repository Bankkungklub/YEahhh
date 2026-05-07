import { HUD_LAYOUT_CONFIG } from "./hudLayoutConfig.js";

export function getHudVisibility({
  state,
  localTank,
  modalOpen = false,
  config = HUD_LAYOUT_CONFIG.hudVisibility
} = {}) {
  const screen = state?.screen ?? "menu";
  const tankDead = localTank?.state === "dead";
  const deathOverlay = screen === "dead" || Boolean(state?.death && tankDead);
  const playing = screen === "playing";
  const gameplayControlsBlocked = !playing || (config.hideGameplayControlsWhenDead && deathOverlay);
  const classCardsSuspended = Boolean(modalOpen && config.suspendClassCardsWhenModalOpen);

  return {
    screen,
    modalOpen: Boolean(modalOpen),
    showDeathOverlay: deathOverlay,
    suspendGameplayPanels: gameplayControlsBlocked,
    showStatUpgrades: !gameplayControlsBlocked,
    showClassCards: !gameplayControlsBlocked && !classCardsSuspended,
    showTreeButton: !gameplayControlsBlocked,
    showDeveloperPanel: Boolean(state?.account?.isDeveloper && !gameplayControlsBlocked),
    showLeaderboard: config.showLeaderboardBehindDeath || !deathOverlay,
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
