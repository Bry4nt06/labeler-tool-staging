"use strict";

(function installWorkbookReferenceMapIntegration() {
  const RETRY_MS = 50;
  const MAP_ID = "map-workbook-3-label-apl-reference";
  const MAP_VERSION = 1;
  const ACTIVATION_KEY = "servoforgeWorkbookReferenceMapV1Activated";
  let installed = false;
  let refreshPending = false;
  let previousSimulation = null;

  const REFERENCE_LABEL = Object.freeze({
    applicationMode: "apl",
    brand: "12oz Platinum (NX)",
    specNumber: "2164-F",
    bottleType: "LNNR - 12 Oz",
    bodyLengthMm: 75.844,
    backLengthMm: 47.498,
    neckHeightMm: 18.0344,
    neckLengthMm: 35.585,
    neckBottomCurveMm: 37,
    neckBottomCircumferenceMm: 104,
    codeBoxCenterMm: 14,
    enabledLabelSections: { neck: true, body: true, back: true }
  });

  const REFERENCE_BUILD_INPUTS = Object.freeze({
    neckSpenderPlateDeg: 75,
    neckApplication: "Center",
    neckContactMm: 4.4,
    bodyContactMm: 5,
    backContactMm: 5,
    neckOverWipeDeg: 66,
    bodyOverWipeDeg: 10,
    backOverWipeDeg: 10,
    plateStartPositionDeg: 0,
    neckOffsetMm: 0,
    bodyOffsetMm: 0,
    backOffsetMm: 0,
    backInspectionOffsetMm: 0
  });

  const REFERENCE_PROGRAM = Object.freeze([
    [1, 0, 3, 0.0, 0, "Zero Line"],
    [2, 1, 3, 67.5, 0, "Hold for Neck Application - Agg 1"],
    [3, 2, 7, 73.0, 0, "Wipe Turn 1 Neck - Agg 1"],
    [4, 3, 3, 84.0, 130.26923076923077, "Wipe Hold Neck - Agg 1"],
    [5, 4, 7, 90.5, 130.26923076923077, "Wipe Turn 2 Neck - Agg 1"],
    [6, 5, 3, 107.5, 0, "Hold for Neck Application - Agg 2"],
    [7, 6, 7, 113.0, 0, "Wipe Turn 1 Neck - Agg 2"],
    [8, 7, 3, 124.0, 130.26923076923077, "Wipe Hold Neck - Agg 2"],
    [9, 8, 7, 130.5, 130.26923076923077, "Wipe Turn 2 Neck - Agg 2"],
    [10, 9, 3, 147.5, -61.9205208229275, "Hold for Body Application - Agg 3"],
    [11, 10, 7, 153.0, -61.9205208229275, "Wipe Turn 1 Body - Agg 3"],
    [12, 11, 7, 155.5, -81.35969372458851, "Wipe Turn 2 Body - Agg 3"],
    [13, 12, 3, 168.5, 81.82123218612696, "Wipe Hold Body - Agg 3"],
    [14, 13, 7, 169.0, 81.82123218612696, "Turn For Body Application - Agg 4"],
    [15, 14, 3, 187.5, -61.9205208229275, "Hold for Body Application - Agg 4"],
    [16, 15, 7, 193.0, -61.9205208229275, "Wipe Turn 1 Body - Agg 4"],
    [17, 16, 7, 195.5, -81.35969372458851, "Wipe Turn 2 Body - Agg 4"],
    [18, 17, 3, 208.5, 81.82123218612696, "Wipe Hold Body - Agg 4"],
    [19, 18, 7, 209.0, 81.82123218612696, "Turn for Label Inspection - Neck/Body"],
    [20, 19, 3, 216.0, 25.230769230769234, "Hold for Label Inspection - Neck/Body"],
    [21, 20, 7, 219.0, 25.230769230769234, "Turn For Back Application - Agg 5"],
    [22, 21, 3, 228.5, 144.83575868412078, "Hold For Back Application - Agg 5"],
    [23, 22, 7, 234.0, 144.83575868412078, "Wipe Turn 1 Back - Agg 5"],
    [24, 23, 7, 236.5, 125.39658578245977, "Wipe Turn 2 Back - Agg 5"],
    [25, 24, 3, 249.5, 235.06495267907866, "Wipe Hold Back - Agg 5"],
    [26, 25, 7, 250.0, 235.06495267907866, "Turn For Back Application - Agg 6"],
    [27, 26, 3, 268.5, 144.83575868412078, "Hold For Back Application - Agg 6"],
    [28, 27, 7, 274.0, 144.83575868412078, "Wipe Turn 1 Back - Agg 6"],
    [29, 28, 7, 276.5, 125.39658578245977, "Wipe Turn 2 Back - Agg 6"],
    [30, 29, 3, 289.5, 235.06495267907866, "Wipe Hold Back - Agg 6"],
    [31, 30, 7, 290.0, 235.06495267907866, "Turn for Back Label Inspection & Coding"],
    [32, 31, 3, 303.0, 198.63526855442785, "Hold for Back Label Inspection & Coding"]
  ].map(([hmi, plc, cmd, tableAngle, plateAngle, action]) => Object.freeze({ hmi, plc, cmd, tableAngle, plateAngle, action })));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function round(value, digits = 1) {
    if (!finite(value)) return "—";
    return Number(value).toFixed(digits).replace(/\.0$/, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plateDelta(actual, expected) {
    if (!finite(actual) || !finite(expected)) return Infinity;
    return Math.abs((((Number(actual) - Number(expected)) + 540) % 360) - 180);
  }

  function actionSignature(action) {
    const text = String(action || "").toLowerCase();
    return {
      neck: /neck/.test(text),
      body: /body/.test(text),
      back: /back/.test(text),
      wipe: /wipe/.test(text),
      application: /application/.test(text),
      inspection: /inspect/.test(text),
      coding: /cod/.test(text),
      hold: /hold|rest|zero/.test(text),
      turn: /turn|correction/.test(text),
      agg: Number(text.match(/agg\s*(\d+)/)?.[1] || 0)
    };
  }

  function actionPenalty(left, right) {
    const a = actionSignature(left);
    const b = actionSignature(right);
    let penalty = 0;
    ["neck", "body", "back", "wipe", "application", "inspection", "coding", "hold", "turn"].forEach((key) => {
      if (a[key] !== b[key]) penalty += 2;
    });
    if (a.agg && b.agg && a.agg !== b.agg) penalty += 5;
    return penalty;
  }

  function activeReferenceMap() {
    return state?.mapLibrary?.find((map) => map?.id === state.activeMapId && map?.id === MAP_ID) || null;
  }

  function installExplicitWindowSupport() {
    if (typeof normalizeBuilderObject !== "function" || normalizeBuilderObject.workbookReferenceWindowSupport) return;
    const base = normalizeBuilderObject;
    normalizeBuilderObject = function normalizeBuilderObjectWithWorkbookWindows(item, ...args) {
      const normalized = base.call(this, item, ...args);
      if (item?.workbookExactWindow === true && ["sensor", "coding"].includes(normalized.kind)) {
        const start = Number(item.start ?? item.angle);
        const end = Number(item.end);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          normalized.start = start;
          normalized.end = end;
          if (normalized.kind === "sensor") normalized.angle = start;
          normalized.workbookExactWindow = true;
        }
      }
      return normalized;
    };
    normalizeBuilderObject.workbookReferenceWindowSupport = true;
    window.normalizeBuilderObject = normalizeBuilderObject;
  }

  function roller(id, name, station, side, center) {
    return {
      id, name, kind: "roller", application: "apl", side,
      start: center, end: center + 5, wipeSpanDeg: 5,
      extension: 20, station, role: "process", coveragePercent: 0,
      servoAssist: false, requiredVisibilityPercent: 50
    };
  }

  function pad(id, name, station, start, end) {
    return {
      id, name, kind: "pad", application: "apl", side: "outer",
      start, end, wipeSpanDeg: 0, extension: 20, station,
      role: "process", coveragePercent: 0, servoAssist: false,
      requiredVisibilityPercent: 50
    };
  }

  function referenceObjects() {
    return [
      roller("workbook-a1-r1", "Agg 1 Roller 1", 1, "outer", 72),
      roller("workbook-a1-r2", "Agg 1 Roller 2", 1, "outer", 77.5),
      roller("workbook-a1-r3", "Agg 1 Roller 3", 1, "inner", 89.5),
      roller("workbook-a1-r4", "Agg 1 Roller 4", 1, "inner", 95),
      roller("workbook-a2-r1", "Agg 2 Roller 1", 2, "outer", 112),
      roller("workbook-a2-r2", "Agg 2 Roller 2", 2, "outer", 117.5),
      roller("workbook-a2-r3", "Agg 2 Roller 3", 2, "inner", 129.5),
      roller("workbook-a2-r4", "Agg 2 Roller 4", 2, "inner", 135),
      pad("workbook-a3-pad", "Agg 3 Body Wipe-Down Pad", 3, 149, 169),
      pad("workbook-a4-pad", "Agg 4 Body Wipe-Down Pad", 4, 189, 209),
      {
        id: "workbook-neck-body-inspection", name: "Neck / Body Label Inspection",
        kind: "sensor", application: "apl", side: "outer", start: 216, end: 219,
        angle: 216, workbookExactWindow: true, extension: 20, station: 4,
        role: "process", servoAssist: false, requiredVisibilityPercent: 50,
        orientationLabelSection: "body", orientationConfigured: true
      },
      pad("workbook-a5-pad", "Agg 5 Back Wipe-Down Pad", 5, 230, 250),
      pad("workbook-a6-pad", "Agg 6 Back Wipe-Down Pad", 6, 270, 290),
      {
        id: "workbook-back-inspection", name: "Back Label Inspection",
        kind: "sensor", application: "apl", side: "outer", start: 304, end: 315,
        angle: 304, workbookExactWindow: true, extension: 20, station: 6,
        role: "process", servoAssist: false, requiredVisibilityPercent: 50,
        orientationLabelSection: "back", orientationConfigured: true
      },
      {
        id: "workbook-back-coding", name: "Back Label Coding",
        kind: "coding", application: "apl", side: "outer", start: 304, end: 315,
        workbookExactWindow: true, extension: 20, station: null, role: "process",
        orientBottle: false, orientationLabelSection: "back",
        orientationTarget: "code-box", orientationConfigured: true
      }
    ];
  }

  function buildReferenceMap() {
    const map = createMachineMap({
      id: MAP_ID,
      name: "L85 Workbook Reference - 3 Label APL",
      machineType: "TopModul",
      applicationMode: "apl",
      headCount: 45,
      aggregateCount: 6,
      stationCount: 6,
      enabledAggregates: [true, true, true, true, true, true],
      enabledStations: [true, true, true, true, true, true],
      aggregateAngles: { "1": 68.5, "2": 108.5, "3": 148.5, "4": 188.5, "5": 229.5, "6": 269.5 },
      stationAngles: { "1": 68.5, "2": 108.5, "3": 148.5, "4": 188.5, "5": 229.5, "6": 269.5 },
      stationSections: { "1": "neck", "2": "neck", "3": "body", "4": "body", "5": "back", "6": "back" },
      machineSettings: {
        direction: "ccw",
        radius: 250,
        referencePitchRadiusMm: 572.965,
        encoderCountsPerRev: 10000,
        servoGearRatio: 1.051,
        autoScaleTableMap: true,
        zeroAngle: 0,
        maxMoveRatio: 21
      },
      depths: { spender: 12, opRoller: 19, nonOpRoller: -16, wipeInner: -16, wipeOuter: 17 },
      restoreDefaultObjects: false,
      objects: referenceObjects()
    });
    map.workbookReferenceVersion = MAP_VERSION;
    map.workbookReference = {
      source: "Labeler Program Tool V1.05B - 3 Label APL - No Seam Alignment - Neck/Body Inspection",
      line: "85",
      labeler: "1 and 2",
      brand: REFERENCE_LABEL.brand,
      bottleType: REFERENCE_LABEL.bottleType,
      direction: "Counter-Clockwise",
      programRows: clone(REFERENCE_PROGRAM)
    };
    return map;
  }

  function ensureReferenceSpec() {
    const spec = state.labelSpecs?.find((item) => String(item?.brand || "").trim().toLowerCase() === REFERENCE_LABEL.brand.toLowerCase());
    if (spec) spec.enabledLabelSections = { neck: true, body: true, back: true };
  }

  function ensureReferenceMap() {
    if (!Array.isArray(state.mapLibrary)) state.mapLibrary = [];
    let map = state.mapLibrary.find((item) => item?.id === MAP_ID);
    let created = false;
    if (!map) {
      map = buildReferenceMap();
      state.mapLibrary.push(map);
      created = true;
    } else if (Number(map.workbookReferenceVersion || 0) < MAP_VERSION) {
      const replacement = buildReferenceMap();
      Object.keys(map).forEach((key) => delete map[key]);
      Object.assign(map, replacement);
    }
    return { map, created };
  }

  function applyReferenceInputs({ persist = true } = {}) {
    const { map } = ensureReferenceMap();
    ensureReferenceSpec();
    state.activeMapId = MAP_ID;
    state.applicationMode = "apl";
    if (typeof loadMachineMapIntoRuntime === "function") loadMachineMapIntoRuntime(map, false);
    state.selectedBrand = REFERENCE_LABEL.brand;
    state.selectedBottle = REFERENCE_LABEL.bottleType;
    state.buildInputs = { ...state.buildInputs, ...REFERENCE_BUILD_INPUTS };
    state.selectedMotionProfileId = "rest-correction";
    state.defaultMotionProfileId = "rest-correction";
    if (state.simulation) state.simulation.useCustom = false;
    if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
    if (typeof render === "function") render();
    if (persist && typeof saveCurrentSettings === "function") saveCurrentSettings();
  }

  function generatedRows() {
    return (Array.isArray(state.program) ? state.program : []).filter((row) => Number(row?.cmd) !== 0);
  }

  function matchReferenceRows() {
    const generated = generatedRows();
    const used = new Set();
    let cursor = 0;
    return REFERENCE_PROGRAM.map((reference, index) => {
      const candidates = [];
      for (let generatedIndex = Math.max(0, cursor - 1); generatedIndex < Math.min(generated.length, cursor + 6); generatedIndex += 1) {
        if (used.has(generatedIndex)) continue;
        const row = generated[generatedIndex];
        const tableDifference = finite(row?.tableAngle) ? Math.abs(Number(row.tableAngle) - reference.tableAngle) : 999;
        const commandPenalty = Number(row?.cmd) === reference.cmd ? 0 : 4;
        const sequencePenalty = Math.abs(generatedIndex - index) * 0.35;
        candidates.push({ generatedIndex, row, score: tableDifference + commandPenalty + actionPenalty(row?.action, reference.action) + sequencePenalty });
      }
      candidates.sort((a, b) => a.score - b.score);
      const selected = candidates[0] || null;
      if (selected) {
        used.add(selected.generatedIndex);
        cursor = selected.generatedIndex + 1;
      }
      return { reference, generated: selected?.row || null, generatedIndex: selected?.generatedIndex ?? null };
    });
  }

  function comparisonSnapshot() {
    const matches = matchReferenceRows();
    let commandMatches = 0;
    let tableMatches = 0;
    let plateMatches = 0;
    let exactMatches = 0;
    const rows = matches.map(({ reference, generated }) => {
      const commandMatch = Number(generated?.cmd) === reference.cmd;
      const tableDifference = finite(generated?.tableAngle) ? Math.abs(Number(generated.tableAngle) - reference.tableAngle) : Infinity;
      const plateDifference = plateDelta(generated?.plateAngle, reference.plateAngle);
      const tableMatch = tableDifference <= 0.1;
      const plateMatch = plateDifference <= 1;
      const exact = commandMatch && tableMatch && plateMatch;
      if (commandMatch) commandMatches += 1;
      if (tableMatch) tableMatches += 1;
      if (plateMatch) plateMatches += 1;
      if (exact) exactMatches += 1;
      return { reference, generated, commandMatch, tableDifference, plateDifference, tableMatch, plateMatch, exact };
    });
    const generatedCount = generatedRows().length;
    const total = REFERENCE_PROGRAM.length;
    const status = exactMatches === total && generatedCount === total
      ? "PASS"
      : tableMatches >= Math.ceil(total * 0.8) && commandMatches >= Math.ceil(total * 0.8)
        ? "REVIEW"
        : "FAIL";
    return { rows, commandMatches, tableMatches, plateMatches, exactMatches, generatedCount, total, status };
  }

  function ensureComparisonPanel() {
    const host = document.querySelector("#diagnostics");
    if (!host) return null;
    let panel = host.querySelector(".workbook-reference-comparison");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "workbook-reference-comparison";
      const overview = host.querySelector(".diagnostics-overview");
      if (overview) overview.insertAdjacentElement("afterend", panel);
      else host.appendChild(panel);
    }
    return panel;
  }

  function renderComparison() {
    refreshPending = false;
    const panel = ensureComparisonPanel();
    if (!panel) return;
    const active = activeReferenceMap();
    panel.hidden = !active;
    if (!active) return;

    const snapshot = comparisonSnapshot();
    const previewing = Boolean(state.simulation?.useCustom && state.simulation?.workbookReferencePreview);
    const body = snapshot.rows.map((row) => {
      const generated = row.generated;
      const status = row.exact ? "match" : !generated ? "missing" : "difference";
      return `<tr data-status="${status}">
        <td>${row.reference.hmi}</td>
        <td>${row.reference.cmd}</td><td>${generated ? escapeHtml(generated.cmd) : "—"}</td>
        <td>${round(row.reference.tableAngle)}</td><td>${generated ? round(generated.tableAngle) : "—"}</td><td>${finite(row.tableDifference) ? round(row.tableDifference) : "—"}</td>
        <td>${round(row.reference.plateAngle)}</td><td>${generated ? round(generated.plateAngle) : "—"}</td><td>${finite(row.plateDifference) ? round(row.plateDifference) : "—"}</td>
        <td>${escapeHtml(row.reference.action)}</td>
      </tr>`;
    }).join("");

    panel.innerHTML = `
      <div class="workbook-reference-head">
        <div>
          <h3>Workbook Reference Comparison</h3>
          <p>Line 85 • Labelers 1 and 2 • 12oz Platinum (NX) • 45H TopModul APL • counter-clockwise</p>
        </div>
        <strong data-status="${snapshot.status}">${snapshot.status}</strong>
      </div>
      <div class="workbook-reference-actions">
        <button type="button" data-workbook-reapply>Reapply Workbook Map & Inputs</button>
        <button type="button" class="secondary-button" data-workbook-preview>${previewing ? "Restore Generated Simulation" : "Preview Workbook Program"}</button>
      </div>
      <div class="workbook-reference-summary">
        <span><b>${snapshot.exactMatches}/${snapshot.total}</b> exact rows</span>
        <span><b>${snapshot.commandMatches}/${snapshot.total}</b> CMD matches</span>
        <span><b>${snapshot.tableMatches}/${snapshot.total}</b> table-angle matches</span>
        <span><b>${snapshot.plateMatches}/${snapshot.total}</b> plate-angle matches</span>
        <span><b>${snapshot.generatedCount}</b> generated rows</span>
      </div>
      <p class="workbook-reference-note">Table tolerance: ±0.1°. Plate tolerance: ±1.0° using equivalent modulo-360 orientation. The workbook program is never written into the generated Servo Program.</p>
      <div class="workbook-reference-table-wrap">
        <table>
          <thead><tr><th>HMI</th><th>Ref CMD</th><th>Gen CMD</th><th>Ref Table</th><th>Gen Table</th><th>Δ Table</th><th>Ref Plate</th><th>Gen Plate</th><th>Δ Plate</th><th>Workbook Action</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    window.requestAnimationFrame(renderComparison);
  }

  function toggleWorkbookPreview() {
    if (!state.simulation) return;
    if (state.simulation.useCustom && state.simulation.workbookReferencePreview) {
      if (previousSimulation) Object.assign(state.simulation, clone(previousSimulation));
      else {
        state.simulation.useCustom = false;
        state.simulation.lines = [];
      }
      delete state.simulation.workbookReferencePreview;
      previousSimulation = null;
    } else {
      previousSimulation = clone(state.simulation);
      state.simulation.useCustom = true;
      state.simulation.lines = clone(REFERENCE_PROGRAM);
      state.simulation.rows = [];
      state.simulation.deletedRows = [];
      state.simulation.turns = [];
      state.simulation.workbookReferencePreview = true;
      state.activeTab = "simulation";
    }
    if (typeof render === "function") render();
    scheduleRefresh();
  }

  function installEvents() {
    if (document.documentElement.dataset.workbookReferenceEvents === "true") return;
    document.documentElement.dataset.workbookReferenceEvents = "true";
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-workbook-reapply]")) {
        applyReferenceInputs({ persist: true });
        scheduleRefresh();
      } else if (event.target.closest("[data-workbook-preview]")) {
        toggleWorkbookPreview();
      }
    });
  }

  function installStyles() {
    if (document.querySelector("#workbookReferenceComparisonStyles")) return;
    const style = document.createElement("style");
    style.id = "workbookReferenceComparisonStyles";
    style.textContent = `
      .workbook-reference-comparison{margin:0 0 7px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
      .workbook-reference-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .workbook-reference-head h3,.workbook-reference-head p{margin:0}.workbook-reference-head h3{font-size:12px}.workbook-reference-head p{margin-top:2px;color:var(--muted);font-size:8px}
      .workbook-reference-head>strong{padding:3px 8px;border:1px solid var(--green);border-radius:999px;color:var(--green);font-size:9px}
      .workbook-reference-head>strong[data-status="REVIEW"]{border-color:#d79a3c;color:#ffc56b}.workbook-reference-head>strong[data-status="FAIL"]{border-color:#d85b5b;color:#ff8181}
      .workbook-reference-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.workbook-reference-actions button{min-height:26px;padding:4px 8px;font-size:8px}
      .workbook-reference-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:7px}.workbook-reference-summary span{padding:5px 6px;border:1px solid var(--line);border-radius:6px;color:var(--muted);font-size:8px}.workbook-reference-summary b{display:block;color:var(--text);font-size:10px}
      .workbook-reference-note{margin:6px 0;color:var(--muted);font-size:8px}
      .workbook-reference-table-wrap{max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:6px}.workbook-reference-table-wrap table{width:100%;border-collapse:collapse;font-size:8px}.workbook-reference-table-wrap th{position:sticky;top:0;z-index:1;background:var(--panel-hi);color:var(--muted)}
      .workbook-reference-table-wrap th,.workbook-reference-table-wrap td{padding:4px 5px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.workbook-reference-table-wrap th:last-child,.workbook-reference-table-wrap td:last-child{text-align:left;white-space:normal;min-width:180px}
      .workbook-reference-table-wrap tr[data-status="match"] td{background:rgba(66,201,135,.05)}.workbook-reference-table-wrap tr[data-status="difference"] td{background:rgba(255,197,107,.07)}.workbook-reference-table-wrap tr[data-status="missing"] td{background:rgba(255,129,129,.08)}
      @media(max-width:800px){.workbook-reference-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.workbook-reference-head{display:grid}}
    `;
    document.head.appendChild(style);
  }

  function wrapRender(name) {
    const base = window[name] || globalThis[name];
    if (typeof base !== "function" || base.workbookReferenceComparison) return false;
    const wrapped = function workbookReferenceRenderWrapper(...args) {
      const output = base.apply(this, args);
      scheduleRefresh();
      return output;
    };
    wrapped.workbookReferenceComparison = true;
    window[name] = wrapped;
    try { globalThis[name] = wrapped; } catch { }
    return true;
  }

  function installRenderHooks() {
    ["renderProgram", "renderValidation", "renderMap", "renderWipeDownBuilder"].forEach(wrapRender);
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || typeof createMachineMap !== "function"
      || typeof loadMachineMapIntoRuntime !== "function"
      || typeof normalizeBuilderObject !== "function"
      || typeof applyGeneratedServoProfile !== "function") return false;

    installed = true;
    installExplicitWindowSupport();
    const { created } = ensureReferenceMap();
    ensureReferenceSpec();
    installStyles();
    installEvents();
    installRenderHooks();

    let activate = created;
    try {
      activate = activate || localStorage.getItem(ACTIVATION_KEY) !== "1";
    } catch { }
    if (activate) {
      applyReferenceInputs({ persist: true });
      try { localStorage.setItem(ACTIVATION_KEY, "1"); } catch { }
    } else {
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      scheduleRefresh();
    }
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
