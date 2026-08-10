"use strict";

(function installAplCoderCodeBoxOrientation(global) {
  if (global.LabelerAplCoderCodeBoxOrientation?.installed) return;

  const PRE_CODER_MARGIN_DEG = 5;
  const COMMAND_GAP_DEG = 0.5;
  const EPS = 0.001;
  const RETRY_MS = 25;

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Use a Window property only when the global lexical state is unavailable.
    }
    return global.state || null;
  }

  function activeMap() {
    try {
      if (typeof activeMachineMap === "function") return activeMachineMap();
      if (typeof global.activeMachineMap === "function") return global.activeMachineMap();
    } catch {
      return null;
    }
    return null;
  }

  function codingObject(machineMap) {
    const current = runtimeState();
    const sources = [
      ...(Array.isArray(machineMap?.objects) ? machineMap.objects : []),
      ...(Array.isArray(current?.aplMapObjects) ? current.aplMapObjects : []),
      ...((Array.isArray(current?.mapLibrary) ? current.mapLibrary : [])
        .filter((map) => map?.id === current?.activeMapId)
        .flatMap((map) => Array.isArray(map?.objects) ? map.objects : []))
    ];
    return sources.find((item) => item?.kind === "coding"
      && item?.application !== "cold-glue"
      && item?.enabled !== false) || null;
  }

  function selectedRecipe() {
    const current = runtimeState();
    const selected = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    return selected || (Array.isArray(current?.labelSpecs)
      ? current.labelSpecs.find((spec) => spec?.brand === current.selectedBrand)
      : null) || null;
  }

  function selectedBottle() {
    const current = runtimeState();
    const selected = typeof selectedBottleSpec === "function" ? selectedBottleSpec() : null;
    return selected || (Array.isArray(current?.bottleSpecs)
      ? current.bottleSpecs.find((spec) => spec?.bottleType === current.selectedBottle)
      : null) || null;
  }

  function activeCodingSection() {
    if (typeof selectedLabelApplicationState !== "function") return "none";
    const applications = selectedLabelApplicationState();
    if (applications.back) return "back";
    if (applications.body) return "body";
    if (applications.neck) return "neck";
    return "none";
  }

  function sectionCircumference(section, label, bottle) {
    if (section === "neck") return finite(label?.neckBottomCircumferenceMm, NaN);
    return typeof bodyCircumference === "function" ? finite(bodyCircumference(bottle), NaN) : NaN;
  }

  function sectionLabelLength(section, label) {
    if (section === "neck") return finite(label?.neckLengthMm, NaN);
    if (section === "body") return finite(label?.bodyLengthMm, NaN);
    if (section === "back") return finite(label?.backLengthMm, NaN);
    return NaN;
  }

  function applicationTarget(section, rows = []) {
    const sectionName = String(section || "");
    const direct = (Array.isArray(rows) ? rows : []).find((row) => {
      if (!Number.isFinite(finite(row?.plateAngle, NaN))) return false;
      const explicit = String(row?.applicationSection || row?.applicationTargetSection || "").toLowerCase();
      if (explicit === sectionName) return true;
      return new RegExp(`hold\\s+for\\s+${sectionName}\\s+application`, "i").test(String(row?.action || ""));
    });
    if (direct) return finite(direct.plateAngle, NaN);

    if (typeof generatedAplSeedProfile !== "function") return NaN;
    const seed = generatedAplSeedProfile();
    const index = section === "neck" ? 1 : section === "body" ? 11 : section === "back" ? 21 : -1;
    return index >= 0 ? finite(seed[index]?.plateAngle, NaN) : NaN;
  }

  function finish(value) {
    return typeof finishAngle === "function" ? finishAngle(value) : Math.round(finite(value, 0) * 10) / 10;
  }

  function appendIssue(issue) {
    const current = runtimeState();
    if (!current) return;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.issues = Array.isArray(current.motionPlan.issues) ? current.motionPlan.issues : [];
    current.motionPlan.issues.push(issue);
  }

  function setBlockedPlan(reason, details = {}) {
    const current = runtimeState();
    if (!current) return;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.coderPlan = {
      status: "blocked",
      reason,
      ...details
    };
  }

  function finalAggregateNumber(machineMap, rows = []) {
    const candidates = [];
    const configured = finite(machineMap?.aggregateCount, NaN);
    if (Number.isFinite(configured)) candidates.push(configured);
    Object.keys(machineMap?.aggregateAngles || {}).forEach((key) => {
      const value = Number(key);
      if (Number.isFinite(value)) candidates.push(value);
    });
    rows.forEach((row) => {
      const station = finite(row?.station, NaN);
      if (Number.isFinite(station)) candidates.push(station);
      const match = String(row?.action || "").match(/\bAgg\s*(\d+)\b/i);
      if (match) candidates.push(Number(match[1]));
    });
    return candidates.length ? Math.max(...candidates.filter(Number.isFinite)) : NaN;
  }

  function belongsToAggregate(row, aggregate) {
    if (!row || !Number.isFinite(aggregate)) return false;
    if (finite(row.station, NaN) === aggregate) return true;
    return new RegExp(`\\bAgg\\s*${aggregate}\\b`, "i").test(String(row.action || ""));
  }

  function finalAggregateHoldIndex(rows, machineMap) {
    const aggregate = finalAggregateNumber(machineMap, rows);
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (!belongsToAggregate(row, aggregate) || Number(row?.cmd) !== 3) continue;
      if (row?.stage === "complete"
        || row?.wipeReference === true
        || /wipe\s+hold|wipe.*rest|(?:hold|rest|complete).*agg/i.test(String(row?.action || ""))) {
        return index;
      }
    }
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (belongsToAggregate(rows[index], aggregate) && Number(rows[index]?.cmd) === 3) return index;
    }
    return -1;
  }

  function rowsThroughFinalAggregate(baseRows, machineMap) {
    const source = (Array.isArray(baseRows) ? baseRows : []).map((row) => ({ ...row }));
    const index = finalAggregateHoldIndex(source, machineMap);
    if (index < 0) return source;
    const aggregate = finalAggregateNumber(machineMap, source);
    return source.slice(0, index + 1).map((row, rowIndex, rows) => ({
      ...row,
      hmi: rowIndex + 1,
      plc: rowIndex,
      terminalRest: rowIndex === rows.length - 1,
      aggregateTerminal: rowIndex === rows.length - 1,
      terminalAggregate: rowIndex === rows.length - 1 ? aggregate : undefined
    }));
  }

  function clearTerminalFlags(row) {
    return {
      ...row,
      terminalRest: false,
      aggregateTerminal: false,
      codingTerminal: false,
      terminalAggregate: undefined
    };
  }

  function appendCoderOrientation(machineMap, baseRows) {
    const current = runtimeState();
    const driver = global.LabelerCoderOrientationDriver;
    const sourceRows = (Array.isArray(baseRows) ? baseRows : []).map((row) => ({ ...row }));
    if (!current || !driver?.codeBoxTarget || !sourceRows.length) return sourceRows;

    const coder = codingObject(machineMap);
    if (!coder) {
      setBlockedPlan("missing-coder-object");
      return sourceRows;
    }

    // Remove any generic post-process terminal (for example the old 359° End
    // Curve) before planning the coder. Aggregate 6 is the physical handoff.
    const rows = rowsThroughFinalAggregate(sourceRows, machineMap);
    const section = activeCodingSection();
    if (section === "none") {
      setBlockedPlan("no-active-label-section");
      return rows;
    }

    const label = selectedRecipe();
    const bottle = selectedBottle();
    const circumferenceMm = sectionCircumference(section, label, bottle);
    const labelLengthMm = sectionLabelLength(section, label);
    const codeBoxCenterMm = finite(label?.codeBoxCenterMm, NaN);
    const labelWidthDeg = typeof degFromMm === "function"
      ? finite(degFromMm(labelLengthMm, circumferenceMm), NaN)
      : NaN;
    const codeBoxOffsetDeg = typeof degFromMm === "function"
      ? finite(degFromMm(codeBoxCenterMm, circumferenceMm), NaN)
      : NaN;
    const targetApplication = applicationTarget(section, rows);
    const lastRow = rows.at(-1);
    const lastTable = finite(lastRow?.tableAngle, NaN);
    const currentPlate = finite(lastRow?.plateAngle, NaN);
    const coderStart = finite(coder.start, finite(coder.angle, NaN));
    let coderEnd = finite(coder.end, coderStart + 5);
    if (Number.isFinite(coderStart) && Number.isFinite(coderEnd)) {
      while (coderEnd <= coderStart + EPS) coderEnd += 360;
    }

    const geometry = {
      section,
      labelBrand: label?.brand || current.selectedBrand || "",
      bottleType: bottle?.bottleType || current.selectedBottle || "",
      circumferenceMm,
      labelLengthMm,
      labelWidthDeg,
      codeBoxCenterMm,
      codeBoxOffsetDeg,
      applicationTarget: targetApplication,
      finalAggregateTableAngle: lastTable,
      finalAggregatePlateAngle: currentPlate,
      coderStart,
      coderEnd
    };

    if (![circumferenceMm, labelLengthMm, codeBoxCenterMm, labelWidthDeg, codeBoxOffsetDeg, targetApplication, lastTable, currentPlate, coderStart, coderEnd].every(Number.isFinite)) {
      setBlockedPlan("invalid-codebox-geometry", geometry);
      appendIssue({
        level: "bad",
        code: "apl-coder-codebox-geometry",
        section,
        message: "Coder orientation could not be calculated. Verify the selected bottle circumference, label length, Code Box Center from Left Edge, and coder map position."
      });
      return rows;
    }

    const readyTable = coderStart - PRE_CODER_MARGIN_DEG;
    const moveStart = lastTable + COMMAND_GAP_DEG;
    if (coderStart <= lastTable + EPS || readyTable <= moveStart + EPS) {
      setBlockedPlan("insufficient-table-window", {
        ...geometry,
        moveStartTableAngle: moveStart,
        readyTableAngle: readyTable,
        preCoderMarginDeg: PRE_CODER_MARGIN_DEG
      });
      appendIssue({
        level: "bad",
        code: "apl-coder-window-capacity",
        section,
        message: `Coding starts at ${coderStart.toFixed(1)} deg, but the final aggregate motion ends at ${lastTable.toFixed(1)} deg. The code-box orientation needs a usable window ending ${PRE_CODER_MARGIN_DEG.toFixed(1)} deg before the coder.`
      });
      return rows;
    }

    const targetInfo = driver.codeBoxTarget({
      section,
      applicationTarget: targetApplication,
      labelWidthDeg,
      codeBoxOffsetDeg,
      inspectionOffsetDeg: 0,
      storedDirection: machineMap?.machineSettings?.direction || current.direction,
      currentPlateAngle: currentPlate
    });
    if (!targetInfo || !Number.isFinite(targetInfo.target)) {
      setBlockedPlan("invalid-codebox-target", geometry);
      return rows;
    }

    const rotation = targetInfo.target - currentPlate;
    if (Math.abs(rotation) <= EPS) {
      current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
      current.motionPlan.rows = rows;
      current.motionPlan.finalPlateAngle = rows.at(-1)?.plateAngle;
      current.motionPlan.coderPlan = {
        status: "ready",
        objectId: coder.id,
        ...geometry,
        targetPlateAngle: finish(targetInfo.target),
        currentPlateAngle: finish(currentPlate),
        rotation: 0,
        readyTableAngle: finish(readyTable),
        physicalStart: finish(coderStart),
        physicalEnd: finish(coderEnd),
        preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
        alreadyAligned: true
      };
      return rows;
    }

    const tableSpan = readyTable - moveStart;
    const ratio = Math.abs(rotation) / Math.max(EPS, tableSpan);
    const maxRatio = Math.max(0.1, finite(current.maxMoveRatio, finite(machineMap?.machineSettings?.maxMoveRatio, 21)));

    rows[rows.length - 1] = clearTerminalFlags(rows[rows.length - 1]);
    const shared = {
      section,
      codingObjectId: coder.id,
      codingWindowStart: finish(coderStart),
      codingWindowStop: finish(coderEnd),
      codingReadyTableAngle: finish(readyTable),
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
      codeBoxCenterMm,
      codeBoxOffsetDeg: finish(codeBoxOffsetDeg),
      codeBoxReferenceEdge: "left",
      codeBoxTargetSource: "label-code-box-center-from-left-edge",
      targetPlateAngle: finish(targetInfo.target),
      plannedRotation: finish(rotation),
      plannedRatio: ratio,
      motionSource: "apl-coder-codebox"
    };

    rows.push({
      hmi: rows.length + 1,
      plc: rows.length,
      cmd: 7,
      baseCmd: 7,
      tableAngle: finish(moveStart),
      plateAngle: finish(currentPlate),
      action: `Orient ${section.charAt(0).toUpperCase()}${section.slice(1)} Code Box for Coding`,
      codingMotion: true,
      codingHold: false,
      plannerIntent: "ROTATE",
      plannerRequestedCommand: 7,
      plannerRecommendedCommand: 7,
      ...shared
    });
    rows.push({
      hmi: rows.length + 1,
      plc: rows.length,
      cmd: 3,
      baseCmd: 3,
      tableAngle: finish(readyTable),
      plateAngle: finish(targetInfo.target),
      action: `Hold ${section.charAt(0).toUpperCase()}${section.slice(1)} Code Box for Coding`,
      codingMotion: false,
      codingHold: true,
      coderTerminalHold: true,
      terminalRest: true,
      codingTerminal: true,
      activeHold: false,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      ...shared
    });

    if (ratio >= maxRatio) {
      appendIssue({
        level: "bad",
        code: "apl-coder-orientation-capacity",
        section,
        message: `Coder orientation requires ${Math.abs(rotation).toFixed(1)} deg of bottle rotation in ${tableSpan.toFixed(1)} deg of table travel (${ratio.toFixed(2)}:1; limit ${maxRatio.toFixed(1)}:1). This uses the same speed-envelope rule as wipe-down pad motion.`
      });
    }

    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.rows = rows;
    current.motionPlan.finalPlateAngle = rows.at(-1)?.plateAngle;
    current.motionPlan.coderPlan = {
      status: ratio >= maxRatio ? "capacity-fault" : "ready",
      objectId: coder.id,
      ...geometry,
      targetPlateAngle: finish(targetInfo.target),
      currentPlateAngle: finish(currentPlate),
      rotation: finish(rotation),
      moveStartTableAngle: finish(moveStart),
      readyTableAngle: finish(readyTable),
      physicalStart: finish(coderStart),
      physicalEnd: finish(coderEnd),
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
      plannedRatio: ratio,
      maxMoveRatio: maxRatio
    };
    current.motionPlan.termination = {
      ...(current.motionPlan.termination || {}),
      section: "coding",
      station: null,
      hmi: rows.at(-1)?.hmi,
      tableAngle: rows.at(-1)?.tableAngle,
      command: "Rest"
    };
    return rows;
  }

  function install() {
    const original = global.generatedServoProfile;
    if (typeof original !== "function") return false;
    if (original.aplCoderCodeBoxOrientationV3) return true;

    const wrapped = function generatedServoProfileWithCoderCodeBox(...args) {
      const rows = original.apply(this, args);
      const current = runtimeState();
      if (String(current?.applicationMode || "apl").toLowerCase() !== "apl") return rows;
      const machineMap = activeMap();
      return machineMap ? appendCoderOrientation(machineMap, rows) : rows;
    };
    wrapped.aplCoderCodeBoxOrientationV3 = true;
    wrapped.previousGenerator = original;

    global.generatedServoProfile = wrapped;
    global.LabelerProfileRouter = Object.freeze({
      ...(global.LabelerProfileRouter || {}),
      generate: wrapped
    });
    global.LabelerAplCoderCodeBoxOrientation = Object.freeze({
      installed: true,
      version: 3,
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
      activeCodingSection,
      finalAggregateNumber,
      finalAggregateHoldIndex,
      rowsThroughFinalAggregate,
      appendCoderOrientation,
      refresh: install
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  Promise.resolve(global.ServoForgeProfileGenerationReady)
    .catch(() => null)
    .finally(wait);
})(typeof window !== "undefined" ? window : globalThis);
