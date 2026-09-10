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

  function isMultiModulCorrectionContext(machineMap) {
    const map = machineMap || activeMapSafe();
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
      map?.applicationMode
      || map?.application
      || (typeof state !== "undefined" ? state?.applicationMode : "")
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
    const base = global.LabelerAplMapProfileGenerator;
    const normalizer = global.LabelerMultiModulCorrectionPairDriver;
    if (!base?.generate || !normalizer?.normalize) return false;
    if (base.multimodulCorrectionPairEnabled) return true;

    function generate(machineMap) {
      const generated = base.generate(machineMap);
      if (!isMultiModulCorrectionContext(machineMap)) return generated;

      const result = normalizer.normalize(generated, { referenceSpacingDeg: 0.5 });
      if (typeof state !== "undefined") {
        state.multiModulCorrectionPairRepairs = result.repairs;
        if (state.motionPlan?.mapDriven) {
          const finalRow = result.rows[result.rows.length - 1];
          state.motionPlan = {
            ...state.motionPlan,
            rows: result.rows,
            finalPlateAngle: finalRow?.plateAngle,
            termination: state.motionPlan.termination
              ? { ...state.motionPlan.termination, hmi: result.rows.length, tableAngle: finalRow?.tableAngle, command: "Rest" }
              : state.motionPlan.termination
          };
        }
      }
      return result.rows;
    }

    global.LabelerAplMapProfileGenerator = Object.freeze({
      ...base,
      generate,
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
