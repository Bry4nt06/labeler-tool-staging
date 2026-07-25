"use strict";

function removeZoneSiteControls() {
  document.querySelector("#developerMenu")?.remove();
  document.querySelector("#mapZone")?.closest("label")?.remove();
  document.querySelector("#mapSite")?.closest("label")?.remove();
  document.querySelector("#buildInputs .zone-site-selection")?.remove();
}

if (typeof mapsForMapLibraryLocation === "function") {
  mapsForMapLibraryLocation = () => [...state.mapLibrary];
}

if (typeof renderBuildInputs === "function") {
  const renderBuildInputsBase = renderBuildInputs;
  renderBuildInputs = function renderBuildInputsWithoutZoneSite(...args) {
    const result = renderBuildInputsBase.apply(this, args);
    document.querySelector("#buildInputs .zone-site-selection")?.remove();
    return result;
  };
}

const quadrantControl = document.querySelector("#showQuadrantReferences")?.closest("label");
const overlayPanel = document.querySelector(".map-overlay-control");
if (quadrantControl && overlayPanel) overlayPanel.appendChild(quadrantControl);

function installServoMotionLibraryStyles() {
  if (document.querySelector("#servoMotionLibraryStyles")) return;
  const style = document.createElement("style");
  style.id = "servoMotionLibraryStyles";
  style.textContent = `
    .servo-motion-workbench { margin: 0 0 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .servo-motion-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .servo-motion-head h2, .servo-motion-head p { margin: 0; }
    .servo-motion-head p { margin-top: 4px; color: var(--muted); }
    .servo-motion-status { padding: 5px 9px; border: 1px solid var(--green); border-radius: 999px; color: var(--green); white-space: nowrap; }
    .servo-motion-controls { display: grid; grid-template-columns: minmax(180px, 0.7fr) minmax(240px, 1.3fr) auto; gap: 10px; align-items: end; margin-bottom: 12px; }
    .servo-motion-controls label { display: grid; gap: 5px; }
    .servo-motion-controls textarea { min-height: 74px; resize: vertical; }
    .servo-motion-grid { display: grid; grid-template-columns: repeat(7, minmax(105px, 1fr)); gap: 8px; }
    .servo-move-card { min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-hi); cursor: pointer; }
    .servo-move-card[aria-selected="true"] { border-color: var(--green); box-shadow: inset 0 0 0 1px var(--green); }
    .servo-move-code { display: inline-grid; place-items: center; width: 27px; height: 27px; margin-bottom: 7px; border-radius: 50%; background: var(--input); font-weight: 800; }
    .servo-move-card strong, .servo-move-card small { display: block; }
    .servo-move-card small { margin-top: 4px; color: var(--muted); }
    .servo-motion-detail { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(300px, 1.2fr); gap: 12px; margin-top: 12px; }
    .servo-motion-detail > div { padding: 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--input); }
    .servo-motion-detail h3 { margin: 0 0 7px; }
    .servo-motion-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .servo-motion-meta span { padding: 5px 7px; border-radius: 6px; background: var(--panel); }
    .servo-intent-output { display: flex; flex-wrap: wrap; gap: 6px; min-height: 36px; align-items: center; }
    .servo-intent-chip { padding: 5px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); }
    .servo-intent-error { color: #ff8181; }
    @media (max-width: 1100px) { .servo-motion-grid { grid-template-columns: repeat(4, minmax(110px, 1fr)); } }
    @media (max-width: 760px) { .servo-motion-controls, .servo-motion-detail { grid-template-columns: 1fr; } .servo-motion-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); } }
  `;
  document.head.appendChild(style);
}

function activeServoMotionProfileName() {
  const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
  const machine = String(map?.machineType || "").toUpperCase();
  if (machine.includes("AUTOCOL")) return "AUTOCOL_FUTURE";
  if (machine.includes("MULTIMODUL")) return "MULTIMODUL_FUTURE";
  return state.applicationMode === "cold-glue" ? "COLD_GLUE" : "APL";
}

function servoMotionWorkbenchMarkup() {
  const driver = window.LabelerServoCommandDriver;
  if (!driver?.listMoveDefinitions) return "";
  const profileName = activeServoMotionProfileName();
  const profile = driver.profileDefinition(profileName);
  const cards = driver.listMoveDefinitions().map((move, index) => `
    <button class="servo-move-card" type="button" data-servo-move="${move.code}" aria-selected="${index === 0}">
      <span class="servo-move-code">${move.code}</span>
      <strong>${move.name}</strong>
      <small>${move.speedMode.replaceAll("-", " ")}</small>
    </button>`).join("");
  return `
    <section class="servo-motion-workbench" aria-label="KRONES servo motion library">
      <div class="servo-motion-head">
        <div><h2>Servo Motion Library</h2><p>All KRONES move commands are registered. Generated production profiles still default to Rest (3) and Correction (7).</p></div>
        <span class="servo-motion-status">${profile.name}</span>
      </div>
      <div class="servo-motion-controls">
        <label>Machine motion profile<select id="servoMotionProfile">${Object.entries(driver.MACHINE_MOVE_PROFILES).map(([key, item]) => `<option value="${key}"${key === profileName ? " selected" : ""}>${item.name}</option>`).join("")}</select></label>
        <label>Motion intent sequence<textarea id="servoIntentInput" placeholder="Hold, Rotate, Hold, Rotate, Hold">Hold, Rotate, Hold</textarea></label>
        <button id="translateServoIntents" type="button">Translate Intent</button>
      </div>
      <div class="servo-motion-grid">${cards}</div>
      <div class="servo-motion-detail">
        <div id="servoMoveDetail"></div>
        <div><h3>Intent Translation</h3><div id="servoIntentOutput" class="servo-intent-output" aria-live="polite">Choose a profile and translate a sequence.</div></div>
      </div>
    </section>`;
}

function renderServoMoveDetail(code) {
  const driver = window.LabelerServoCommandDriver;
  const move = driver?.moveDefinition(code);
  const target = document.querySelector("#servoMoveDetail");
  if (!move || !target) return;
  const profileName = document.querySelector("#servoMotionProfile")?.value || activeServoMotionProfileName();
  const supported = driver.profileSupportsMove(profileName, move.code);
  target.innerHTML = `
    <h3>CMD ${move.code} — ${move.name}</h3>
    <p>${move.description}</p>
    <div class="servo-motion-meta">
      <span>Starts stopped: <strong>${move.startsStopped === null ? "Profile-dependent" : move.startsStopped ? "Yes" : "No"}</strong></span>
      <span>Ends stopped: <strong>${move.endsStopped === null ? "Profile-dependent" : move.endsStopped ? "Yes" : "No"}</strong></span>
      <span>Speed: <strong>${move.speedMode.replaceAll("-", " ")}</strong></span>
      <span>Profile support: <strong>${supported ? "Enabled" : "Reserved"}</strong></span>
    </div>`;
}

function bindServoMotionWorkbench() {
  const driver = window.LabelerServoCommandDriver;
  const workbench = document.querySelector(".servo-motion-workbench");
  if (!driver || !workbench) return;
  workbench.querySelectorAll("[data-servo-move]").forEach((card) => card.addEventListener("click", () => {
    workbench.querySelectorAll("[data-servo-move]").forEach((entry) => entry.setAttribute("aria-selected", String(entry === card)));
    renderServoMoveDetail(card.dataset.servoMove);
  }));
  workbench.querySelector("#servoMotionProfile")?.addEventListener("change", () => {
    const selected = workbench.querySelector('[data-servo-move][aria-selected="true"]');
    renderServoMoveDetail(selected?.dataset.servoMove || 1);
  });
  workbench.querySelector("#translateServoIntents")?.addEventListener("click", () => {
    const profileName = workbench.querySelector("#servoMotionProfile")?.value || "DEFAULT";
    const intents = String(workbench.querySelector("#servoIntentInput")?.value || "").split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    const plan = driver.planIntents(intents, profileName);
    const output = workbench.querySelector("#servoIntentOutput");
    output.innerHTML = plan.map((step) => step.command
      ? `<span class="servo-intent-chip">${step.intent} → ${step.command} ${step.move.name}</span>`
      : `<span class="servo-intent-chip servo-intent-error">${step.intent} → unsupported</span>`).join("") || "No intents entered.";
  });
  renderServoMoveDetail(1);
}

function injectServoMotionWorkbench() {
  installServoMotionLibraryStyles();
  const program = document.querySelector("#program");
  if (!program || program.querySelector(".servo-motion-workbench")) return;
  program.insertAdjacentHTML("afterbegin", servoMotionWorkbenchMarkup());
  bindServoMotionWorkbench();
}

if (typeof renderProgram === "function") {
  const renderProgramBase = renderProgram;
  renderProgram = function renderProgramWithMotionLibrary(...args) {
    const result = renderProgramBase.apply(this, args);
    injectServoMotionWorkbench();
    return result;
  };
}

removeZoneSiteControls();
initializeLabelerApp();
removeZoneSiteControls();
injectServoMotionWorkbench();
