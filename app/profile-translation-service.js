"use strict";

(function installProfileTranslationService() {
  let installed = false;

  function selectedTranslatorProfile() {
    const profiles = typeof allMotionProfiles === "function" ? allMotionProfiles() : [];
    const selectedId = state.selectedMotionProfileId || state.defaultMotionProfileId || "automatic";
    return profiles.find((profile) => profile.id === selectedId) || profiles[0] || {
      id: "automatic",
      name: "Automatic",
      description: "Uses the active machine profile.",
      machineProfile: "AUTO",
      intents: [],
      builtIn: true
    };
  }

  function translatorMachineProfile(profile) {
    return typeof resolveProfileMachine === "function" ? resolveProfileMachine(profile) : "DEFAULT";
  }

  function syncTranslatedRows(result, normalizedRows) {
    result.rows = normalizedRows;
    result.plan = {
      ...(result.plan || {}),
      steps: normalizedRows.map((row, index) => ({
        ...(result.plan?.steps?.[index] || {}),
        index,
        eventId: row.motionEventId || `EV${String(index + 1).padStart(3, "0")}`,
        eventType: row.motionEventType || "GENERAL",
        hmi: row.hmi ?? index + 1,
        tableAngle: Number(row.tableAngle),
        plateAngle: Number(row.plateAngle),
        action: String(row.action || ""),
        baseCommand: Number(row.baseCmd ?? row.cmd),
        requestedCommand: Number(row.plannerRequestedCommand ?? row.cmd),
        recommendedCommand: Number(row.cmd),
        recommendedCommandName: row.translatedCommandName || `CMD ${row.cmd}`,
        intent: row.plannerIntent || (Number(row.cmd) === 7 ? "ROTATE" : "HOLD"),
        reason: row.plannerReason || "",
        fallbackUsed: Boolean(row.plannerFallbackUsed),
        fallbackReason: String(row.plannerFallbackReason || "")
      }))
    };
    return result;
  }

  function buildAndTranslateProgram() {
    const planner = window.LabelerMotionPlannerDriver;
    const translator = window.LabelerProfileTranslatorDriver;
    if (!planner?.buildPlan || !translator?.translate || !Array.isArray(state.program)) return null;

    const profile = selectedTranslatorProfile();
    const requestedProfileId = profile.id || "automatic";
    const machineProfile = translatorMachineProfile(profile);
    const plan = planner.buildPlan(state.program, {
      profileId: requestedProfileId,
      machineProfile,
      customIntents: profile.builtIn ? [] : profile.intents || []
    });
    const result = translator.translate(state.program, plan, {
      requestedProfileId,
      profileId: plan.profileId,
      machineProfile
    });

    state.program = result.rows;
    if (typeof normalizeServoProgramTableAngles === "function") {
      const normalized = normalizeServoProgramTableAngles(state.program);
      state.program = normalized.rows;
      state.tableAngleSequence = {
        valid: true,
        minimumStep: normalized.minimumStep,
        adjustedRows: normalized.adjustedRows,
        adjustedCount: normalized.adjustedRows.length
      };
      syncTranslatedRows(result, state.program);
    }

    state.motionPlan = {
      ...(state.motionPlan || {}),
      planner: result.plan,
      translation: {
        requestedProfileId: result.requestedProfileId,
        profileId: result.profileId,
        machineProfile: result.machineProfile,
        translated: result.translated,
        translatedCount: result.translatedCount,
        advancedCommandsApplied: result.advancedCommandsApplied,
        advancedCount: result.advancedCount,
        fallbackCount: result.fallbackCount,
        commandSummary: result.commandSummary,
        issues: result.issues
      }
    };
    state.motionTranslation = result;
    return result;
  }

  function install() {
    if (installed) return true;
    if (typeof applyGeneratedServoProfile !== "function") return false;

    const current = applyGeneratedServoProfile;
    if (current.profileTranslationInstalled === true
      || /applyGeneratedServoProfileWithTranslation/.test(String(current.name || ""))) {
      current.profileTranslationInstalled = true;
      installed = true;
      return true;
    }

    const wrapped = function applyGeneratedServoProfileWithTranslationService(...args) {
      const output = current.apply(this, args);
      buildAndTranslateProgram();
      return output;
    };
    wrapped.profileTranslationInstalled = true;
    wrapped.previousApplyGeneratedServoProfile = current;

    applyGeneratedServoProfile = wrapped;
    window.applyGeneratedServoProfile = wrapped;
    installed = true;
    return true;
  }

  if (!install()) {
    throw new Error("Profile translation service loaded before the final servo override service.");
  }

  window.LabelerProfileTranslationService = Object.freeze({
    buildAndTranslateProgram,
    install,
    syncTranslatedRows
  });
})();
