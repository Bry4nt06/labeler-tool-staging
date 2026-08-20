(function installServoForge3DControlSurfaceRecovery(global) {
  "use strict";

  const VERSION = "servoforge.3d-control-surface-recovery.v1";
  const BUILD = "3d-control-surface-v219-20260820-0936";
  const UPDATED_AT = "Aug 20, 2026 9:36 AM ET";
  let observer = null;

  function authority() {
    return global.Labeler3DViewportUiControls || null;
  }

  function setPressed(button, pressed) {
    if (button) button.setAttribute("aria-pressed", String(Boolean(pressed)));
  }

  function ensureControlSurface() {
    const backdrop = document.querySelector("#servoforge3dBackdrop");
    const controls = backdrop?.querySelector(".servoforge-3d-controls");
    if (!backdrop || !controls || !authority()) return false;

    if (!controls.querySelector("#servoforge3dBottleMode")) {
      const wrap = document.createElement("label");
      wrap.className = "servoforge-3d-bottle-control";
      wrap.innerHTML = 'Bottles <select id="servoforge3dBottleMode"><option value="all">All</option><option value="head1">Head 1</option><option value="none">None</option></select>';
      const select = wrap.querySelector("#servoforge3dBottleMode");
      select.addEventListener("change", () => authority()?.setBottleMode?.(select.value));
      controls.prepend(wrap);
    }

    if (!controls.querySelector("#servoforge3dTelemetryToggle")) {
      const button = document.createElement("button");
      button.id = "servoforge3dTelemetryToggle";
      button.type = "button";
      button.textContent = "Hide Data";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-pressed") !== "true";
        authority()?.setTelemetryHidden?.(next);
        setPressed(button, next);
        button.textContent = next ? "Show Data" : "Hide Data";
      });
      controls.prepend(button);
    }

    if (!controls.querySelector("#servoforge3dTransparentObjects")) {
      const button = document.createElement("button");
      button.id = "servoforge3dTransparentObjects";
      button.type = "button";
      button.textContent = "Transparent Objects";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-pressed") !== "true";
        authority()?.setMachineTransparent?.(next);
        setPressed(button, next);
      });
      controls.prepend(button);
    }

    if (!controls.querySelector("#servoforge3dFreeRoam")) {
      const button = document.createElement("button");
      button.id = "servoforge3dFreeRoam";
      button.type = "button";
      button.textContent = "Free Roam";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-pressed") !== "true";
        authority()?.setFreeRoam?.(next);
        setPressed(button, next);
      });
      controls.prepend(button);
    }

    authority()?.setBottleMode?.(document.querySelector("#servoforge3dBottleMode")?.value || "all");
    return true;
  }

  function installObserver() {
    if (observer || typeof MutationObserver !== "function" || !document.documentElement) return;
    observer = new MutationObserver(() => ensureControlSurface());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  publishBuild();
  ensureControlSurface();
  installObserver();

  global.Labeler3DControlSurfaceRecovery = Object.freeze({
    VERSION,
    BUILD,
    ensure: ensureControlSurface,
    status() {
      return Object.freeze({
        version: VERSION,
        bottleMode: Boolean(document.querySelector("#servoforge3dBottleMode")),
        telemetryToggle: Boolean(document.querySelector("#servoforge3dTelemetryToggle")),
        transparencyToggle: Boolean(document.querySelector("#servoforge3dTransparentObjects")),
        freeRoamToggle: Boolean(document.querySelector("#servoforge3dFreeRoam"))
      });
    }
  });
})(window);
