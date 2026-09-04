"use strict";

(function installTopModulMainDriveIsolationUi(global) {
  const state = new Map();
  const encoderMotion = new Map();

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfTopModulMainDriveIsolationStyles")) return;
    const style = document.createElement("style");
    style.id = "sfTopModulMainDriveIsolationStyles";
    style.textContent = `
      .sf-main-drive-isolation { display:grid; gap:12px; }
      .sf-main-drive-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; }
      .sf-main-drive-cell { padding:9px 10px; border:1px solid var(--line); border-radius:7px; background:var(--input); display:grid; gap:4px; }
      .sf-main-drive-cell small { color:var(--muted); text-transform:uppercase; letter-spacing:.05em; font-size:9px; }
      .sf-main-drive-cell code,.sf-main-drive-cell strong { overflow-wrap:anywhere; }
      .sf-main-drive-steps,.sf-main-drive-watch { display:grid; gap:7px; }
      .sf-main-drive-step { display:grid; grid-template-columns:26px 1fr; gap:8px; padding:8px 9px; border:1px solid var(--line); border-radius:7px; background:var(--input); }
      .sf-main-drive-step > strong:first-child { width:24px; height:24px; border-radius:999px; display:grid; place-items:center; border:1px solid var(--line); }
      .sf-main-drive-step span,.sf-main-drive-watch-row { display:grid; gap:3px; }
      .sf-main-drive-step small,.sf-main-drive-watch-row small { color:var(--muted); line-height:1.4; }
      .sf-main-drive-watch-row { padding:8px 9px; border:1px solid var(--line); border-radius:7px; background:var(--input); }
      .sf-main-drive-watch-row code { overflow-wrap:anywhere; }
      .sf-main-drive-observation { display:grid; gap:9px; padding:10px; border:1px solid var(--line); border-radius:7px; }
      .sf-main-drive-choice-row { display:flex; flex-wrap:wrap; gap:6px; }
      .sf-main-drive-choice-row button { padding:7px 9px; }
      .sf-main-drive-choice-row button[aria-pressed="true"] { border-color:var(--green); box-shadow:inset 0 0 0 1px rgba(65,200,137,.25); }
      .sf-main-drive-evaluation { padding:10px 11px; border-left:3px solid var(--line); background:var(--input); border-radius:5px; display:grid; gap:5px; }
      .sf-main-drive-evaluation[data-severity="direct"] { border-left-color:var(--green); }
      .sf-main-drive-evaluation[data-severity="hold"] { border-left-color:#d99a3b; }
      .sf-main-drive-evaluation p,.sf-main-drive-evaluation small { margin:0; line-height:1.45; }
      .sf-main-drive-evaluation small { color:var(--muted); }
      .sf-main-drive-related,.sf-main-drive-handoff-actions { display:flex; flex-wrap:wrap; gap:6px; }
      .sf-main-drive-related button,.sf-main-drive-handoff-actions button { padding:6px 8px; }
      .sf-main-drive-boundary,.sf-main-drive-source { font-size:11px; color:var(--muted); line-height:1.45; }
      .sf-main-drive-handoff { margin-top:8px; padding:10px 11px; border:1px solid var(--line); border-left:3px solid #d99a3b; border-radius:6px; display:grid; gap:7px; background:var(--input); }
      .sf-main-drive-handoff p,.sf-main-drive-handoff small { margin:0; line-height:1.45; }
      .sf-main-drive-handoff small { color:var(--muted); }
      @media print { .sf-main-drive-choice-row,.sf-main-drive-handoff-actions { display:none !important; } }
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function openFault(number) {
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button) return;
    input.value = String(number);
    button.click();
  }

  function choiceButton(plan, group, value, label, selected) {
    return `<button type="button" class="secondary-button" data-main-drive-plan="${esc(plan.id)}" data-main-drive-group="${esc(group)}" data-main-drive-value="${esc(value)}" aria-pressed="${selected === value ? "true" : "false"}">${esc(label)}</button>`;
  }

  function choiceGroup(plan, observation, group, prompt, choices) {
    return `<div><small>${esc(prompt)}</small><div class="sf-main-drive-choice-row">${choices.map(([value, label]) => choiceButton(plan, group, value, label, observation[group])).join("")}</div></div>`;
  }

  function observationMarkup(plan) {
    const observation = state.get(plan.id) || {};
    const groups = [];
    if (plan.number === 480) {
      groups.push(choiceGroup(plan, observation, "overloadPermissive", "What is E2001_MS101_MainDriveOverload doing?", [["made", "Made / true"], ["open", "Open / false"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "driveHealthy", "Are DriveConETH_01 O_MotOK and O_NoFault healthy?", [["yes", "Both healthy"], ["no", "One/both not healthy"], ["unknown", "Not verified"]]));
    } else if (plan.number === 482) {
      groups.push(choiceGroup(plan, observation, "timeRelayFault", "Is E2001_M_ElectrBrakeFaultTimeRelay active?", [["active", "Active"], ["clear", "Clear"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "contactorCommand", "Raw C102 command bit", [["0", "0"], ["1", "1"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "contactorFeedback", "Raw C101 feedback bit", [["0", "0"], ["1", "1"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "driveEnable", "Raw main-drive enable bit", [["0", "0"], ["1", "1"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "mainDriveOffDone", "StartStop.EnableMainDriveOFF.DN", [["yes", "Done"], ["no", "Not done"], ["unknown", "Not verified"]]));
    } else if (plan.number === 490) {
      groups.push(choiceGroup(plan, observation, "timeRelayFault", "Is E2001_M_ElectrBrakeFaultTimeRelay active?", [["active", "Active"], ["clear", "Clear"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "delayFeedbackAgreement", "Does C102 delayed feedback agree with the expected sequence?", [["agree", "Agrees"], ["mismatch", "Mismatch"], ["unknown", "Not verified"]]));
    } else if (plan.number === 669) {
      groups.push(choiceGroup(plan, observation, "zeroSpeedOnDelayDone", "Is ElectrBrake.ZeroSpeedOnDel.DN complete?", [["yes", "Done"], ["no", "Not done"], ["unknown", "Not verified"]]));
      groups.push(choiceGroup(plan, observation, "electricBrakeZeroSpeed", "What is ElectrBrake.ZeroSpeed?", [["yes", "True / standstill"], ["no", "False / no standstill"], ["unknown", "Not verified"]]));
    }

    const library = global.ServoForgeTroubleshootingLibrary;
    const evaluation = library?.evaluateTopModulMainDriveIsolation?.(plan.number, observation);
    const related = evaluation?.related?.length
      ? `<div><small>Related source-backed checks</small><div class="sf-main-drive-related">${evaluation.related.map((number) => `<button type="button" class="secondary-button" data-main-drive-open-fault="${esc(number)}">Open ${esc(number)}</button>`).join("")}</div></div>`
      : "";
    return `<div class="sf-main-drive-observation">
      <strong>Read-only live isolation</strong>
      <small>These choices only interpret observed PLC/drive states; they do not write, force, reset, or bypass anything.</small>
      ${groups.join("")}
      ${evaluation ? `<div class="sf-main-drive-evaluation" data-severity="${esc(evaluation.severity || "observe")}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p>${evaluation.next ? `<small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
      ${related}
    </div>`;
  }

  function markup(plan) {
    return `<section class="sf-result-section sf-main-drive-isolation" data-topmodul-main-drive-isolation="${esc(plan.id)}">
      <h4>Main-drive isolation — source-backed</h4>
      <div class="sf-main-drive-grid">
        <div class="sf-main-drive-cell"><small>Scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-main-drive-cell"><small>Fault family</small><strong>${esc(plan.family)}</strong></div>
        <div class="sf-main-drive-cell"><small>Direct producer</small><code>${esc(plan.producer)}</code></div>
        <div class="sf-main-drive-cell"><small>PLC source</small><strong>${esc(plan.source?.file || "")}</strong></div>
      </div>
      <div class="sf-main-drive-steps">${(plan.steps || []).map((step) => `<div class="sf-main-drive-step"><strong>${esc(step.order)}</strong><span><strong>${esc(step.label)}</strong><small>${esc(step.detail)}</small></span></div>`).join("")}</div>
      <div class="sf-main-drive-watch"><strong>Watch these values before hardware replacement</strong>${(plan.watchPoints || []).map((row) => `<div class="sf-main-drive-watch-row"><code>${esc(row.tag)}</code><strong>${esc(row.role)}</strong><small>${esc(row.relationship)}</small><small>${esc(row.interpretation)}</small>${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}</div>`).join("")}</div>
      ${observationMarkup(plan)}
      <div class="sf-main-drive-source"><strong>Source references:</strong> ${esc((plan.sourceRefs || []).join(" • "))}</div>
      <div class="sf-main-drive-boundary"><strong>Boundary:</strong> ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function renderMainDrive() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getTopModulMainDriveIsolationPlan || !result || result.hidden) return;
    const code = resultCode(result);
    const plan = library.getTopModulMainDriveIsolationPlan(code);
    const existing = result.querySelector("[data-topmodul-main-drive-isolation]");
    if (!plan) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.topmodulMainDriveIsolation === plan.id) return;
    existing?.remove();
    const anchor = result.querySelector("[data-topmodul-process-trace]")
      || result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(plan));
  }

  function refreshMainDrive(plan) {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const existing = result.querySelector("[data-topmodul-main-drive-isolation]");
    if (existing?.dataset.topmodulMainDriveIsolation === plan.id) existing.outerHTML = markup(plan);
    else renderMainDrive();
  }

  function handoffMarkup(handoff) {
    return `<div class="sf-main-drive-handoff" data-topmodul-no-motion-handoff="${esc(handoff.id)}">
      <strong>${esc(handoff.title)}</strong>
      <p>${esc(handoff.guidance)}</p>
      <div class="sf-main-drive-handoff-actions">${handoff.candidates.map((row) => `<button type="button" class="secondary-button" data-main-drive-open-fault="${esc(row.number)}">${esc(row.number)} · ${esc(row.title)}</button>`).join("")}</div>
      <small>${esc(handoff.excluded?.map((row) => `${row.number}: ${row.reason}`).join(" ") || "")}</small>
    </div>`;
  }

  function renderNoMotionHandoff() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.evaluateTopModulEncoderIsolation || !result || result.hidden) return;
    const code = resultCode(result);
    const existing = result.querySelector("[data-topmodul-no-motion-handoff]");
    if (encoderMotion.get(code) !== "no") {
      existing?.remove();
      return;
    }
    const evaluation = library.evaluateTopModulEncoderIsolation(code, { motion: "no" });
    if (!evaluation?.handoff) {
      existing?.remove();
      return;
    }
    const encoderPanel = result.querySelector("[data-topmodul-encoder-isolation]");
    if (!encoderPanel) return;
    if (existing?.dataset.topmodulNoMotionHandoff === evaluation.handoff.id) return;
    existing?.remove();
    const evaluationNode = encoderPanel.querySelector(".sf-encoder-evaluation") || encoderPanel;
    evaluationNode.insertAdjacentHTML("afterend", handoffMarkup(evaluation.handoff));
  }

  function render() {
    renderMainDrive();
    renderNoMotionHandoff();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

    result.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-main-drive-group]");
      if (choice) {
        const library = global.ServoForgeTroubleshootingLibrary;
        const plan = library?.getTopModulMainDriveIsolationPlan?.(resultCode(result));
        if (!plan) return;
        const next = { ...(state.get(plan.id) || {}) };
        next[choice.dataset.mainDriveGroup] = choice.dataset.mainDriveValue;
        state.set(plan.id, next);
        refreshMainDrive(plan);
        return;
      }

      const open = event.target.closest("[data-main-drive-open-fault]");
      if (open) {
        openFault(open.dataset.mainDriveOpenFault);
        return;
      }

      const encoderChoice = event.target.closest("[data-encoder-group='motion']");
      if (encoderChoice) {
        const code = resultCode(result);
        encoderMotion.set(code, encoderChoice.dataset.encoderValue);
        setTimeout(renderNoMotionHandoff, 0);
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-entry],[data-topmodul-open-fault],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
