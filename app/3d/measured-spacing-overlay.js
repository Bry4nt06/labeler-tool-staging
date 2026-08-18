(function installServoForge3DMeasuredSpacingOverlay(global) {
  "use strict";

  const VERSION = "servoforge.3d-measured-spacing.v1";
  let refreshTimer = null;

  function formatMm(value, decimals = 2) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(decimals)} mm` : "—";
  }

  function metric(id, label, className = "physical") {
    const node = document.createElement("div");
    node.className = `servoforge-3d-metric ${className}`.trim();
    node.innerHTML = `<span>${label}</span><strong id="${id}">—</strong>`;
    return node;
  }

  function ensureTelemetry() {
    const backdrop = document.querySelector("#servoforge3dBackdrop");
    const telemetry = backdrop?.querySelector(".servoforge-3d-telemetry");
    if (!backdrop || !telemetry) return null;

    const pitchRadius = backdrop.querySelector("#servoforge3dPitchRadius");
    const pitchLabel = pitchRadius?.parentElement?.querySelector("span");
    if (pitchLabel) pitchLabel.textContent = "Physical pitch radius";

    if (!backdrop.querySelector("#servoforge3dPlateCenterSpacing")) {
      telemetry.appendChild(metric("servoforge3dPlateCenterSpacing", "Plate center spacing"));
    }
    if (!backdrop.querySelector("#servoforge3dPlateClearance")) {
      telemetry.appendChild(metric("servoforge3dPlateClearance", "Plate clearance"));
    }
    if (!backdrop.querySelector("#servoforge3dPlateDiameter")) {
      telemetry.appendChild(metric("servoforge3dPlateDiameter", "Plate diameter"));
    }
    if (!backdrop.querySelector("#servoforge3dPlannerPitchRadius")) {
      telemetry.appendChild(metric("servoforge3dPlannerPitchRadius", "Planner/map radius", ""));
    }

    const note = backdrop.querySelector(".servoforge-3d-note");
    if (note) {
      note.innerHTML = "<strong>Measured bottle-table geometry:</strong> 110.00 mm plate centers and 16.00 mm edge clearance. The 3D physical pitch circle is derived from those measurements; ServoForge planner/map radius remains unchanged. Head 1 is the live servo head.";
    }
    return backdrop;
  }

  function refresh() {
    const backdrop = ensureTelemetry();
    const runtime = global.Labeler3DSceneRuntime;
    if (!backdrop || typeof runtime?.snapshot !== "function") return false;
    try {
      const snapshot = runtime.snapshot();
      const geometry = snapshot?.geometry || {};
      const carousel = snapshot?.carousel || {};
      const centerSpacing = carousel.plateCenterSpacingMm || geometry.bottleTable?.centerSpacingMm;
      const clearance = carousel.plateClearanceMm || geometry.bottleTable?.clearanceMm;
      const plateDiameter = carousel.plateDiameterMm || geometry.bottleTable?.plateDiameterMm;
      const plannerRadius = carousel.plannerPitchRadiusMm || geometry.machine?.plannerPitchRadiusMm;
      const physicalRadius = carousel.physicalPitchRadiusMm || geometry.machine?.physicalPitchRadiusMm;

      const set = (selector, text) => {
        const element = backdrop.querySelector(selector);
        if (element) element.textContent = text;
      };
      set("#servoforge3dPlateCenterSpacing", formatMm(centerSpacing, 2));
      set("#servoforge3dPlateClearance", formatMm(clearance, 2));
      set("#servoforge3dPlateDiameter", formatMm(plateDiameter, 2));
      set("#servoforge3dPlannerPitchRadius", formatMm(plannerRadius, 3));
      set("#servoforge3dPitchRadius", formatMm(physicalRadius, 3));
      return true;
    } catch (error) {
      console.warn("ServoForge measured 3D spacing telemetry could not refresh", error);
      return false;
    }
  }

  function install(attempt = 0) {
    if (!ensureTelemetry()) {
      if (attempt < 160) global.setTimeout(() => install(attempt + 1), 25);
      return;
    }
    refresh();
    if (refreshTimer !== null) global.clearInterval(refreshTimer);
    refreshTimer = global.setInterval(refresh, 500);
    global.Labeler3DMeasuredSpacingOverlay = Object.freeze({
      VERSION,
      refresh,
      measuredCenterSpacingMm: 110,
      measuredClearanceMm: 16,
      derivedPlateDiameterMm: 94,
      readOnly: true
    });
  }

  install();
})(window);
