import { normalize } from "../../../shared/sim/vector.js";
import {
  buildTouchInput,
  createTouchControlsState,
  getTouchOverlayViewModel,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  setTouchGameplayActive,
  toggleTouchFireLock
} from "./touchControls.js";

export function createInputController(canvas, getCamera, getLocalTank) {
  const keys = new Set();
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    down: false
  };
  const touchControls = createTouchControlsState();
  let seq = 0;

  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  canvas.addEventListener("mousemove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  canvas.addEventListener("mousedown", () => {
    pointer.down = true;
  });
  window.addEventListener("mouseup", () => {
    pointer.down = false;
  });

  canvas.addEventListener("touchstart", (event) => {
    if (!touchControls.gameplayActive) {
      return;
    }
    handleTouchStart(touchControls, event.changedTouches, getViewport(), performance.now());
    syncPointerFromAimTouch();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    if (!touchControls.gameplayActive) {
      return;
    }
    handleTouchMove(touchControls, event.changedTouches, getViewport(), performance.now());
    syncPointerFromAimTouch();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", (event) => {
    handleTouchEnd(touchControls, event.changedTouches, performance.now());
    syncPointerFromAimTouch();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchcancel", (event) => {
    handleTouchEnd(touchControls, event.changedTouches, performance.now());
    syncPointerFromAimTouch();
    event.preventDefault();
  }, { passive: false });

  function collectInput({ incrementSeq = true } = {}) {
    const input = buildInput(seq + (incrementSeq ? 1 : 0));
    if (incrementSeq) {
      seq = input.seq;
    }
    return input;
  }

  function peekInput() {
    return collectInput({ incrementSeq: false });
  }

  function buildInput(nextSeq) {
    const tank = getLocalTank();
    const camera = getCamera();
    const touchInput = buildTouchInput(touchControls, {
      camera,
      localTank: tank,
      fallbackAimAngle: tank?.aimAngle ?? tank?.angle ?? 0
    });
    if (touchInput.active) {
      return {
        seq: nextSeq,
        moveX: touchInput.moveX,
        moveY: touchInput.moveY,
        aimAngle: touchInput.aimAngle,
        fire: touchInput.fire || isPressed("Space")
      };
    }

    const keyboardX = (isPressed("KeyD") || isPressed("ArrowRight") ? 1 : 0) -
      (isPressed("KeyA") || isPressed("ArrowLeft") ? 1 : 0);
    const keyboardY = (isPressed("KeyS") || isPressed("ArrowDown") ? 1 : 0) -
      (isPressed("KeyW") || isPressed("ArrowUp") ? 1 : 0);
    const rawMove = { x: keyboardX, y: keyboardY };
    const move = normalize(rawMove.x, rawMove.y);
    const worldPointer = screenToWorld(pointer.x, pointer.y, camera);
    const aimAngle = tank
      ? Math.atan2(worldPointer.y - tank.y, worldPointer.x - tank.x)
      : 0;

    return {
      seq: nextSeq,
      moveX: move.x,
      moveY: move.y,
      aimAngle,
      fire: pointer.down || isPressed("Space")
    };
  }

  function isPressed(code) {
    return keys.has(code);
  }

  function setTouchControlsActive(active, nowMs = performance.now()) {
    const wasActive = touchControls.gameplayActive;
    setTouchGameplayActive(touchControls, active, nowMs);
    if (!touchControls.gameplayActive) {
      pointer.down = false;
      return;
    }
    if (!wasActive) {
      pointer.down = false;
    }
  }

  function getTouchControlsViewModel(nowMs = performance.now()) {
    return getTouchOverlayViewModel(touchControls, {
      viewport: getViewport(),
      nowMs,
      gameplayActive: touchControls.gameplayActive,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      coarsePointer: Boolean(window.matchMedia?.("(pointer: coarse)")?.matches)
    });
  }

  function toggleTouchControlsFireLock(nowMs = performance.now()) {
    toggleTouchFireLock(touchControls, nowMs);
  }

  function syncPointerFromAimTouch() {
    if (touchControls.aimCurrent) {
      pointer.x = touchControls.aimCurrent.x;
      pointer.y = touchControls.aimCurrent.y;
    }
    pointer.down = Boolean(touchControls.firing);
  }

  function getViewport() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  return {
    collectInput,
    peekInput,
    isPressed,
    pointer,
    touchControls,
    setTouchControlsActive,
    getTouchControlsViewModel,
    toggleTouchControlsFireLock
  };
}

function screenToWorld(x, y, camera) {
  return {
    x: camera.x + (x - camera.width / 2) / camera.scale,
    y: camera.y + (y - camera.height / 2) / camera.scale
  };
}
