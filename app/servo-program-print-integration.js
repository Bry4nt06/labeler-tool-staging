"use strict";

(function installServoProgramPrintIntegration(global) {
  if (global.LabelerServoProgramPrint?.installed) return;

  const BUTTON_ID = "printServoProgram";
  const STYLE_ID = "servo-program-print-action-style";
  let tabObserver = null;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatted(value, digits = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    return parsed.toFixed(digits).replace(/\.0$/, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function activeMapSnapshot() {
    try {
      if (typeof activeMachineMap === "function") return activeMachineMap() || {};
    } catch { }
    return (Array.isArray(state?.mapLibrary) ? state.mapLibrary : [])
      .find((map) => String(map?.id) === String(state?.activeMapId)) || {};
  }

  function rpcTableValue(value, machineType) {
    const driver = global.LabelerTopModulRpcAngleDriver;
    const converted = driver?.physicalToRpcTableAngle?.(value, machineType);
    return Number.isFinite(converted) ? converted : value;
  }

  function selectedLabelSnapshot() {
    try {
      if (typeof selectedLabelSpec === "function") return selectedLabelSpec() || {};
    } catch { }
    return (Array.isArray(state?.labelSpecs) ? state.labelSpecs : [])
      .find((spec) => String(spec?.brand) === String(state?.selectedBrand)) || {};
  }

  function selectedBottleSnapshot() {
    try {
      if (typeof selectedBottleSpec === "function") return selectedBottleSpec() || {};
    } catch { }
    return (Array.isArray(state?.bottleSpecs) ? state.bottleSpecs : [])
      .find((spec) => String(spec?.bottleType) === String(state?.selectedBottle)) || {};
  }

  function applicationLabel(value) {
    const mode = String(value || "").toLowerCase();
    if (mode === "apl") return "APL — Applied Plastic Label";
    if (mode === "cold-glue") return "Cold Glue";
    return value ? String(value) : "—";
  }

  function activeLabelSections(label) {
    const sections = [];
    if (number(label?.neckLengthMm, 0) > 0) sections.push("Neck");
    if (number(label?.bodyLengthMm, 0) > 0) sections.push("Body");
    if (number(label?.backLengthMm, 0) > 0) sections.push("Back");
    return sections;
  }

  function activeSourceKind() {
    return state?.activeTab === "simulation" ? "simulation" : "program";
  }

  function activeProfileSnapshot() {
    const profiles = Array.isArray(state?.servoProfileLibrary) ? state.servoProfileLibrary : [];
    return profiles.find((profile) => String(profile?.id) === String(state?.activeServoProfileId || "")) || null;
  }

  function comparableSimulation(value) {
    if (!value || typeof value !== "object") return null;
    const snapshot = JSON.parse(JSON.stringify(value));
    delete snapshot.draftName;
    delete snapshot.draftDescription;
    return snapshot;
  }

  function profileMatchesCurrentSimulation(profile) {
    if (!profile?.simulation || !state?.simulation) return false;
    return JSON.stringify(comparableSimulation(profile.simulation))
      === JSON.stringify(comparableSimulation(state.simulation));
  }

  function sourceRows(sourceKind = activeSourceKind()) {
    if (sourceKind === "simulation") {
      const rows = Array.isArray(state?.simulation?.lines) ? state.simulation.lines : [];
      return rows.map((row, index) => ({
        ...row,
        hmi: Number.isFinite(Number(row?.hmi)) ? Number(row.hmi) : index + 1,
        plc: Number.isFinite(Number(row?.plc)) ? Number(row.plc) : index
      }));
    }
    return Array.isArray(state?.program) ? state.program : [];
  }

  function programRows(sourceKind = activeSourceKind()) {
    const rows = sourceRows(sourceKind);
    try {
      if (typeof programSegments === "function") return programSegments(rows);
    } catch { }
    return rows.map((row, index) => {
      const next = rows[index + 1] || row;
      const tableTravel = number(next?.tableAngle, number(row?.tableAngle, 0)) - number(row?.tableAngle, 0);
      const plateTravel = number(next?.plateAngle, number(row?.plateAngle, 0)) - number(row?.plateAngle, 0);
      return {
        ...row,
        tableTravel,
        plateTravel,
        absSpeed: Math.abs(tableTravel) > 0.0001 ? Math.abs(plateTravel / tableTravel) : 0,
        moveFault: false
      };
    });
  }

  function printModel(sourceKind = activeSourceKind()) {
    const map = activeMapSnapshot();
    const label = selectedLabelSnapshot();
    const bottle = selectedBottleSnapshot();
    const rows = programRows(sourceKind);
    const rpcDriver = global.LabelerTopModulRpcAngleDriver;
    const dts3 = rpcDriver?.variant?.(map?.machineType) === "dts3";
    const rpcTableDigits = rpcDriver?.displayDigits?.(map?.machineType) ?? 1;
    const displayRows = rows.map((row) => ({
      ...row,
      tableAngle: rpcTableValue(row?.tableAngle, map?.machineType),
      generatedTableAngle: rpcTableValue(row?.generatedTableAngle, map?.machineType),
      tableTravel: rpcTableValue(row?.tableTravel, map?.machineType)
    }));
    const profile = sourceKind === "simulation" ? activeProfileSnapshot() : null;
    const profileSaved = sourceKind === "simulation" && profileMatchesCurrentSimulation(profile);
    const profileName = sourceKind === "simulation"
      ? String(state?.simulation?.draftName || "").trim() || profile?.name || "Unsaved Draft"
      : "";
    const profileDescription = sourceKind === "simulation"
      ? profile?.description || String(state?.simulation?.draftDescription || "").trim()
      : "";
    const sections = activeLabelSections(label);
    const maxSpeed = rows.reduce((best, row) => Math.max(best, number(row?.absSpeed, 0)), 0);
    const speedFaults = rows.filter((row) => row?.moveFault === true).length;
    const buildInputs = state?.buildInputs || {};
    const application = state?.applicationMode || map?.applicationMode || label?.applicationMode || "";

    return {
      sourceKind,
      sheetTitle: sourceKind === "simulation" ? "Custom Simulation Profile" : "Servo Program Build Sheet",
      sectionTitle: sourceKind === "simulation" ? "RPC Simulation Program" : "Servo Program",
      sectionNote: sourceKind === "simulation"
        ? `${profileSaved ? "Saved RPC program" : "Unsaved custom draft"} • HMI grouped in blocks of 8`
        : "Generated program • HMI grouped in blocks of 8",
      footerLabel: sourceKind === "simulation"
        ? "Custom RPC simulation profile"
        : "Generated servo program build sheet",
      profileName,
      profileDescription,
      profileSaved,
      version: global.SERVOFORGE_RELEASE_VERSION || document.querySelector('meta[name="application-version"]')?.content || "—",
      build: global.ServoForgeBootstrapBuild || "—",
      buildUpdatedAt: global.SERVOFORGE_BUILD_UPDATED_AT || "—",
      generatedAt: new Date().toLocaleString(),
      mapName: map?.name || els?.activeMapName?.textContent || "—",
      machineType: map?.machineType || "—",
      headCount: number(map?.headCount, number(state?.headCount, 0)),
      application: applicationLabel(application),
      programType: `${sections.length || 1} Label ${String(application || "Program").toUpperCase()}${sections.length ? ` — ${sections.join(" / ")}` : ""}`,
      bottleType: bottle?.bottleType || state?.selectedBottle || "—",
      bottleDiameter: Number.isFinite(Number(bottle?.diameterTargetMm)) ? `${formatted(bottle.diameterTargetMm, 2)} mm` : "—",
      brand: label?.brand || state?.selectedBrand || "—",
      specNumber: label?.specNumber || "—",
      rowCount: rows.length,
      maxSpeed,
      speedFaults,
      maxMoveRatio: number(state?.maxMoveRatio, number(map?.machineSettings?.maxMoveRatio, 0)),
      status: speedFaults ? "REVIEW" : "PASS",
      rows: displayRows,
      rpcTableDigits,
      rpcTableHeading: dts3 ? "Table Angle (DTS3 0–45°)" : "Table Angle",
      rpcTableScale: dts3 ? "45° RPC = 360° physical table" : "360° RPC = 360° physical table",
      parameters: [
        ["Neck contact", `${formatted(buildInputs.neckContactMm, 1)} mm`],
        ["Body contact", `${formatted(buildInputs.bodyContactMm, 1)} mm`],
        ["Back contact", `${formatted(buildInputs.backContactMm, 1)} mm`],
        ["Neck over-wipe", `${formatted(buildInputs.neckOverWipeDeg, 1)}°`],
        ["Body over-wipe", `${formatted(buildInputs.bodyOverWipeDeg, 1)}°`],
        ["Back over-wipe", `${formatted(buildInputs.backOverWipeDeg, 1)}°`],
        ["Code box center from left edge", Number.isFinite(Number(label?.codeBoxCenterMm)) ? `${formatted(label.codeBoxCenterMm, 1)} mm` : "—"],
        ["Maximum turn speed", `${formatted(number(state?.maxMoveRatio, 0), 1)} bottle° / table°`]
      ]
    };
  }

  function summaryItem(label, value, wide = false) {
    return `<div class="summary-item${wide ? " wide" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function printRowsHtml(rows, tableDigits = 1) {
    return rows.map((row, index) => {
      const speed = number(row?.absSpeed, 0);
      const status = row?.moveFault ? "FAULT" : "OK";
      const dataRow = `<tr>
        <td>${escapeHtml(row?.hmi ?? "")}</td>
        <td class="cmd">${escapeHtml(row?.cmd ?? "")}</td>
        <td class="num">${escapeHtml(formatted(row?.tableAngle ?? row?.generatedTableAngle, tableDigits))}</td>
        <td class="num">${escapeHtml(formatted(row?.plateAngle ?? row?.generatedPlateAngle, 1))}</td>
        <td class="num">${escapeHtml(formatted(row?.tableTravel, tableDigits))}</td>
        <td class="num">${escapeHtml(formatted(row?.plateTravel, 1))}</td>
        <td class="num">${escapeHtml(formatted(speed, 1))}</td>
        <td class="status ${row?.moveFault ? "bad" : "ok"}">${status}</td>
        <td class="action">${escapeHtml(row?.action || "")}</td>
      </tr>`;
      const divider = (index + 1) % 8 === 0 && index < rows.length - 1
        ? `<tr class="program-eight-row-divider" aria-hidden="true"><td colspan="9"></td></tr>`
        : "";
      return dataRow + divider;
    }).join("");
  }

  function printHtml(model) {
    const parameters = model.parameters.map(([label, value]) => summaryItem(label, value)).join("");
    const profileSummary = model.sourceKind === "simulation"
      ? [
          summaryItem("RPC Program", model.profileName, true),
          summaryItem("Profile Source", model.profileSaved ? "Saved RPC Program" : "Unsaved Custom Draft", true),
          ...(model.profileDescription ? [summaryItem("Description", model.profileDescription, true)] : [])
        ]
      : [];
    const summary = [
      ...profileSummary,
      summaryItem("Bottle Type", model.bottleType),
      summaryItem("Brand / Label", model.brand, true),
      summaryItem("Spec #", model.specNumber),
      summaryItem("Labeler Map", model.mapName, true),
      summaryItem("Machine Type", model.machineType),
      summaryItem("RPC Table Scale", model.rpcTableScale, true),
      summaryItem("Application", model.application, true),
      summaryItem("Program Type", model.programType, true),
      summaryItem("Heads", model.headCount || "—"),
      summaryItem("Program Rows", model.rowCount),
      summaryItem("Maximum Ratio", `${formatted(model.maxSpeed, 1)} : 1`),
      summaryItem("Speed Limit", `${formatted(model.maxMoveRatio, 1)} : 1`),
      summaryItem("Program Status", model.status)
    ].join("");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ServoForge ${escapeHtml(model.sheetTitle)} — ${escapeHtml(model.brand)}</title>
<style>
  :root { color-scheme:light; --ink:#14201d; --muted:#61706b; --line:#cfd9d5; --soft:#f3f7f5; --brand:#173f35; --brand2:#245e4f; --accent:#ef5b37; --ok:#138a57; --bad:#c63d45; }
  * { box-sizing:border-box; }
  body { margin:0; background:#e8efec; color:var(--ink); font:13px/1.35 Arial,Helvetica,sans-serif; }
  .screen-actions { position:sticky; top:0; z-index:2; display:flex; justify-content:flex-end; gap:8px; padding:10px 16px; background:#102720; box-shadow:0 2px 12px rgba(0,0,0,.18); }
  .screen-actions button { border:0; border-radius:7px; padding:9px 15px; font-weight:700; cursor:pointer; }
  .print-now { background:var(--accent); color:#fff; }
  .close-now { background:#dce6e2; color:var(--ink); }
  .sheet { max-width:1400px; margin:18px auto 34px; background:#fff; border:1px solid #c7d1cd; box-shadow:0 18px 50px rgba(20,45,37,.14); }
  .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:22px 26px 18px; color:#fff; background:linear-gradient(125deg,var(--brand),var(--brand2)); border-bottom:5px solid var(--accent); }
  .wordmark { font-size:26px; font-weight:900; letter-spacing:.08em; }
  .wordmark span { color:#ff7858; }
  .hero h1 { margin:3px 0 0; font-size:16px; text-transform:uppercase; letter-spacing:.08em; font-weight:700; color:#dcece6; }
  .build { min-width:330px; text-align:right; font-size:11px; color:#dcece6; }
  .build strong { display:block; margin-bottom:3px; color:#fff; font-size:12px; overflow-wrap:anywhere; }
  .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; padding:16px 18px; background:#f8fbfa; border-bottom:1px solid var(--line); }
  .summary-item { min-height:54px; padding:8px 10px; border:1px solid #d9e2df; border-radius:7px; background:#fff; }
  .summary-item.wide { grid-column:span 2; }
  .summary-item span { display:block; margin-bottom:3px; color:var(--muted); font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
  .summary-item strong { display:block; font-size:12px; overflow-wrap:anywhere; }
  .program-section { padding:16px 18px 12px; }
  .section-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:8px; }
  .section-head h2 { margin:0; color:var(--brand); font-size:18px; }
  .section-head small { color:var(--muted); }
  table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:9px; }
  thead { display:table-header-group; }
  th { padding:6px 5px; color:#fff; background:var(--brand); border:1px solid #0e3027; font-size:8px; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:5px; border:1px solid var(--line); text-align:center; vertical-align:middle; }
  tbody tr:nth-child(even):not(.program-eight-row-divider) { background:var(--soft); }
  td.action { text-align:left; font-weight:600; }
  td.status.ok { color:var(--ok); font-weight:800; }
  td.status.bad { color:var(--bad); font-weight:800; }
  th:nth-child(1), th:nth-child(2) { width:5%; }
  th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6), th:nth-child(7) { width:8%; }
  th:nth-child(8) { width:6%; }
  th:nth-child(9) { width:39%; }
  .program-eight-row-divider td { height:5px; padding:0; border:0; background:transparent !important; }
  .parameters { padding:0 18px 20px; }
  .parameters h2 { margin:8px 0; color:var(--brand); font-size:15px; }
  .parameter-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
  .parameter-grid .summary-item { min-height:48px; }
  .footer { display:flex; justify-content:space-between; gap:18px; padding:10px 18px; color:var(--muted); border-top:1px solid var(--line); font-size:9px; }
  tr { break-inside:avoid; }
  @page { size:landscape; margin:.3in; }
  @media print {
    body { background:#fff; }
    .screen-actions { display:none !important; }
    .sheet { max-width:none; margin:0; border:0; box-shadow:none; }
    .hero, th, tbody tr:nth-child(even):not(.program-eight-row-divider), .summary { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .program-section { padding:12px 0 8px; }
    .summary { padding:10px 0; }
    .parameters { padding:0 0 10px; }
    .footer { padding:8px 0 0; }
  }
</style>
</head>
<body>
  <div class="screen-actions"><button class="close-now" onclick="window.close()">Close</button><button class="print-now" onclick="window.print()">Print Program</button></div>
  <main class="sheet">
    <header class="hero">
      <div><div class="wordmark"><span>S</span> SERVOFORGE</div><h1>${escapeHtml(model.sheetTitle)}</h1></div>
      <div class="build"><strong>Version ${escapeHtml(model.version)} • ${escapeHtml(model.build)}</strong><div>Build updated ${escapeHtml(model.buildUpdatedAt)}</div><div>Generated ${escapeHtml(model.generatedAt)}</div></div>
    </header>
    <section class="summary">${summary}</section>
    <section class="program-section">
      <div class="section-head"><h2>${escapeHtml(model.sectionTitle)}</h2><small>${escapeHtml(model.sectionNote)}</small></div>
      <table>
        <thead><tr><th>HMI</th><th>CMD</th><th>${escapeHtml(model.rpcTableHeading)}</th><th>Bottle Angle</th><th>Table Travel</th><th>Bottle Travel</th><th>Turn Speed</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${printRowsHtml(model.rows, model.rpcTableDigits)}</tbody>
      </table>
    </section>
    <section class="parameters"><h2>Build Parameters</h2><div class="parameter-grid">${parameters}</div></section>
    <footer class="footer"><span>ServoForge Labeler Tool • ${escapeHtml(model.footerLabel)}</span><span>${escapeHtml(model.bottleDiameter)} bottle target diameter</span></footer>
  </main>
</body>
</html>`;
  }

  function openPrintView() {
    const sourceKind = activeSourceKind();
    const model = printModel(sourceKind);
    if (!model.rows.length) {
      global.alert?.(sourceKind === "simulation"
        ? "Create or load a custom simulation before printing."
        : "Build the Servo Program before printing.");
      return false;
    }

    const printWindow = global.open("", "ServoForgeServoProgramPrint", "width=1440,height=920,scrollbars=yes,resizable=yes");
    if (!printWindow) {
      global.alert?.("The browser blocked the print window. Allow pop-ups for ServoForge, then try Print Program again.");
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml(model));
    printWindow.document.close();
    printWindow.focus?.();
    global.setTimeout(() => {
      try { printWindow.print?.(); } catch { }
    }, 250);
    return true;
  }

  function printerIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 9V3h12v6h1a3 3 0 0 1 3 3v5h-4v4H6v-4H2v-5a3 3 0 0 1 3-3h1Zm2-4v4h8V5H8Zm8 10H8v4h8v-4Zm3-4H5a1 1 0 0 0-1 1v3h2v-2h12v2h2v-3a1 1 0 0 0-1-1Zm0 1.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`;
  }

  function ensureActionStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}.servo-program-print-action {
        width:34px;
        height:34px;
        min-width:34px;
        padding:0;
        margin-left:4px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-color:rgba(239,91,55,.72);
        background:linear-gradient(180deg,rgba(239,91,55,.96),rgba(201,64,39,.96));
        color:#fff;
      }
      #${BUTTON_ID}.servo-program-print-action svg { width:17px; height:17px; display:block; }
      #${BUTTON_ID}.servo-program-print-action:hover:not(:disabled) { filter:brightness(1.06); }
      #${BUTTON_ID}.servo-program-print-action:disabled { opacity:.48; cursor:not-allowed; }
    `;
    document.head.appendChild(style);
  }

  function syncButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const programTab = document.querySelector('.tab[data-tab="program"]');
    const simulationTab = document.querySelector('.tab[data-tab="simulation"]');
    const sourceKind = activeSourceKind();
    const targetTab = sourceKind === "simulation" ? simulationTab : programTab;
    const active = Boolean(targetTab?.classList.contains("active") || ["program", "simulation"].includes(state?.activeTab));
    button.hidden = !active;
    button.disabled = !sourceRows(sourceKind).length;
    button.title = sourceKind === "simulation" ? "Print Simulation Profile" : "Print Servo Program";
    button.setAttribute("aria-label", sourceKind === "simulation" ? "Print Simulation Profile" : "Print Program");
    if (active && targetTab?.nextElementSibling !== button) targetTab?.insertAdjacentElement("afterend", button);
  }

  function observeWorkspaceTabs(programTab) {
    tabObserver?.disconnect?.();
    if (typeof MutationObserver !== "function" || !programTab) return;
    tabObserver = new MutationObserver(syncButton);
    tabObserver.observe(programTab.parentElement || programTab, {
      attributes:true,
      subtree:true,
      attributeFilter:["class"]
    });
  }

  function installButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const programTab = document.querySelector('.tab[data-tab="program"]');
    if (!programTab) return;
    ensureActionStyle();
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "simulation-action servo-program-print-action";
    button.setAttribute("aria-label", "Print Program");
    button.title = "Print Program";
    button.innerHTML = printerIcon();
    button.addEventListener("click", openPrintView);
    programTab.insertAdjacentElement("afterend", button);

    observeWorkspaceTabs(programTab);
    document.addEventListener("input", syncButton);
    document.addEventListener("change", syncButton);
    syncButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installButton, { once:true });
  } else {
    installButton();
  }

  global.LabelerServoProgramPrint = Object.freeze({
    installed:true,
    version:5,
    activeSourceKind,
    sourceRows,
    printModel,
    printHtml,
    printRowsHtml,
    openPrintView,
    syncButton
  });
})(typeof window !== "undefined" ? window : globalThis);
