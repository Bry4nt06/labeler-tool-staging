"use strict";

(function installServoPipelineValidation() {
  const VALIDATOR_RELEASE_VERSION = "0.8.4";
  let installed = false;

  function activeValidationPlan() {
    return state.motionTranslation?.plan
      || state.motionPlan?.planner
      || state.plannerPreview
      || null;
  }

  function activeValidationMachineProfile() {
    return String(
      state.motionTranslation?.machineProfile
      || state.motionPlan?.translation?.machineProfile
      || state.program?.find((row) => row?.translatedMachineProfile)?.translatedMachineProfile
      || "DEFAULT"
    ).toUpperCase();
  }

  function activeValidationProfileId() {
    return String(
      state.motionTranslation?.profileId
      || state.motionPlan?.translation?.profileId
      || state.selectedMotionProfileId
      || state.defaultMotionProfileId
      || "rest-correction"
    );
  }

  function runServoPipelineValidation() {
    const validator = window.LabelerServoPipelineValidator;
    if (!validator?.analyze) return null;
    const result = validator.analyze({
      rows: Array.isArray(state.program) ? state.program : [],
      plan: activeValidationPlan(),
      translation: state.motionTranslation || state.motionPlan?.translation || null,
      machineProfile: activeValidationMachineProfile(),
      profileId: activeValidationProfileId(),
      maxMoveRatio: state.maxMoveRatio,
      tolerance: 0.001
    });
    state.servoPipelineValidation = result;
    return result;
  }

  function installValidatorStyles() {
    if (document.querySelector("#servoPipelineValidatorStyles")) return;
    const style = document.createElement("style");
    style.id = "servoPipelineValidatorStyles";
    style.textContent = `
      .pipeline-validation-summary { grid-column:1/-1;display:grid;grid-template-columns:auto repeat(3,minmax(52px,auto));gap:5px;align-items:center;padding:7px 8px;border:1px solid var(--line);border-radius:7px;background:var(--panel-hi); }
      .pipeline-validation-summary strong { font-size:10px; }
      .pipeline-validation-summary span { padding:3px 5px;border-radius:5px;background:var(--input);font-size:8px;text-align:center;white-space:nowrap; }
      .pipeline-validation-summary[data-status="PASS"] strong { color:var(--green); }
      .pipeline-validation-summary[data-status="REVIEW"] strong { color:#ffc56b; }
      .pipeline-validation-summary[data-status="FAIL"] strong { color:#ff8181; }
      .pipeline-validation-banner { margin-bottom:6px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:var(--panel-hi);font-size:9px;line-height:1.25; }
      .pipeline-validation-banner strong { color:var(--green); }
      .pipeline-validation-banner[data-status="REVIEW"] strong { color:#ffc56b; }
      .pipeline-validation-banner[data-status="FAIL"] strong { color:#ff8181; }
    `;
    document.head.appendChild(style);
  }

  function renderPipelineSummary() {
    const result = runServoPipelineValidation();
    if (!result || !els?.validationDetails || !els?.validationList) return;

    els.validationDetails.querySelector(".pipeline-validation-summary")?.remove();
    const summary = document.createElement("div");
    summary.className = "pipeline-validation-summary";
    summary.dataset.status = result.status;
    summary.innerHTML = `
      <strong>Servo Pipeline ${result.status}</strong>
      <span>${result.summary.bad} faults</span>
      <span>${result.summary.warn} warnings</span>
      <span>${result.rowCount} CMD rows</span>`;
    els.validationDetails.appendChild(summary);

    els.validationList.querySelector(".pipeline-validation-banner")?.remove();
    const banner = document.createElement("div");
    banner.className = "pipeline-validation-banner";
    banner.dataset.status = result.status;
    banner.innerHTML = `<strong>${result.machineProfile} • ${result.profileId}</strong> — mechanical events, translated commands, references, speed envelope, terminal Rest, and table-angle order validated.`;
    els.validationList.prepend(banner);
  }

  function pipelineIssueNotes(result) {
    if (!result) return [];
    return result.issues
      .filter((issue) => issue.level !== "ok")
      .map((issue) => [issue.level, `[${String(issue.category || "validator").toUpperCase()}] ${issue.message}`, {
        pipelineCode: issue.code,
        hmi: issue.hmi,
        eventId: issue.eventId
      }]);
  }

  function installHooks() {
    if (installed || typeof validate !== "function" || typeof renderValidation !== "function") return false;
    installed = true;
    installValidatorStyles();

    const validateBeforePipeline = validate;
    validate = function validateWithServoPipeline(...args) {
      const notes = validateBeforePipeline.apply(this, args);
      const result = runServoPipelineValidation();
      const existing = new Set(notes.map((note) => String(note?.[1] || "")));
      pipelineIssueNotes(result).forEach((note) => {
        if (!existing.has(note[1])) notes.push(note);
      });
      return notes;
    };

    const renderValidationBeforePipeline = renderValidation;
    renderValidation = function renderValidationWithPipeline(...args) {
      const output = renderValidationBeforePipeline.apply(this, args);
      renderPipelineSummary();
      return output;
    };

    const versionMeta = document.querySelector('meta[name="application-version"]');
    if (versionMeta) versionMeta.content = VALIDATOR_RELEASE_VERSION;
    const versionStatus = document.querySelector("#updateCheckStatus");
    if (versionStatus) versionStatus.textContent = `Version ${VALIDATOR_RELEASE_VERSION} • Updates are checked automatically.`;

    if (typeof render === "function") render();
    return true;
  }

  function waitForApplication() {
    if (installHooks()) return;
    window.setTimeout(waitForApplication, 25);
  }

  if (document.readyState === "complete") waitForApplication();
  else window.addEventListener("load", waitForApplication, { once: true });
})();
