"use strict";

(function installPhysicalWipeDirectionV125(global) {
  const BUILD_ID = "physical-wipe-direction-v129-20260816-2124";
  if (global.ServoForgePhysicalWipeDirectionV125?.buildId === BUILD_ID) return;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function normalizedDirection(value, fallback = "ccw") {
    const normalized = String(value || "").toLowerCase();
    return normalized === "cw" || normalized === "ccw" ? normalized : fallback;
  }

  function storedMachineDirection() {
    try {
      const selected = String(global.document?.getElementById?.("mapDirection")?.value || "").toLowerCase();
      if (selected === "cw" || selected === "ccw") return selected;
    } catch { }
    try {
      const configured = String(global.activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
      if (configured === "cw" || configured === "ccw") return configured;
    } catch { }
    return normalizedDirection(runtimeState().direction);
  }

  function physicalDirectionForStored(storedDirection = storedMachineDirection()) {
    const stored = normalizedDirection(storedDirection);
    if (typeof global.LabelerCoderOrientationDriver?.physicalDirection === "function") {
      return global.LabelerCoderOrientationDriver.physicalDirection(stored);
    }
    const service = global.LabelerWipeTelemetryService;
    if (typeof service?.physicalWipeMachineDirection === "function") {
      return service.physicalWipeMachineDirection(stored);
    }
    return stored === "cw" ? "ccw" : "cw";
  }

  function physicalMachineDirection() {
    return physicalDirectionForStored(storedMachineDirection());
  }

  function physicalWipeVisualSideForPlateTravel(plateTravel, storedDirection = storedMachineDirection()) {
    const travel = Number(plateTravel);
    if (!Number.isFinite(travel) || Math.abs(travel) <= 0.000001) return null;
    const machineDirection = physicalDirectionForStored(storedDirection);
    const renderedBottleRotation = (machineDirection === "cw" ? -1 : 1) * travel;
    return renderedBottleRotation > 0 ? "left" : "right";
  }

  function restorePhysicalCenterCoverage(coverage, tackMode) {
    if (!coverage || String(tackMode || "").toLowerCase() !== "center") return coverage;
    return {
      ...coverage,
      leftPercent: Number(coverage.rightPercent) || 0,
      rightPercent: Number(coverage.leftPercent) || 0
    };
  }

  function sectionAwareCenterCoverage(coverage, tackMode, section) {
    if (!coverage || String(tackMode || "").toLowerCase() !== "center") return coverage;
    const normalizedSection = String(section || coverage?.section || "").trim().toLowerCase();

    // A Neck center tack starts at the label centerline. The servo/arrow side is
    // the side being driven into the tack; the wipe-down visual belongs on the
    // opposite wing as the pad works away from the centerline. v119 already
    // resolves that opposite wing. Do not swap it back here. Body/Back retain
    // the physical-direction correction introduced by v125.
    if (normalizedSection === "neck") return coverage;
    return restorePhysicalCenterCoverage(coverage, tackMode);
  }

  const previousTelemetry = global.LabelerWipeTelemetryService;
  if (previousTelemetry) {
    const previousCoverage = previousTelemetry.contactedLabelCoverage;
    const previousTelemetryFn = previousTelemetry.wipeDownTelemetry;
    const v119CenterSwapActive = Boolean(previousTelemetry.centerTackServoSideParityV119);

    const contactedLabelCoveragePhysical = typeof previousCoverage === "function"
      ? function contactedLabelCoveragePhysical(...args) {
        const coverage = previousCoverage.apply(this, args);
        const section = args[1];
        const visual = args[4];
        return v119CenterSwapActive
          ? sectionAwareCenterCoverage(coverage, visual?.tackMode, section)
          : coverage;
      }
      : previousCoverage;

    const wipeDownTelemetryPhysical = typeof previousTelemetryFn === "function"
      ? function wipeDownTelemetryPhysical(...args) {
        const telemetry = previousTelemetryFn.apply(this, args);
        return v119CenterSwapActive
          ? sectionAwareCenterCoverage(telemetry, telemetry?.tackMode, telemetry?.section)
          : telemetry;
      }
      : previousTelemetryFn;

    global.LabelerWipeTelemetryService = Object.freeze({
      ...previousTelemetry,
      wipeVisualSideForPlateTravel: physicalWipeVisualSideForPlateTravel,
      contactedLabelCoverage: contactedLabelCoveragePhysical,
      wipeDownTelemetry: wipeDownTelemetryPhysical,
      centerTackServoSideParityV119: false,
      physicalCenterWipeDirectionV125: true,
      neckCenterTackOppositeHalfV129: true,
      physicalDirectionSemanticsV125: true
    });
  }

  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      centerTackServoSideParityV119: false,
      physicalCenterWipeDirectionV125: true,
      neckCenterTackOppositeHalfV129: true,
      physicalDirectionSemanticsV125: true
    });
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 16, 2026 9:24 PM ET";

  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 16, 2026 9:24 PM ET — NOT PRODUCTION`;
  }

  global.ServoForgePhysicalWipeDirectionV125 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    storedMachineDirection,
    physicalDirectionForStored,
    physicalMachineDirection,
    physicalWipeVisualSideForPlateTravel,
    restorePhysicalCenterCoverage,
    sectionAwareCenterCoverage,
    physicalCenterWipeDirectionV125: true,
    neckCenterTackOppositeHalfV129: true,
    bottleTransformUnchangedV125: true
  });
})(window);
