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
      // The 3D all-bottle synchronization integration uses this same preview
      // angle and generated Servo Program as the single bottle-rotation path.
      window.Labeler3DAllBottleServoSynchronization?.synchronize?.();
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

(function loadCurrent3DAnimationIntegrations() {
  const version = window.SERVOFORGE_RELEASE_VERSION || "0.9.10";
  const build = window.ServoForgeBootstrapBuild || "3d-animation-authority-v218";

  function loadScript(path, datasetKey, datasetValue) {
    const existing = [...document.scripts].find((script) => script.dataset[datasetKey] === datasetValue);
    if (existing) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(build)}`;
      script.async = false;
      script.dataset[datasetKey] = datasetValue;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => {
        console.warn(`ServoForge 3D integration ${path} could not be loaded; the base animation remains available.`);
        resolve();
      }, { once: true });
      (document.body || document.head || document.documentElement).appendChild(script);
    });
  }

  loadScript(
    "app/3d/all-bottle-servo-synchronization-integration.js",
    "servoforge3dAllBottleServoSync",
    "v1"
  ).then(() => loadScript(
    "app/3d/animation-authority-integration.js",
    "servoforge3dAnimationAuthority",
    "v1"
  ));
})();
