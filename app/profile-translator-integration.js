"use strict";

(function connectProfileTranslator() {
  const TRANSLATOR_RELEASE_VERSION = "0.7.96";

  function selectedTranslatorProfile() {
    const profiles = typeof allMotionProfiles === "function" ? allMotionProfiles() : [];
    const selectedId = state.selectedMotionProfileId || state.defaultMotionProfileId || "automatic";
    return profiles.find((profile) => profile.id === selectedId) || profiles[0] || {
      id: "automatic",
      machineProfile: "AUTO",
      intents: [],
      builtIn: true
    };
  }

  function translatorMachineProfile(profile) {
    return typeof resolveProfileMachine === "function" ? resolveProfileMachine(profile) : "DEFAULT";
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

  if (typeof applyGeneratedServoProfile === "function") {
    const applyGeneratedServoProfileBeforeTranslation = applyGeneratedServoProfile;
    applyGeneratedServoProfile = function applyGeneratedServoProfileWithTranslation(...args) {
      const output = applyGeneratedServoProfileBeforeTranslation.apply(this, args);
      buildAndTranslateProgram();
      if (typeof normalizeServoProgramTableAngles === "function") {
        const normalized = normalizeServoProgramTableAngles(state.program);
        state.program = normalized.rows;
        state.tableAngleSequence = {
          valid: true,
          minimumStep: normalized.minimumStep,
          adjustedRows: normalized.adjustedRows,
          adjustedCount: normalized.adjustedRows.length
        };
      }
      return output;
    };
  }

  if (typeof validate === "function") {
    const validateBeforeTranslation = validate;
    validate = function validateWithTranslation(...args) {
      const notes = validateBeforeTranslation.apply(this, args);
      const translator = window.LabelerProfileTranslatorDriver;
      if (!translator?.validate || !state.motionTranslation) return notes;
      translator.validate(state.motionTranslation).forEach((issue) => {
        notes.push([issue.level, issue.message]);
      });
      return notes;
    };
  }

  if (typeof refreshMotionProfileSelection === "function") {
    const refreshBeforeTranslation = refreshMotionProfileSelection;
    refreshMotionProfileSelection = function refreshMotionProfileAndProgram(profileId) {
      const result = refreshBeforeTranslation.call(this, profileId);
      state.selectedMotionProfileId = profileId;
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      if (typeof render === "function") render();
      return result;
    };
  }

  const versionMeta = document.querySelector('meta[name="application-version"]');
  if (versionMeta) versionMeta.content = TRANSLATOR_RELEASE_VERSION;
})();
