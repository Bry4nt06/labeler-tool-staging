"use strict";

(function installWorkbookReferenceMapLibraryIntegration() {
  const RETRY_MS = 50;
  const PREFS_KEY = "servoforge-developer-preferences-v1";
  const MAP_ID = "map-l85-workbook-reference-3-label-apl";
  const MAP_NAME = "Standard 45H TopModul";
  const MAP_VERSION = 2;
  const COMPANY_DEFAULT_VERSION = 5;
  let installed = false;

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return {
        ...saved,
        lockedMapIds: Array.isArray(saved?.lockedMapIds)
          ? [...new Set(saved.lockedMapIds.map(String))]
          : [],
        hiddenPanels: Array.isArray(saved?.hiddenPanels)
          ? [...new Set(saved.hiddenPanels.map(String))]
          : []
      };
    } catch {
      return { lockedMapIds: [], hiddenPanels: [] };
    }
  }

  function savePreferences(preferences) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Runtime behavior still works when browser storage is unavailable.
    }
  }

  function installExplicitWindowSupport() {
    if (typeof normalizeBuilderObject !== "function"
      || normalizeBuilderObject.workbookReferenceWindowSupport) return;

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

  function roller(id, name, station, side, start) {
    return {
      id,
      name,
      kind: "roller",
      application: "apl",
      side,
      start,
      end: start + 5,
      wipeSpanDeg: 5,
      extension: 20,
      station,
      role: "process",
      coveragePercent: 0,
      servoAssist: false,
      requiredVisibilityPercent: 50,
      labelSection: "neck"
    };
  }

  function pad(id, name, station, start, end, labelSection) {
    return {
      id,
      name,
      kind: "pad",
      application: "apl",
      side: "outer",
      start,
      end,
      wipeSpanDeg: 0,
      extension: 20,
      station,
      role: "process",
      coveragePercent: 0,
      servoAssist: false,
      requiredVisibilityPercent: 50,
      labelSection
    };
  }

  function sensor(id, name, station, start, end, labelSection) {
    return {
      id,
      name,
      kind: "sensor",
      application: "apl",
      side: "outer",
      start,
      end,
      angle: start,
      workbookExactWindow: true,
      extension: 20,
      station,
      role: "process",
      servoAssist: false,
      requiredVisibilityPercent: 50,
      orientationLabelSection: "auto",
      orientationConfigured: true,
      labelSection
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
      pad("workbook-a3-pad", "Agg 3 Body Wipe-Down Pad", 3, 149, 169, "body"),
      pad("workbook-a4-pad", "Agg 4 Body Wipe-Down Pad", 4, 189, 209, "body"),
      sensor("workbook-neck-body-inspection", "Neck / Body Label Inspection", 4, 216, 219, "body"),
      pad("workbook-a5-pad", "Agg 5 Back Wipe-Down Pad", 5, 230, 250, "back"),
      pad("workbook-a6-pad", "Agg 6 Back Wipe-Down Pad", 6, 270, 290, "back"),
      sensor("workbook-back-inspection", "Back Label Inspection", 6, 304, 315, "back"),
      {
        id: "workbook-back-coding",
        name: "Back Label Coding",
        kind: "coding",
        application: "apl",
        side: "outer",
        start: 304,
        end: 315,
        workbookExactWindow: true,
        extension: 20,
        station: null,
        role: "process",
        orientBottle: false,
        orientationLabelSection: "auto",
        orientationTarget: "code-box",
        orientationConfigured: true,
        servoAssist: false,
        requiredVisibilityPercent: 50
      }
    ];
  }

  function buildReferenceMap() {
    const map = createMachineMap({
      id: MAP_ID,
      name: MAP_NAME,
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
      depths: {
        spender: 12,
        opRoller: 19,
        nonOpRoller: -16,
        wipeInner: -16,
        wipeOuter: 17
      },
      restoreDefaultObjects: false,
      objects: referenceObjects()
    });

    Object.assign(map, {
      name: MAP_NAME,
      companyDefaultProgram: true,
      companyDefaultProgramVersion: COMPANY_DEFAULT_VERSION,
      protectedDefaultMap: true,
      workbookReferenceVersion: MAP_VERSION,
      workbookReference: {
        source: "Labeler Program Tool V1.05B - 3 Label APL - No Seam Alignment - Neck/Body Inspection",
        line: "85",
        labeler: "1 and 2",
        brand: "12oz Platinum (NX)",
        bottleType: "LNNR - 12 Oz",
        direction: "Counter-Clockwise"
      }
    });
    return map;
  }

  function replaceMap(target, replacement) {
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, replacement);
  }

  function ensureReferenceMap() {
    if (!Array.isArray(state.mapLibrary)) state.mapLibrary = [];

    let changed = false;
    let map = state.mapLibrary.find((item) => String(item?.id || "") === MAP_ID);
    if (!map) {
      map = buildReferenceMap();
      state.mapLibrary.push(map);
      changed = true;
    } else if (Number(map.workbookReferenceVersion || 0) < MAP_VERSION) {
      replaceMap(map, buildReferenceMap());
      changed = true;
    } else {
      if (map.name !== MAP_NAME) {
        map.name = MAP_NAME;
        changed = true;
      }
      if (map.companyDefaultProgram !== true) {
        map.companyDefaultProgram = true;
        changed = true;
      }
      if (Number(map.companyDefaultProgramVersion) !== COMPANY_DEFAULT_VERSION) {
        map.companyDefaultProgramVersion = COMPANY_DEFAULT_VERSION;
        changed = true;
      }
      if (map.protectedDefaultMap !== true) {
        map.protectedDefaultMap = true;
        changed = true;
      }
    }

    const preferences = readPreferences();
    if (!preferences.lockedMapIds.includes(MAP_ID)) {
      preferences.lockedMapIds.push(MAP_ID);
      savePreferences(preferences);
      changed = true;
    }

    const spec = (Array.isArray(state.labelSpecs) ? state.labelSpecs : []).find((item) =>
      String(item?.brand || "").trim().toLowerCase() === "12oz platinum (nx)"
    );
    if (spec) spec.enabledLabelSections = { neck: true, body: true, back: true };

    return changed;
  }

  function refreshMapLibrary() {
    const changed = ensureReferenceMap();
    if (!changed) return;
    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    if (typeof render === "function") render();
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || typeof createMachineMap !== "function"
      || typeof normalizeBuilderObject !== "function"
      || !document.querySelector(".map-head")) return false;

    installed = true;
    installExplicitWindowSupport();
    refreshMapLibrary();
    window.setTimeout(refreshMapLibrary, 250);
    window.setTimeout(refreshMapLibrary, 1000);
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wait, { once: true });
  } else {
    wait();
  }
})();
