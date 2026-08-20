(function installServoForge3DMeasuredSpacingOverlay(global) {
  "use strict";

  const VERSION = "servoforge.3d-measured-spacing.v2";
  let frameUnsubscribe = null;

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
    if (!backdrop.querySelector("#servoforge3dPlateCenterSpacing")) telemetry.appendChild(metric("servoforge3dPlateCenterSpacing", "Plate center spacing"));
    if (!backdrop.querySelector("#servoforge3dPlateClearance")) telemetry.appendChild(metric("servoforge3dPlateClearance", "Plate clearance"));
    if (!backdrop.querySelector("#servoforge3dPlateDiameter")) telemetry.appendChild(metric("servoforge3dPlateDiameter", "Plate diameter"));
    if (!backdrop.querySelector("#servoforge3dPlannerPitchRadius")) telemetry.appendChild(metric("servoforge3dPlannerPitchRadius", "Planner/map radius", ""));
    return backdrop;
  }

  function sync(snapshot) {
    const backdrop = ensureTelemetry();
    if (!backdrop || !snapshot) return false;
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
  }

  function bindToCanonicalFrame(attempt = 0) {
    const viewport = global.Labeler3DViewport;
    if (typeof viewport?.addFrameListener === "function") {
      frameUnsubscribe?.();
      frameUnsubscribe = viewport.addFrameListener(({ snapshot }) => sync(snapshot));
      sync(global.Labeler3DSceneRuntime?.latestSnapshot?.());
      return true;
    }
    if (attempt < 240) global.setTimeout(() => bindToCanonicalFrame(attempt + 1), 25);
    return false;
  }

  global.Labeler3DMeasuredSpacingOverlay = Object.freeze({
    VERSION,
    sync,
    refresh: () => sync(global.Labeler3DSceneRuntime?.latestSnapshot?.()),
    measuredCenterSpacingMm: 110,
    measuredClearanceMm: 16,
    derivedPlateDiameterMm: 94,
    independentTimer: false,
    snapshotAuthority: "canonical-3d-render-frame",
    readOnly: true
  });

  bindToCanonicalFrame();
})(window);
