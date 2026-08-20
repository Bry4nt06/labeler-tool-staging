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
    try {
      renderAnimationFrame();
      // Keep the Servo Program Bottle Orientation panel on the same clock as
      // the primary labeler animation, even when the panel integration loaded
      // before renderAnimationFrame was available to wrap.
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

(function loadCurrent3DAnimationAuthority() {
  const path = "app/3d/animation-authority-integration.js";
  const existing = [...document.scripts].find((script) => script.dataset.servoforge3dAnimationAuthority === "v1");
  if (existing) return;
  const script = document.createElement("script");
  script.src = `./${path}?v=${encodeURIComponent(window.SERVOFORGE_RELEASE_VERSION || "0.9.10")}&build=${encodeURIComponent(window.ServoForgeBootstrapBuild || "3d-animation-authority-v217")}`;
  script.async = false;
  script.dataset.servoforge3dAnimationAuthority = "v1";
  script.addEventListener("error", () => console.warn("ServoForge 3D animation authority could not be loaded; the base animation remains available."), { once: true });
  (document.body || document.head || document.documentElement).appendChild(script);
})();
