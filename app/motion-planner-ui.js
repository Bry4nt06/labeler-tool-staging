"use strict";

function activeMotionPlannerProfileId() {
  return state.selectedMotionProfileId || state.defaultMotionProfileId || "automatic";
}

function motionIntentDisplayName(intent) {
  return String(intent || "HOLD").replaceAll("_", " ");
}

function commandDisplayForPlannerRow(row) {
  if (typeof activeMachineUsesAutocolCommands === "function" && activeMachineUsesAutocolCommands()) {
    return typeof autocolCommandLabel === "function" ? autocolCommandLabel(row) : `CMD ${row.cmd}`;
  }
  return `CMD ${row.cmd}`;
}

function currentMechanicalMotionPlan() {
  const planner = window.LabelerMotionPlannerDriver;
  if (!planner?.buildPlan) return null;
  const rows = typeof programSegments === "function" ? programSegments(state.program) : state.program;
  return planner.buildPlan(rows, { profileId: activeMotionPlannerProfileId() });
}

function installMotionPlannerUiStyles() {
  if (document.querySelector("#motionPlannerUiStyles")) return;
  const style = document.createElement("style");
  style.id = "motionPlannerUiStyles";
  style.textContent = `
    .mechanical-timeline { margin:0 0 8px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden; }
    .mechanical-timeline-head { display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px; }
    .mechanical-timeline-head h3,.mechanical-timeline-head p { margin:0; }
    .mechanical-timeline-head h3 { font-size:12px; }
    .mechanical-timeline-head p { margin-top:2px;color:var(--muted);font-size:9px; }
    .mechanical-timeline-summary { display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end; }
    .mechanical-timeline-summary span { padding:3px 6px;border:1px solid var(--line);border-radius:999px;background:var(--input);font-size:8px;white-space:nowrap; }
    .mechanical-timeline-track { display:flex;gap:4px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:thin; }
    .mechanical-event { flex:0 0 126px;min-width:0;padding:5px;border:1px solid var(--line);border-radius:6px;background:var(--panel-hi); }
    .mechanical-event strong,.mechanical-event small,.mechanical-event span { display:block;overflow-wrap:anywhere; }
    .mechanical-event strong { font-size:9px;line-height:1.1; }
    .mechanical-event span { margin-top:2px;font-size:8px;color:var(--green);font-weight:700; }
    .mechanical-event small { margin-top:2px;color:var(--muted);font-size:7px;line-height:1.15; }
    .planner-action-cell { min-width:190px; }
    .planner-action-display { display:grid;gap:2px; }
    .planner-action-line { font-size:9px;font-weight:700;line-height:1.1; }
    .planner-action-line .planner-intent { color:var(--green); }
    .planner-action-display input { width:100%;min-width:0;font-size:9px; }
    #program>table th:last-child,#program>table td:last-child { width:22%; }
  `;
  document.head.appendChild(style);
}

function mechanicalTimelineMarkup(plan) {
  if (!plan?.steps?.length) return "";
  const summary = Object.entries(plan.summary || {})
    .map(([intent, count]) => `<span>${motionIntentDisplayName(intent)} ${count}</span>`)
    .join("");
  const events = plan.steps.map((step) => {
    const row = (typeof programSegments === "function" ? programSegments(state.program) : state.program)[step.index] || {};
    return `<article class="mechanical-event" title="${String(step.reason || "").replace(/"/g, "&quot;")}">
      <strong>${Number.isFinite(step.tableAngle) ? `${step.tableAngle.toFixed(1)} deg` : "--"} • HMI ${step.hmi}</strong>
      <span>${commandDisplayForPlannerRow(row)} • ${motionIntentDisplayName(step.intent)}</span>
      <small>${step.action || "Mechanical event"}</small>
    </article>`;
  }).join("");
  return `<section class="mechanical-timeline" aria-label="Mechanical motion timeline">
    <div class="mechanical-timeline-head"><div><h3>Mechanical Timeline</h3><p>Generated CMD lines remain visible. The planner intent is shown beside each command and action.</p></div><div class="mechanical-timeline-summary">${summary}</div></div>
    <div class="mechanical-timeline-track">${events}</div>
  </section>`;
}

function applyPlannerToProgramTable(plan) {
  const rows = document.querySelectorAll("#program tbody tr[data-program-hmi]");
  const sourceRows = typeof programSegments === "function" ? programSegments(state.program) : state.program;
  rows.forEach((tr, index) => {
    const step = plan?.steps?.[index];
    const row = sourceRows[index];
    const actionCell = tr.lastElementChild;
    const actionInput = actionCell?.querySelector("input");
    if (!step || !row || !actionCell || !actionInput) return;
    actionCell.classList.add("planner-action-cell");
    const originalAction = actionInput.value;
    const wrapper = document.createElement("div");
    wrapper.className = "planner-action-display";
    const line = document.createElement("div");
    line.className = "planner-action-line";
    line.innerHTML = `${commandDisplayForPlannerRow(row)} • <span class="planner-intent">${motionIntentDisplayName(step.intent)}</span>`;
    actionInput.replaceWith(wrapper);
    wrapper.appendChild(line);
    wrapper.appendChild(actionInput);
    actionInput.value = originalAction;
    tr.dataset.motionIntent = step.intent;
    tr.title = `${commandDisplayForPlannerRow(row)} • ${motionIntentDisplayName(step.intent)} • ${step.reason}`;
  });
}

function enhanceProgramWithMotionPlanner() {
  installMotionPlannerUiStyles();
  const program = document.querySelector("#program");
  if (!program) return;
  const plan = currentMechanicalMotionPlan();
  state.motionPlan = plan;
  program.querySelector(".mechanical-timeline")?.remove();
  const table = program.querySelector(":scope > table");
  if (table && plan) table.insertAdjacentHTML("beforebegin", mechanicalTimelineMarkup(plan));
  applyPlannerToProgramTable(plan);
}

if (typeof renderProgram === "function") {
  const renderProgramBeforeMotionPlanner = renderProgram;
  renderProgram = function renderProgramWithMotionPlanner(...args) {
    const result = renderProgramBeforeMotionPlanner.apply(this, args);
    enhanceProgramWithMotionPlanner();
    return result;
  };
}
