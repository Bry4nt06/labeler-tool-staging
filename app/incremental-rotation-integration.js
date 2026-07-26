"use strict";

(function installIncrementalRotationProfile() {
  const RELEASE_VERSION = "0.9.2";
  const PROFILE_ID = "incremental-rotations";
  const RETRY_MS = 25;
  let installed = false;
  let generationWrapped = false;
  let diagnosticsWrapped = false;

  const PROFILE = Object.freeze({
    id: PROFILE_ID,
    name: "Incremental Rotations",
    description: "Continues bottle rotation between compatible TopModul processes instead of reversing to the shortest signed orientation. Requires inside wipe-down support on both members of an active aggregate pair and safely falls back when contact or speed limits are not satisfied.",
    machineProfile: "DEFAULT",
    intents: ["Hold", "Rotate", "Rotate", "Hold"],
    builtIn: true,
    plannerStrategy: PROFILE_ID
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function activeMap() {
    return typeof activeMachineMap === "function" ? activeMachineMap() : null;
  }

  function selectedProfileId() {
    return String(state.selectedMotionProfileId || state.defaultMotionProfileId || "automatic");
  }

  function profileSelected() {
    return selectedProfileId() === PROFILE_ID;
  }

  function installProfileLibraryEntry() {
    if (typeof allMotionProfiles !== "function" || allMotionProfiles.incrementalRotationProfile) return;
    const before = allMotionProfiles;
    const wrapped = function allMotionProfilesWithIncrementalRotations(...args) {
      const profiles = before.apply(this, args);
      return profiles.some((profile) => profile?.id === PROFILE_ID) ? profiles : [...profiles, PROFILE];
    };
    wrapped.incrementalRotationProfile = true;
    allMotionProfiles = wrapped;
    window.allMotionProfiles = wrapped;
  }

  function patchPlanner(name) {
    const driver = window[name];
    if (!driver?.buildPlan || driver.incrementalRotationProfile) return;
    const baseBuildPlan = driver.buildPlan.bind(driver);
    window[name] = Object.freeze({
      ...driver,
      incrementalRotationProfile: true,
      buildPlan(rows, options = {}) {
        if (String(options.profileId || "").toLowerCase() !== PROFILE_ID) return baseBuildPlan(rows, options);
        const plan = baseBuildPlan(rows, { ...options, profileId: "rest-correction" });
        return {
          ...plan,
          requestedProfileId: PROFILE_ID,
          profileId: PROFILE_ID,
          incrementalRotationStrategy: true,
          steps: (plan.steps || []).map((step) => ({
            ...step,
            requestedProfileId: PROFILE_ID,
            profileId: PROFILE_ID,
            incrementalRotationStrategy: true,
            reason: `${step.reason || "Mechanical event planned."} Incremental Rotations preserves the proven CMD 3/CMD 7 command grammar while optimizing equivalent bottle angles.`
          }))
        };
      }
    });
  }

  function transformContext() {
    const map = activeMap();
    return {
      map,
      machineType: map?.machineType || map?.name || "",
      applicationMode: state.applicationMode || map?.applicationMode || "apl",
      objects: map?.objects || [],
      aplObjects: state.aplMapObjects,
      coldGlueObjects: state.coldGlueMap,
      maxMoveRatio: state.maxMoveRatio,
      allowFallback: true
    };
  }

  function syncPlan(plan, rows, result) {
    if (!plan || !Array.isArray(plan.steps)) return;
    plan.incrementalRotation = result;
    plan.profileId = PROFILE_ID;
    plan.requestedProfileId = PROFILE_ID;
    plan.steps = rows.map((row, index) => ({
      ...(plan.steps[index] || {}),
      index,
      hmi: row.hmi ?? index + 1,
      plc: row.plc ?? index,
      tableAngle: number(row.tableAngle),
      plateAngle: number(row.plateAngle),
      tableEnd: number(rows[index + 1]?.tableAngle, number(row.tableAngle)),
      plateTarget: number(rows[index + 1]?.plateAngle, number(row.plateAngle)),
      action: String(row.action || ""),
      baseCommand: Number(row.baseCmd ?? row.cmd),
      requestedCommand: Number(row.plannerRequestedCommand ?? row.cmd),
      recommendedCommand: Number(row.cmd),
      intent: row.plannerIntent || (Number(row.cmd) === 7 ? "ROTATE" : "HOLD"),
      reason: row.plannerReason || "",
      incrementalRotation: Boolean(row.incrementalRotation),
      incrementalRotationDirection: row.incrementalRotationDirection || "",
      insideWipeObjectIds: row.incrementalRotationInsideObjectIds || []
    }));
  }

  function refreshDerivedState(result) {
    const rows = result.rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    state.program = rows;
    state.incrementalRotation = result;

    if (state.motionTranslation) {
      state.motionTranslation.rows = rows;
      state.motionTranslation.profileId = PROFILE_ID;
      state.motionTranslation.requestedProfileId = PROFILE_ID;
      state.motionTranslation.incrementalRotation = result;
      syncPlan(state.motionTranslation.plan, rows, result);
    }
    if (state.motionPlan) {
      state.motionPlan.rows = rows;
      state.motionPlan.incrementalRotation = result;
      if (state.motionPlan.translation) {
        state.motionPlan.translation.profileId = PROFILE_ID;
        state.motionPlan.translation.requestedProfileId = PROFILE_ID;
        state.motionPlan.translation.incrementalRotation = result;
      }
      syncPlan(state.motionPlan.planner, rows, result);
    }
    syncPlan(state.plannerPreview, rows, result);

    const grammar = window.LabelerMachineFamilyGrammarDriver;
    if (grammar?.annotateCorrectionChains) {
      const annotated = grammar.annotateCorrectionChains(rows, {
        ...transformContext(),
        rows,
        family: "TOPMODUL",
        machineFamily: "TOPMODUL"
      });
      state.program = annotated.rows;
      state.machineFamilyGrammar = {
        family: annotated.family,
        rule: annotated.rule,
        chains: annotated.chains,
        chainCount: annotated.chains.length
      };
      if (state.motionTranslation) state.motionTranslation.rows = state.program;
      if (state.motionPlan) state.motionPlan.rows = state.program;
      syncPlan(state.motionTranslation?.plan, state.program, result);
      syncPlan(state.motionPlan?.planner, state.program, result);
      syncPlan(state.plannerPreview, state.program, result);
    }
  }

  function runIncrementalTransform() {
    if (!profileSelected() || !Array.isArray(state.program) || !state.program.length) {
      state.incrementalRotation = null;
      return null;
    }
    const driver = window.LabelerIncrementalRotationDriver;
    if (!driver?.transform) return null;
    const result = driver.transform(state.program, transformContext());
    refreshDerivedState(result);
    return result;
  }

  function installGenerationHook() {
    if (generationWrapped || typeof applyGeneratedServoProfile !== "function") return;
    generationWrapped = true;
    const before = applyGeneratedServoProfile;
    applyGeneratedServoProfile = function applyGeneratedServoProfileWithIncrementalRotations(...args) {
      const output = before.apply(this, args);
      runIncrementalTransform();
      return output;
    };
  }

  function summaryText(result) {
    if (!result) return "Select Incremental Rotations and regenerate the servo program to evaluate the active map.";
    if (!result.eligible) return result.fallbacks?.[0]?.message || "The selected machine does not support this strategy.";
    if (!result.applied) {
      const missing = (result.fallbacks || []).filter((item) => item.code === "inside-wipe-missing");
      return missing.length
        ? `No continued turns were applied. ${missing.map((item) => item.message).join(" ")}`
        : "The existing profile already follows compatible rotation directions, or every candidate safely fell back to its referenced path.";
    }
    const before = result.baselineMetrics;
    const after = result.incrementalMetrics;
    return `${result.appliedMoves.length} inter-process turn${result.appliedMoves.length === 1 ? "" : "s"} continue the existing rotation direction. Direction reversals ${before.directionReversals} → ${after.directionReversals}; total commanded rotation ${before.totalAbsoluteRotation.toFixed(1)}° → ${after.totalAbsoluteRotation.toFixed(1)}°; maximum ratio ${before.maximumRatio.toFixed(1)}:1 → ${after.maximumRatio.toFixed(1)}:1.`;
  }

  function diagnosticsMarkup(result) {
    const applied = result?.appliedMoves || [];
    const fallbacks = result?.fallbacks || [];
    const status = !result || !result.eligible ? "REVIEW" : result.applied ? "ACTIVE" : fallbacks.length ? "FALLBACK" : "READY";
    return `<section class="incremental-rotation-panel" data-status="${status}" aria-label="Incremental rotation diagnostics">
      <div class="incremental-rotation-head">
        <div><h2>Incremental Rotations</h2><p>Continue bottle spin between compatible TopModul processes while preserving CMD 3/CMD 7 grammar and paired-aggregate wipe support.</p></div>
        <span>${status}</span>
      </div>
      <div class="incremental-rotation-summary">${escapeHtml(summaryText(result))}</div>
      ${applied.length ? `<details open><summary>Applied continued turns (${applied.length})</summary><div class="incremental-rotation-list">${applied.map((move) => `<article><strong>HMI ${move.hmi} • Aggregate ${move.departingAggregate}${move.destinationAggregate ? ` → ${move.destinationAggregate}` : ""}</strong><span>${escapeHtml(move.message)}</span><small>Inside support: ${escapeHtml(move.insideWipeObjectNames.join(", ") || "mapped inner wipe")}</small></article>`).join("")}</div></details>` : ""}
      ${fallbacks.length ? `<details${applied.length ? "" : " open"}><summary>Safe fallbacks (${fallbacks.length})</summary><div class="incremental-rotation-list">${fallbacks.map((item) => `<article><strong>${item.hmi ? `HMI ${item.hmi}` : "Profile"}</strong><span>${escapeHtml(item.message)}</span></article>`).join("")}</div></details>` : ""}
    </section>`;
  }

  function installStyles() {
    if (document.querySelector("#incrementalRotationStyles")) return;
    const style = document.createElement("style");
    style.id = "incrementalRotationStyles";
    style.textContent = `
      .incremental-rotation-panel { margin:0 0 7px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);font-size:9px; }
      .incremental-rotation-head { display:flex;align-items:flex-start;justify-content:space-between;gap:8px; }
      .incremental-rotation-head h2,.incremental-rotation-head p { margin:0; }
      .incremental-rotation-head h2 { font-size:13px; }
      .incremental-rotation-head p { margin-top:2px;color:var(--muted);font-size:8px;line-height:1.25; }
      .incremental-rotation-head>span { padding:3px 7px;border:1px solid var(--green);border-radius:999px;color:var(--green);font-size:8px;font-weight:800; }
      .incremental-rotation-panel[data-status="FALLBACK"] .incremental-rotation-head>span,.incremental-rotation-panel[data-status="REVIEW"] .incremental-rotation-head>span { border-color:#d79a3c;color:#ffc56b; }
      .incremental-rotation-summary { margin-top:6px;padding:6px 7px;border-left:3px solid var(--green);border-radius:5px;background:var(--input);line-height:1.3; }
      .incremental-rotation-panel details { margin-top:6px;border:1px solid var(--line);border-radius:6px;background:var(--panel-hi); }
      .incremental-rotation-panel summary { padding:5px 7px;cursor:pointer;font-weight:700; }
      .incremental-rotation-list { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:0 7px 7px; }
      .incremental-rotation-list article { min-width:0;padding:6px;border-left:3px solid var(--green);border-radius:5px;background:var(--input); }
      .incremental-rotation-list strong,.incremental-rotation-list span,.incremental-rotation-list small { display:block;overflow-wrap:anywhere; }
      .incremental-rotation-list span { margin-top:3px;line-height:1.25; }
      .incremental-rotation-list small { margin-top:3px;color:var(--muted);font-size:7px; }
      @media(max-width:700px){.incremental-rotation-list{grid-template-columns:1fr}.incremental-rotation-head{display:grid}.incremental-rotation-head>span{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function renderDiagnosticsPanel() {
    const diagnostics = document.querySelector("#diagnostics");
    if (!diagnostics) return;
    diagnostics.querySelector(".incremental-rotation-panel")?.remove();
    const timelineSlot = diagnostics.querySelector('[data-diagnostics-slot="timeline"]');
    const optimizerSlot = diagnostics.querySelector('[data-diagnostics-slot="optimizer"]');
    const anchor = timelineSlot || optimizerSlot || diagnostics.querySelector(".diagnostics-overview");
    anchor?.insertAdjacentHTML("afterend", diagnosticsMarkup(state.incrementalRotation));
  }

  function installDiagnosticsHook() {
    if (diagnosticsWrapped || typeof renderProgram !== "function") return;
    diagnosticsWrapped = true;
    const before = renderProgram;
    renderProgram = function renderProgramWithIncrementalDiagnostics(...args) {
      const output = before.apply(this, args);
      window.requestAnimationFrame(renderDiagnosticsPanel);
      return output;
    };
  }

  function installSelectionRefresh() {
    document.addEventListener("change", (event) => {
      if (event.target?.id !== "motionProfileSelect") return;
      if (event.target.value === PROFILE_ID) {
        state.selectedMotionProfileId = PROFILE_ID;
        if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      }
    }, true);
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || typeof allMotionProfiles !== "function"
      || typeof applyGeneratedServoProfile !== "function"
      || !window.LabelerIncrementalRotationDriver) return false;

    installed = true;
    installProfileLibraryEntry();
    patchPlanner("LabelerMotionPlannerDriver");
    patchPlanner("LabelerMechanicalEventPlannerDriver");
    installGenerationHook();
    installStyles();
    installDiagnosticsHook();
    installSelectionRefresh();

    const versionMeta = document.querySelector('meta[name="application-version"]');
    if (versionMeta) versionMeta.content = RELEASE_VERSION;
    return true;
  }

  function waitForDependencies() {
    if (install()) return;
    window.setTimeout(waitForDependencies, RETRY_MS);
  }

  waitForDependencies();
})();
