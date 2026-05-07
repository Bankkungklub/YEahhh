import { apiClient } from "../api/apiClient.js";
import { createMessage } from "./modalManager.js";

export function createSettingsPanel({ state, audio = null }) {
  const root = document.createElement("div");
  root.className = "settings-panel";
  if (audio) {
    root.append(createAudioSection(audio));
  }
  const serverSection = document.createElement("div");
  serverSection.className = "settings-section";
  serverSection.append(createSectionTitle("Server"));
  serverSection.append(createMessage("Loading server status...", "muted"));
  root.append(serverSection);
  apiClient.matchmakingStatus()
    .then((status) => {
      serverSection.replaceChildren();
      serverSection.append(createSectionTitle("Server"));
      const room = state.room;
      serverSection.append(createMessage(`Region: ${status.defaultRegion}`, "ready"));
      serverSection.append(createMessage(`Rooms online: ${status.rooms.length}`, "muted"));
      serverSection.append(createMessage(room ? `Current room: ${room.name} (${room.players}/${room.maxPlayers})` : "Not in a room.", "muted"));
    })
    .catch((error) => {
      serverSection.replaceChildren(createSectionTitle("Server"), createMessage(error.message, "error"));
    });
  return root;
}

function createAudioSection(audio) {
  const section = document.createElement("div");
  section.className = "settings-section audio-settings";
  const status = createMessage("", "muted");
  const settings = audio.getSettings();
  const unlockButton = document.createElement("button");
  unlockButton.type = "button";
  unlockButton.className = "secondary-button";
  unlockButton.textContent = "Enable Audio";
  unlockButton.addEventListener("click", async () => {
    await audio.unlock();
    renderStatus();
  });

  const muteToggle = createToggleRow("Mute all", settings.muted, (checked) => {
    audio.updateSettings({ muted: checked });
    renderStatus();
  });
  const musicToggle = createToggleRow("Music", settings.musicEnabled, (checked) => {
    audio.updateSettings({ musicEnabled: checked });
    renderStatus();
  });
  const sfxToggle = createToggleRow("SFX", settings.sfxEnabled, (checked) => {
    audio.updateSettings({ sfxEnabled: checked });
    renderStatus();
  });
  const masterSlider = createVolumeRow("Master", settings.masterVolume, (value) => {
    audio.updateSettings({ masterVolume: value });
    renderStatus();
  });
  const musicSlider = createVolumeRow("Music volume", settings.musicVolume, (value) => {
    audio.updateSettings({ musicVolume: value });
    renderStatus();
  });
  const sfxSlider = createVolumeRow("SFX volume", settings.sfxVolume, (value) => {
    audio.updateSettings({ sfxVolume: value });
    renderStatus();
  });

  section.append(
    createSectionTitle("Audio"),
    status,
    unlockButton,
    muteToggle,
    musicToggle,
    sfxToggle,
    masterSlider,
    musicSlider,
    sfxSlider
  );
  renderStatus();
  return section;

  function renderStatus() {
    const debug = audio.getDebugState();
    const stateText = debug.disabled
      ? "Unavailable"
      : debug.muted
        ? "Muted"
        : debug.unlocked
          ? `On (${debug.contextState})`
          : "Locked until first click/tap";
    status.textContent = `Audio: ${stateText}`;
    unlockButton.hidden = debug.unlocked || debug.disabled;
  }
}

function createSectionTitle(text) {
  const title = document.createElement("h3");
  title.className = "settings-title";
  title.textContent = text;
  return title;
}

function createToggleRow(labelText, checked, onChange) {
  const label = document.createElement("label");
  label.className = "settings-row toggle-row";
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(span, input);
  return label;
}

function createVolumeRow(labelText, value, onChange) {
  const label = document.createElement("label");
  label.className = "settings-row volume-row";
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(value);
  const valueText = document.createElement("strong");
  valueText.textContent = `${Math.round(value * 100)}%`;
  input.addEventListener("input", () => {
    const next = Number(input.value);
    valueText.textContent = `${Math.round(next * 100)}%`;
    onChange(next);
  });
  label.append(span, input, valueText);
  return label;
}
