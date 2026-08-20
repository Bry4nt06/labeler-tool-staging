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
  if (!viewportOpen || !handling?.sync || !sceneRuntime?.snapshot) return;
  if (now - lastBottleHandlingSyncTime < 33) return;
  lastBottleHandlingSyncTime = now;
  try {
    const snapshot = sceneRuntime.snapshot({
      scene: {
        tableY: 0.20,
        bottleLift: 0.155,
        unitMode: "physical-mm-bottle-handling-primary-clock-v4"
      }
    });
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
  window.Labeler3DControlSurfaceRecovery?.ensure?.();
  window.Labeler3DMechanicalMapAnimationLauncher?.ensure?.();
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
  const build = window.ServoForgeBootstrapBuild || "3d-runtime-cleanup-v226";

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
    "app/3d/animation-authority-integration.js",
    "servoforge3dAnimationAuthority",
    "v3"
  ).then(() => loadScript(
    "app/3d/control-surface-recovery-integration.js",
    "servoforge3dControlSurfaceRecovery",
    "v2"
  )).then(() => loadScript(
    "app/3d/mechanical-map-animation-launcher-integration.js",
    "servoforge3dMechanicalMapAnimationLauncher",
    "v2"
  ));
})();
