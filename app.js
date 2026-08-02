"use strict";

(function startServoForge() {
  if (typeof initializeLabelerApp !== "function") {
    console.error("ServoForge startup is unavailable: initializeLabelerApp is not loaded.");
    return;
  }
  initializeLabelerApp();
})();
