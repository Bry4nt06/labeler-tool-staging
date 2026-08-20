"use strict";

let lastAnimationTime = performance.now();
let animationTimerId = null;
let lastBottleHandlingSyncTime = 0;

function resetAnimationClock() {
  lastAnimationTime = performance.now();
  lastBottleHandlingSyncTime = 0;
}

function syncBottleHandling(now) {
  const handling = window.Labeler3DBottleHandlingViewport;
  const sceneRuntime = window.Labeler3DSceneRuntime;
  const viewportOpen = Boolean(window.Labeler3DViewport?.status?.().open);
  if (!viewportOpen || !handling?.sync || !sceneRuntime?.latestSnapshot) return;
  if (now - lastBottleHandlingSyncTime < 33) return;
  const snapshot = sceneRuntime.latestSnapshot();
  if (!snapshot) return;
  lastBottleHandlingSyncTime = now;
  try {
    handling.sync(snapshot);
  } catch (error) {
    console.warn("Bottle handling synchronization skipped", error);
  }
}

function animationFrame(now) {
  if (animationTimerId === null) return;
  const elapsedSeconds = Math.min(0.05, Math.max(0, now - lastAnimationTime) / 1000);
  lastAnimationTime = now;
  if (state.isPlaying) {
    const degreesPerSecond = Math.min(50, Math.max(1, num(state.animationSpeed, 10)));
    state.previewAngle = norm(state.previewAngle + degreesPerSecond * elapsedSeconds);
    try {
      renderAnimationFrame();
      window.LabelerBottleOrientationPanel?.renderAll?.();
    } catch (error) {
      console.error("Animation frame render failed", error);
    }
  }
  syncBottleHandling(now);
  animationTimerId = window.requestAnimationFrame(animationFrame);
}

function startAnimationLoop() {
  if (animationTimerId !== null) window.cancelAnimationFrame(animationTimerId);
  resetAnimationClock();
  animationTimerId = window.requestAnimationFrame(animationFrame);
}

function stopAnimationLoop() {
  if (animationTimerId === null) return;
  window.cancelAnimationFrame(animationTimerId);
  animationTimerId = null;
}

window.LabelerAnimationRuntime = Object.freeze({
  start: startAnimationLoop,
  stop: stopAnimationLoop,
  resetClock: resetAnimationClock
});
