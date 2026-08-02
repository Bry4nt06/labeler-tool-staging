"use strict";

(async function startServoForge() {
  try {
    if (window.ServoForgeBootstrapReady) await window.ServoForgeBootstrapReady;
    if (typeof initializeLabelerApp !== "function") {
      throw new Error("initializeLabelerApp is not loaded.");
    }
    await initializeLabelerApp();
  } catch (error) {
    if (typeof showStartupError === "function") showStartupError(error);
    else console.error("ServoForge startup is unavailable.", error);
  }
})();
