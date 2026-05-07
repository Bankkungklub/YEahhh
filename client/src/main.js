import { createClientState, applyServerMessage, getLocalTank } from "./game/clientState.js";
import { createAudioController } from "./audio/audioEngine.js";
import { createInputController } from "./input/inputController.js";
import { createClientSocket } from "./net/clientSocket.js";
import { applyPredictionFrame, createPredictionState, getPredictedLocalTank, recordLocalInput } from "./game/localPrediction.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { createRenderQualityState, updateRenderQuality } from "./render/renderQuality.js";
import { createHud } from "./ui/hud.js";

const canvas = document.querySelector("#gameCanvas");
const state = createClientState();
const audio = createAudioController();
state.renderQuality = createRenderQualityState();
state.prediction = createPredictionState();
const renderer = createCanvasRenderer(canvas, state);
const input = createInputController(canvas, renderer.getCamera, () => (
  getPredictedLocalTank(state.prediction, state.latestSnapshot, state.playerId, performance.now())
  ?? getLocalTank(state)
));
let socket = null;
let lastFrameAt = performance.now();
let lastInputAt = 0;
let lastNetworkInput = null;
let fpsSmooth = 60;

const hud = createHud({
  state,
  audio,
  input,
  onJoin: connect,
  onUpgrade: (key) => socket?.upgrade(key),
  onSelectClass: (classId) => socket?.selectClass(classId),
  onRespawn: () => socket?.respawn()
});

window.addEventListener("pointerdown", () => {
  audio.unlock();
}, { capture: true });

window.addEventListener("keydown", () => {
  audio.unlock();
}, { capture: true });

requestAnimationFrame(frame);

function connect(name, roomId = "") {
  audio.unlock();
  socket?.close();
  lastInputAt = 0;
  lastNetworkInput = null;
  state.screen = "connecting";
  state.error = "";
  socket = createClientSocket({
    onOpen: () => socket.join(name, roomId),
    onMessage: (message) => {
      const messageNow = performance.now();
      const result = applyServerMessage(state, message, messageNow);
      audio.handleAudioEvents(result.audioEvents, messageNow, getLocalTank(state));
    },
    onClose: (closeInfo = {}) => {
      state.connected = false;
      if (state.screen !== "menu") {
        state.error = closeInfo.message || "Disconnected from server.";
        state.screen = "menu";
      }
    },
    onError: (message) => {
      state.error = message;
    }
  });
}

function frame(now) {
  const dt = Math.max(1, now - lastFrameAt);
  lastFrameAt = now;
  fpsSmooth = fpsSmooth * 0.9 + (1000 / dt) * 0.1;
  state.fps = Math.round(fpsSmooth);
  state.renderMetrics.fps = state.fps;
  state.renderMetrics.frameMs = Math.round(dt * 10) / 10;
  updateRenderQuality(state.renderQuality, state.renderMetrics, now);
  state.renderMetrics.renderQuality = state.renderQuality.mode;

  const currentInput = input.peekInput();
  if (state.screen === "playing") {
    applyPredictionFrame({
      prediction: state.prediction,
      input: currentInput,
      dtMs: dt,
      serverTank: getLocalTank(state),
      world: state.latestSnapshot?.world ?? state.publicConfig?.world,
      nowMs: now,
      config: state.publicConfig?.prediction
    });
  }

  if (state.screen === "playing" && socket?.isOpen()) {
    const networkConfig = state.publicConfig?.network ?? {};
    const minInputInterval = 1000 / (networkConfig.inputRateHz ?? 30);
    const changedMinInterval = networkConfig.changedInputMinIntervalMs ?? 16;
    const forceInputSendMs = networkConfig.forceInputSendMs ?? 100;
    const sinceInput = now - lastInputAt;
    const changed = hasInputChanged(lastNetworkInput, currentInput);
    if ((changed && sinceInput >= changedMinInterval) || sinceInput >= minInputInterval || sinceInput >= forceInputSendMs) {
      const networkInput = input.collectInput();
      socket.input(networkInput);
      recordLocalInput(state.prediction, networkInput, now, state.publicConfig?.prediction);
      lastNetworkInput = networkInput;
      lastInputAt = now;
    }
  }

  const renderStart = performance.now();
  renderer.render(now);
  state.renderMetrics.renderMs = Math.round((performance.now() - renderStart) * 10) / 10;
  audio.updateForScreen(state.screen);
  state.audioDebug = audio.getDebugState();
  const hudStart = performance.now();
  hud.update(now);
  state.renderMetrics.hudMs = Math.round((performance.now() - hudStart) * 10) / 10;
  requestAnimationFrame(frame);
}

function hasInputChanged(previous, next) {
  if (!previous || !next) {
    return true;
  }
  return (
    Math.abs(previous.moveX - next.moveX) > 0.001 ||
    Math.abs(previous.moveY - next.moveY) > 0.001 ||
    previous.fire !== next.fire ||
    angleDelta(previous.aimAngle, next.aimAngle) > 0.08
  );
}

function angleDelta(a, b) {
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
}
