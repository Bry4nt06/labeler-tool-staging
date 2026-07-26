"use strict";

(function installInteractionAndProfileHotfix() {
  const PROFILE_ID = "incremental-rotations";
  const RETRY_MS = 25;
  let installed = false;
  let generationGuardInstalled = false;
  let profileApplyPending = false;
  let pausedWorkbench = null;

  function selectedProfileId() {
    return String(state?.selectedMotionProfileId || state?.defaultMotionProfileId || "automatic");
  }

  function profileDefinition(profileId = selectedProfileId()) {
    const profiles = typeof allMotionProfiles === "function" ? allMotionProfiles() : [];
    return profiles.find((profile) => profile?.id === profileId) || profiles[0] || null;
  }

  function pauseWorkbenchMutationLoop() {
    const workbench = document.querySelector(".servo-motion-workbench");
    if (!workbench || workbench.classList.contains("servo-motion-workbench-paused")) return;
    pausedWorkbench = workbench;
    workbench.classList.remove("servo-motion-workbench");
    workbench.classList.add("servo-motion-workbench-paused");
  }

  function resumeWorkbenchMutationLoop() {
    const workbench = pausedWorkbench || document.querySelector(".servo-motion-workbench-paused");
    if (!workbench) return;
    workbench.classList.remove("servo-motion-workbench-paused");
    workbench.classList.add("servo-motion-workbench");
    pausedWorkbench = null;
  }

  function setMapInteraction(active) {
    state.mapPointerInteractionActive = Boolean(active);
    document.documentElement.classList.toggle("map-pointer-interaction-active", Boolean(active));
    if (active) pauseWorkbenchMutationLoop();
    else resumeWorkbenchMutationLoop();
  }

  function installMapInteractionGuard() {
    const svg = document.querySelector("#mapSvg");
    if (!svg || svg.dataset.interactionProfileHotfix === "true") return;
    svg.dataset.interactionProfileHotfix = "true";
    svg.style.touchAction = "none";

    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      setMapInteraction(true);
    }, true);

    const finish = () => setMapInteraction(false);
    svg.addEventListener("pointerup", finish, true);
    svg.addEventListener("pointercancel", finish, true);
    svg.addEventListener("lostpointercapture", finish, true);
    window.addEventListener("blur", finish);
  }

  function installGenerationGuard() {
    if (generationGuardInstalled || typeof applyGeneratedServoProfile !== "function") return;
    generationGuardInstalled = true;
    const before = applyGeneratedServoProfile;
    applyGeneratedServoProfile = function applyGeneratedServoProfileWithoutPointerMoveRebuild(...args) {
      if (state.mapPointerInteractionActive) {
        state.mapProfileRegenerationPending = true;
        return state.program;
      }
      const output = before.apply(this, args);
      state.mapProfileRegenerationPending = false;
      return output;
    };
  }

  function feedbackText() {
    const profile = profileDefinition();
    if (!profile) return "No motion profile is available.";
    if (profile.id !== PROFILE_ID) return `${profile.name} applied to the generated servo program.`;

    const result = state.incrementalRotation;
    if (!result) return "Incremental Rotations selected. Regenerating the servo program…";
    if (!result.eligible) return result.fallbacks?.[0]?.message || "Incremental Rotations is not available for the active machine.";
    if (result.applied) {
      const before = result.baselineMetrics || {};
      const after = result.incrementalMetrics || {};
      return `Incremental Rotations applied ${result.appliedMoves?.length || 0} continued turn${result.appliedMoves?.length === 1 ? "" : "s"}. Direction reversals ${before.directionReversals ?? 0} → ${after.directionReversals ?? 0}; total bottle rotation ${Number(before.totalAbsoluteRotation || 0).toFixed(1)}° → ${Number(after.totalAbsoluteRotation || 0).toFixed(1)}°.`;
    }
    if (result.fallbacks?.length) return `Incremental Rotations evaluated the active map but retained the referenced path. ${result.fallbacks[0].message}`;
    return "The current servo path already follows the selected incremental direction; no angle replacement was required.";
  }

  function renderProfileFeedback() {
    const summary = document.querySelector("#motionProfileSummary");
    if (summary) {
      summary.textContent = feedbackText();
      summary.dataset.profileApplied = selectedProfileId();
    }

    const workbench = document.querySelector(".servo-motion-workbench, .servo-motion-workbench-paused");
    if (!workbench) return;
    let status = workbench.querySelector(".motion-profile-application-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "motion-profile-application-status";
      workbench.querySelector("#motionProfileSummary")?.insertAdjacentElement("afterend", status);
    }
    if (status) {
      const result = state.incrementalRotation;
      status.dataset.status = selectedProfileId() === PROFILE_ID
        ? result?.applied ? "ACTIVE" : result?.fallbacks?.length ? "FALLBACK" : "READY"
        : "ACTIVE";
      status.textContent = feedbackText();
    }
  }

  function regenerateSelectedProfile() {
    if (profileApplyPending) return;
    profileApplyPending = true;
    window.setTimeout(() => {
      profileApplyPending = false;
      try {
        if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
        if (typeof saveCurrentSettings === "function") saveCurrentSettings();
        if (typeof render === "function") render();
        window.requestAnimationFrame(renderProfileFeedback);
      } catch (error) {
        console.error("Motion profile regeneration failed", error);
        const status = document.querySelector(".motion-profile-application-status");
        if (status) {
          status.dataset.status = "FAIL";
          status.textContent = `Unable to apply the selected motion profile: ${error.message}`;
        }
      }
    }, 0);
  }

  function installProfileSelectionHandler() {
    if (document.documentElement.dataset.profileApplicationHotfix === "true") return;
    document.documentElement.dataset.profileApplicationHotfix = "true";
    document.addEventListener("change", (event) => {
      if (event.target?.id !== "motionProfileSelect") return;
      state.selectedMotionProfileId = String(event.target.value || "automatic");
      const profile = profileDefinition(state.selectedMotionProfileId);
      const input = document.querySelector("#servoIntentInput");
      if (input && profile?.intents) input.value = profile.intents.join(", ");
      renderProfileFeedback();
      regenerateSelectedProfile();
    }, true);
  }

  function installRenderFeedbackHook() {
    if (typeof renderProgram !== "function" || renderProgram.interactionProfileHotfix) return;
    const before = renderProgram;
    const wrapped = function renderProgramWithProfileFeedback(...args) {
      const output = before.apply(this, args);
      window.requestAnimationFrame(renderProfileFeedback);
      return output;
    };
    wrapped.interactionProfileHotfix = true;
    renderProgram = wrapped;
  }

  function installStyles() {
    if (document.querySelector("#interactionProfileHotfixStyles")) return;
    const style = document.createElement("style");
    style.id = "interactionProfileHotfixStyles";
    style.textContent = `
      #mapSvg{touch-action:none;pointer-events:auto}
      .map-pointer-interaction-active #mapSvg{cursor:grabbing}
      .servo-motion-workbench-paused{width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;margin:0 0 8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font-size:11px}
      .motion-profile-application-status{margin:0 0 7px;padding:6px 8px;border-left:3px solid var(--green);border-radius:5px;background:var(--input);font-size:9px;line-height:1.3}
      .motion-profile-application-status[data-status="FALLBACK"]{border-left-color:#d79a3c;color:#ffc56b}
      .motion-profile-application-status[data-status="FAIL"]{border-left-color:#d85b5b;color:#ff8181}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || typeof applyGeneratedServoProfile !== "function"
      || typeof renderProgram !== "function") return false;

    installed = true;
    installStyles();
    installMapInteractionGuard();
    installGenerationGuard();
    installProfileSelectionHandler();
    installRenderFeedbackHook();
    window.requestAnimationFrame(renderProfileFeedback);
    return true;
  }

  function waitForDependencies() {
    if (install()) return;
    window.setTimeout(waitForDependencies, RETRY_MS);
  }

  waitForDependencies();
})();
