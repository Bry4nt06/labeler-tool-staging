"use strict";

let lastAnimationTime = performance.now();
let animationTimerId = null;

function resetAnimationClock() {
  lastAnimationTime = performance.now();
}

function isThreeDViewportOpen() {
  return Boolean(window.__servoforge3DViewportSingletonV09?.open);
}

function animationFrame(now) {
  if (animationTimerId === null) return;
  const elapsedSeconds = Math.min(0.05, Math.max(0, now - lastAnimationTime) / 1000);
  lastAnimationTime = now;
  if (state.isPlaying) {
    const degreesPerSecond = Math.min(50, Math.max(1, num(state.animationSpeed, 10)));
    state.previewAngle = norm(state.previewAngle + degreesPerSecond * elapsedSeconds);
    // Keep the machine clock advancing while the modal is open, but do not
    // rebuild the hidden dashboard/SVG preview behind the WebGL renderer.
    if (!isThreeDViewportOpen()) {
      try {
        // Bottle-orientation-panel-integration wraps this renderer and performs
        // its own renderAll pass, so a second explicit pass here was redundant.
        renderAnimationFrame();
      } catch (error) {
        console.error("Animation frame render failed", error);
      }
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
  resetClock: resetAnimationClock,
  isThreeDViewportOpen
});

