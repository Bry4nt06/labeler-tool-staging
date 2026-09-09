"use strict";

(function loadServoForgeProfileGenerationModules() {
  const version = document.querySelector('meta[name="application-version"]')?.content || "0.9.10";
  const moduleBuild = "cold-glue-single-brush-unified-visual-v320-20260909-0737";
  const modules = Object.freeze([
    "drivers/profile/apl-contact-window-driver.js",
    "app/sensor-station-cycle-anchor-integration.js",
    "app/apl-seed-profile.js",
    "app/cold-glue-profile-generation.js",
    "app/apl-map-profile-generation.js",
    "app/apl-neck-pad-edge-lock-integration.js",
    "app/apl-neck-topmodul-wipe-reference-integration.js",
    "app/apl-overlapping-pad-handoff-integration.js",
    "drivers/profile/coder-orientation-driver.js",
    "app/autocol-coder-codebox-generation-v122.js",
    "app/apl-coder-codebox-orientation-integration.js",
    "app/profile-routing.js",
    "app/machine-profile-framing.js",
    "app/servo-overrides.js",
    "app/profile-translation-service.js",
    "app/profile-translator-validation.js"
  ]);

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const expected = new URL(
        `./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(moduleBuild)}`,
        window.location.href
      ).href;
      const existing = [...document.scripts].find((script) => script.src === expected);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }

      const script = document.createElement("script");
      script.src = `./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(moduleBuild)}`;
      script.async = false;
      script.dataset.profileGenerationModule = path;
      script.dataset.profileGenerationBuild = moduleBuild;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${path}.`)), { once: true });
      document.body.appendChild(script);
    });
  }

  window.ServoForgeProfileGenerationModules = modules;
  window.ServoForgeProfileGenerationBuild = moduleBuild;
  window.ServoForgeProfileGenerationReady = modules.reduce(
    (promise, path) => promise.then(() => loadScript(path)),
    Promise.resolve()
  );
})();
