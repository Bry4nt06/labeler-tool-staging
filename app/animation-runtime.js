"use strict";

let lastAnimationTime = performance.now();
let animationTimerId = null;

function resetAnimationClock() {
  lastAnimationTime = performance.now();
}

function isThreeDViewportOpen() {
  return Boolean(window.__servoforge3DViewportSingletonV09?.open);
}

function authoritativeAnimationRenderer() {
  const current = window.renderAnimationFrame;
  if (
    current?.stationOneBottleOrientationV72
    && typeof current.previousRenderAnimationFrame === "function"
  ) {
    window.renderAnimationFrame = current.previousRenderAnimationFrame;
    return window.renderAnimationFrame;
  }
  return current;
}

function renderSharedAnimationFrame() {
  try {
    const renderer = authoritativeAnimationRenderer();
    if (typeof renderer === "function") renderer();
  } catch (error) {
    console.error("Animation frame render failed", error);
  }

  try {
    window.LabelerBottleOrientationPanel?.renderAll?.();
  } catch (error) {
    console.error("Bottle orientation frame render failed", error);
  }
}

function animationFrame(now) {
  if (animationTimerId === null) return;
  const elapsedSeconds = Math.min(0.05, Math.max(0, now - lastAnimationTime) / 1000);
  lastAnimationTime = now;
  if (state.isPlaying) {
    const degreesPerSecond = Math.min(50, Math.max(1, num(state.animationSpeed, 10)));
    state.previewAngle = norm(state.previewAngle + degreesPerSecond * elapsedSeconds);
    // The shared animation clock is the only owner of live dashboard refreshes.
    // Strip the legacy bottle-orientation wrapper once, then refresh the panel
    // explicitly from the same frame that advances the machine preview angle.
    if (!isThreeDViewportOpen()) renderSharedAnimationFrame();
  }
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
  resetClock: resetAnimationClock,
  isThreeDViewportOpen
});
