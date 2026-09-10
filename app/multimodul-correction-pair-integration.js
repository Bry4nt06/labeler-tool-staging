"use strict";

(function installMultiModulCorrectionPairIntegration(global) {
  if (global.ServoForgeMultiModulCorrectionPairReady) return;

  const RETRY_MS = 25;

  function activeMapSafe() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function isMultiModulCorrectionContext() {
    const map = activeMapSafe();
    const identity = [
      map?.machineType,
      map?.machineFamily,
      map?.name,
      typeof state !== "undefined" ? state?.machineType : "",
      typeof state !== "undefined" ? state?.selectedMachineType : "",
      typeof state !== "undefined" ? state?.buildInputs?.machineType : "",
      typeof state !== "undefined" ? state?.motionTranslation?.machineProfile : "",
      typeof state !== "undefined" ? state?.motionPlan?.translation?.machineProfile : ""
    ].filter(Boolean).join(" ").toUpperCase();
    const application = String(
      (typeof state !== "undefined" ? state?.applicationMode : "")
      || map?.applicationMode
      || ""
    ).toLowerCase();
    const selectedProfile = String(
      (typeof state !== "undefined" ? state?.selectedMotionProfileId : "")
      || (typeof state !== "undefined" ? state?.defaultMotionProfileId : "")
      || ""
    );

    if (application === "cold-glue") return false;
    if (identity.includes("MULTIMODUL")) return true;
    return application === "apl" && selectedProfile === "continuous-motion";
  }

  function install() {
    const base = global.LabelerServoCommandDriver;
    const normalizer = global.LabelerMultiModulCorrectionPairDriver;
    if (!base || !normalizer?.normalize || !base.aplContinuousMotionEnabled) return false;
    if (base.multimodulCorrectionPairEnabled) return true;

    function finalize(rows) {
      const finalized = base.finalize(rows);
      if (!isMultiModulCorrectionContext()) return finalized;
      const result = normalizer.normalize(finalized, { referenceSpacingDeg: 0.5 });
      if (typeof state !== "undefined") {
        state.multiModulCorrectionPairRepairs = result.repairs;
      }
      return result.rows;
    }

    global.LabelerServoCommandDriver = Object.freeze({
      ...base,
      finalize,
      multimodulCorrectionPairEnabled: true
    });
    return true;
  }

  global.ServoForgeMultiModulCorrectionPairReady = new Promise((resolve) => {
    const wait = () => {
      if (install()) {
        resolve(true);
        return;
      }
      global.setTimeout(wait, RETRY_MS);
    };
    wait();
  });
})(window);
