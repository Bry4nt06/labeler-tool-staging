"use strict";

let lastAnimationTime = performance.now();
let animationTimerId = null;

function resetAnimationClock() {
  lastAnimationTime = performance.now();
}

function animationFrame(now) {
  if (animationTimerId === null) return;
  const elapsedSeconds = Math.min(0.05, Math.max(0, now - lastAnimationTime) / 1000);
  lastAnimationTime = now;

  if (state.isPlaying) {
    const degreesPerSecond = Math.min(50, Math.max(1, num(state.animationSpeed, 10)));
    state.previewAngle = norm(state.previewAngle + degreesPerSecond * elapsedSeconds);
    const viewportOpen = Boolean(window.Labeler3DViewport?.status?.().open);
    try {
      // While the 3D dialog is open, its canonical WebGL frame owns all drawing.
      // Keep the shared machine angle moving but do not redraw the legacy 2D
      // preview behind the modal or resynchronize the 3D scene a second time.
      if (!viewportOpen) renderAnimationFrame();
      window.LabelerBottleOrientationPanel?.renderAll?.();
    } catch (error) {
      console.error("Animation frame render failed", error);
    }
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
  resetClock: resetAnimationClock
});
