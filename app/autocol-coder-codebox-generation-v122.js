"use strict";

(function installAutocolCoderCodeBoxGenerationV122(global) {
  const BUILD_ID = "autocol-codebox-orientation-v122-20260815-0001";
  const EPS = 0.001;
  const MIN_GAP_DEG = 0.5;

  if (global.ServoForgeAutocolCoderCodeBoxV122?.buildId === BUILD_ID) return;

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function activeMapSafe() {
    try { return typeof activeMachineMap === "function" ? activeMachineMap() : null; }
    catch { return null; }
  }

  function activeApplications() {
    try {
      if (typeof selectedLabelApplicationState === "function") return selectedLabelApplicationState();
    } catch {
      // Fall through to a safe inactive set.
    }
    return { neck: false, body: false, back: false };
  }

  function machineFamily() {
    const current = runtimeState();
    const map = activeMapSafe();
    const context = {
      machineType: map?.machineType || map?.name || "",
      machineProfile: current.motionTranslation?.machineProfile || current.motionPlan?.translation?.machineProfile || "",
      applicationMode: current.applicationMode || map?.applicationMode || ""
    };
    const grammar = global.LabelerMachineFamilyGrammarDriver;
    if (typeof grammar?.resolveFamily === "function") {
      return String(grammar.resolveFamily(context) || "DEFAULT").toUpperCase();
    }
    return `${context.machineType} ${map?.name || ""}`.toUpperCase().includes("AUTOCOL") ? "AUTOCOL" : "DEFAULT";
  }

  function selectedLabel() {
    try {
      if (typeof selectedLabelSpec === "function") return selectedLabelSpec();
    } catch {
      // Fall through to state.
    }
    const current = runtimeState();
    return Array.isArray(current.labelSpecs)
      ? current.labelSpecs.find((spec) => spec?.brand === current.selectedBrand) || null
      : null;
  }

  function selectedBottle() {
    try {
      if (typeof selectedBottleSpec === "function") return selectedBottleSpec();
    } catch {
      // Fall through to state.
    }
    const current = runtimeState();
    return Array.isArray(current.bottleSpecs)
      ? current.bottleSpecs.find((spec) => spec?.bottleType === current.selectedBottle) || null
      : null;
  }

  function sectionLengthMm(section, label) {
    if (section === "neck") return finite(label?.neckLengthMm, NaN);
    if (section === "body") return finite(label?.bodyLengthMm, NaN);
    if (section === "back") return finite(label?.backLengthMm, NaN);
    return NaN;
  }

  function sectionCircumferenceMm(section, label, bottle) {
    if (section === "neck") return finite(label?.neckBottomCircumferenceMm, NaN);
    try {
      if (typeof bodyCircumference === "function") return finite(bodyCircumference(bottle), NaN);
    } catch {
      // Use proportional label geometry fallback below.
    }
    return NaN;
  }

  function degreesFromMm(mm, circumferenceMm) {
    try {
      if (typeof degFromMm === "function") {
        const converted = finite(degFromMm(mm, circumferenceMm), NaN);
        if (Number.isFinite(converted)) return converted;
      }
    } catch {
      // Use direct conversion below.
    }
    if (!Number.isFinite(circumferenceMm) || circumferenceMm <= 0) return NaN;
    return finite(mm, NaN) / circumferenceMm * 360;
  }

  function resolveSection(coder, applications = activeApplications()) {
    const explicit = String(coder?.orientationLabelSection || "auto").trim().toLowerCase();
    if (explicit === "none") return "none";
    if (["neck", "body", "back"].includes(explicit)) return applications?.[explicit] === false ? "none" : explicit;

    // Keep Auto aligned with the existing ServoForge coding fallback. An
    // explicitly selected Coding label always wins; Auto uses the last active
    // finished label in the normal neck -> body -> back application sequence.
    if (applications?.back) return "back";
    if (applications?.body) return "body";
    if (applications?.neck) return "neck";
    return "none";
  }

  function geometryForSection(section) {
    const label = selectedLabel();
    const bottle = selectedBottle();
    const labelLengthMm = sectionLengthMm(section, label);
    const circumferenceMm = sectionCircumferenceMm(section, label, bottle);
    const codeBoxCenterMm = Math.abs(finite(label?.codeBoxCenterMm, NaN));
    let labelWidthDeg = degreesFromMm(labelLengthMm, circumferenceMm);
    let codeBoxOffsetDeg = degreesFromMm(codeBoxCenterMm, circumferenceMm);

    try {
      const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan(section) : null;
      if (!Number.isFinite(labelWidthDeg)) labelWidthDeg = finite(wipe?.labelDeg, NaN);
    } catch {
      // Keep the physical conversion above when available.
    }

    if (!Number.isFinite(codeBoxOffsetDeg)
      && Number.isFinite(labelWidthDeg)
      && Number.isFinite(labelLengthMm)
      && labelLengthMm > 0
      && Number.isFinite(codeBoxCenterMm)) {
      codeBoxOffsetDeg = codeBoxCenterMm / labelLengthMm * labelWidthDeg;
    }

    if (![labelWidthDeg, codeBoxOffsetDeg, codeBoxCenterMm].every(Number.isFinite)) return null;
    return {
      labelLengthMm,
      circumferenceMm,
      codeBoxCenterMm,
      labelWidthDeg: Math.abs(labelWidthDeg),
      codeBoxOffsetDeg: Math.abs(codeBoxOffsetDeg)
    };
  }

  function coderWindow(coder) {
    const start = finite(coder?.start, finite(coder?.angle, NaN));
    if (!Number.isFinite(start)) return null;
    let end = finite(coder?.end, start + 5);
    if (!Number.isFinite(end)) end = start + 5;
    while (end <= start + EPS) end += 360;
    return { start, end };
  }

  function planCoderTurn({
    coder,
    section,
    currentPlateAngle,
    previousTableAngle,
    labelWidthDeg,
    codeBoxOffsetDeg,
    storedDirection,
    maxMoveRatio
  } = {}) {
    const driver = global.LabelerCoderOrientationDriver;
    const window = coderWindow(coder);
    if (!driver?.codeBoxTarget || !window) return { error: "geometry" };

    const currentPlate = finite(currentPlateAngle, NaN);
    const previousTable = finite(previousTableAngle, NaN);
    const width = Math.abs(finite(labelWidthDeg, NaN));
    const measuredOffset = Math.abs(finite(codeBoxOffsetDeg, NaN));
    if (![currentPlate, previousTable, width, measuredOffset].every(Number.isFinite)) return { error: "geometry" };

    const targetMode = coder?.orientationTarget === "label-center" ? "label-center" : "code-box";
    // Reuse the same v121 physical transform for both supported targets. The
    // label centerline is exactly half a label width inward from the physical
    // printed LEFT edge, so no separate direction convention is introduced.
    const targetOffset = targetMode === "label-center" ? width / 2 : measuredOffset;
    const target = driver.codeBoxTarget({
      section,
      applicationTarget: 0,
      labelWidthDeg: width,
      codeBoxOffsetDeg: targetOffset,
      inspectionOffsetDeg: 0,
      storedDirection,
      currentPlateAngle: currentPlate,
      coderSide: coder?.side || "outer"
    });
    if (!target || !Number.isFinite(finite(target.target, NaN))) return { error: "target" };

    const availableStart = previousTable + MIN_GAP_DEG;
    if (window.start <= availableStart + EPS) {
      return {
        error: "window",
        window,
        availableStart,
        target,
        targetMode
      };
    }

    const rotation = target.target - currentPlate;
    const limit = Math.max(0.1, finite(maxMoveRatio, 21));
    const safeRatio = Math.max(0.1, limit * 0.9);
    const requiredLead = Math.max(MIN_GAP_DEG, Math.abs(rotation) / safeRatio);
    const turnStart = Math.max(availableStart, window.start - requiredLead);
    const span = window.start - turnStart;
    if (span <= EPS) {
      return {
        error: "window",
        window,
        availableStart,
        target,
        targetMode
      };
    }

    return {
      error: null,
      window,
      turnStart,
      holdStart: window.start,
      holdEnd: window.end,
      currentPlate,
      rotation,
      ratio: Math.abs(rotation) / span,
      limit,
      safeRatio,
      target,
      targetMode
    };
  }

  function issue(code, message, extra = {}) {
    return { level: "bad", code, message, ...extra };
  }

  function sectionName(section) {
    try { return typeof sectionLabel === "function" ? sectionLabel(section) : `${String(section || "Label")[0]?.toUpperCase() || ""}${String(section || "label").slice(1)}`; }
    catch { return String(section || "Label"); }
  }

  function terminalIndex(rows) {
    return rows.findIndex((row) => row?.terminalRest === true || /end\s*(?:of\s*)?curve/i.test(String(row?.action || "")));
  }

  function nonTerminalRows(rows) {
    const index = terminalIndex(rows);
    return index >= 0 ? rows.slice(0, index) : rows.slice();
  }

  function applyAutocolCoderOrientation(sourceRows) {
    const source = Array.isArray(sourceRows) ? sourceRows.map((row) => ({ ...row })) : [];
    const current = runtimeState();
    const map = activeMapSafe();
    if (!source.length || machineFamily() !== "AUTOCOL") return source;

    const objects = Array.isArray(map?.objects)
      ? map.objects
      : Array.isArray(current.coldGlueMap)
        ? current.coldGlueMap
        : [];
    const coders = objects
      .filter((item) => item?.kind === "coding")
      .map((item) => ({ item, window: coderWindow(item) }))
      .filter((entry) => entry.window)
      .sort((a, b) => a.window.start - b.window.start);
    if (!coders.length) return source;

    const baseActiveRows = nonTerminalRows(source);
    const lastBaseMotionAngle = baseActiveRows.reduce((best, row) => Math.max(best, finite(row?.tableAngle, -Infinity)), -Infinity);
    let rows = source;
    const localIssues = [];
    const plans = [];
    let lastHoldRow = null;

    coders.forEach(({ item: coder, window }) => {
      const section = resolveSection(coder);
      if (section === "none") {
        localIssues.push(issue(
          "autocol-coder-label-inactive",
          `${coder.name || "Coder"} has no active Coding label assigned. Choose Neck, Body, or Back in the coder settings.`,
          { coderId: coder.id }
        ));
        return;
      }

      const geometry = geometryForSection(section);
      if (!geometry) {
        localIssues.push(issue(
          "autocol-coder-codebox-geometry",
          `${coder.name || "Coder"} cannot calculate the ${sectionName(section)} Code Box Ctr because the selected label/bottle geometry is incomplete.`,
          { coderId: coder.id, section }
        ));
        return;
      }

      // The Autocol coder stage is intentionally a post-wipe orientation. Do
      // not silently push a coder onto another table revolution if a physical
      // wipe/roller event is still scheduled at or after the coder position.
      if (lastBaseMotionAngle >= window.start - EPS) {
        localIssues.push(issue(
          "autocol-coder-before-motion-complete",
          `${coder.name || "Coder"} begins at ${window.start.toFixed(1)}°, but Autocol label motion continues through ${lastBaseMotionAngle.toFixed(1)}°. Move the coder after the final wipe/roller event.`,
          { coderId: coder.id, section, coderStart: window.start, finalMotionAngle: lastBaseMotionAngle }
        ));
        return;
      }

      const endIndex = terminalIndex(rows);
      const activeEnd = endIndex >= 0 ? endIndex : rows.length;
      const previous = rows.slice(0, activeEnd)
        .filter((row) => finite(row?.tableAngle, Infinity) < window.start - EPS)
        .at(-1);
      if (!previous || Number(previous.cmd) !== 3) {
        localIssues.push(issue(
          "autocol-coder-reference",
          `${coder.name || "Coder"} requires a Rest (CMD 3) reference before its correction window.`,
          { coderId: coder.id, section }
        ));
        return;
      }

      const plan = planCoderTurn({
        coder,
        section,
        currentPlateAngle: previous.plateAngle,
        previousTableAngle: previous.tableAngle,
        labelWidthDeg: geometry.labelWidthDeg,
        codeBoxOffsetDeg: geometry.codeBoxOffsetDeg,
        storedDirection: current.coldGlueAggregateSettings?.machineSettings?.direction || map?.machineSettings?.direction || "ccw",
        maxMoveRatio: current.maxMoveRatio || map?.machineSettings?.maxMoveRatio || 21
      });
      if (plan.error) {
        localIssues.push(issue(
          "autocol-coder-turn-window",
          `${coder.name || "Coder"} does not have enough open table travel to orient the ${sectionName(section)} ${plan.targetMode === "label-center" ? "label centerline" : "Code Box Ctr"} before ${window.start.toFixed(1)}°.`,
          { coderId: coder.id, section, coderStart: window.start }
        ));
        return;
      }

      const labelTargetName = plan.targetMode === "label-center" ? "Label Centerline" : "Code Box";
      const common = {
        fixedColdGlueMap: false,
        motionSource: "autocol-coder-codebox-v122",
        autocolProfile: true,
        autocolCoderV122: true,
        coderId: coder.id,
        coderSide: String(coder.side || "outer").toLowerCase(),
        section,
        codingSection: section,
        codingTargetMode: plan.targetMode,
        codingWindowStart: plan.holdStart,
        codingWindowEnd: plan.holdEnd,
        codeBoxCenterMm: geometry.codeBoxCenterMm,
        printedLabelLeftEdgeLocalAngle: plan.target.printedLabelLeftEdgeLocalAngle,
        printedCodeBoxLocalAngle: plan.target.printedCodeBoxLocalAngle,
        operatorFacingLeftEdge: true,
        printedArtworkDirectionInvariant: true,
        targetReference: plan.target.targetReference
      };

      const insertionIndex = endIndex >= 0 ? endIndex : rows.length;
      const additions = [];
      if (Math.abs(plan.rotation) > EPS) {
        additions.push({
          hmi: 0,
          plc: 0,
          cmd: 7,
          tableAngle: Number(plan.turnStart.toFixed(1)),
          plateAngle: Number(plan.currentPlate.toFixed(1)),
          action: `Orient ${sectionName(section)} ${labelTargetName} for ${coder.name || "Coder"}`,
          activeHold: false,
          codingMotion: true,
          plannedRotation: plan.rotation,
          plannedRatio: plan.ratio,
          ...common
        });
      }
      const holdRow = {
        hmi: 0,
        plc: 0,
        cmd: 3,
        tableAngle: Number(plan.holdStart.toFixed(1)),
        plateAngle: Number(plan.target.target.toFixed(1)),
        action: `Hold ${sectionName(section)} ${labelTargetName} Through ${coder.name || "Coder"}`,
        activeHold: true,
        codingHold: true,
        autocolBoundary: "coding-hold",
        ...common
      };
      additions.push(holdRow);
      rows.splice(insertionIndex, 0, ...additions);
      lastHoldRow = holdRow;

      const nextTerminalIndex = terminalIndex(rows);
      if (nextTerminalIndex >= 0) {
        rows[nextTerminalIndex] = {
          ...rows[nextTerminalIndex],
          cmd: 3,
          plateAngle: holdRow.plateAngle,
          autocolProfile: true,
          autocolBoundary: "end-curve"
        };
      }

      if (plan.ratio >= plan.limit) {
        localIssues.push(issue(
          "autocol-coder-speed-envelope",
          `${coder.name || "Coder"} requires ${plan.ratio.toFixed(2)}:1 bottle/table rotation to reach the ${sectionName(section)} ${labelTargetName}, above the ${plan.limit.toFixed(2)}:1 limit.`,
          { coderId: coder.id, section, plannedRatio: plan.ratio, limit: plan.limit }
        ));
      }

      plans.push({
        coderId: coder.id,
        coderName: coder.name || "Coder",
        section,
        targetMode: plan.targetMode,
        tableStart: plan.turnStart,
        coderStart: plan.holdStart,
        coderEnd: plan.holdEnd,
        plateTarget: plan.target.target,
        plannedRotation: plan.rotation,
        plannedRatio: plan.ratio,
        codeBoxCenterMm: geometry.codeBoxCenterMm,
        printedLabelLeftEdgeLocalAngle: plan.target.printedLabelLeftEdgeLocalAngle,
        printedCodeBoxLocalAngle: plan.target.printedCodeBoxLocalAngle,
        storedDirection: plan.target.storedDirection,
        physicalDirection: plan.target.physicalDirection,
        servoDirectionSign: plan.target.servoDirectionSign,
        coderSide: plan.target.coderSide,
        targetReference: plan.target.targetReference,
        operatorFacingLeftEdge: true,
        printedArtworkDirectionInvariant: true
      });
    });

    if (lastHoldRow) lastHoldRow.autocolBoundary = "motion-end-rest";

    rows = rows
      .map((row) => ({ ...row }))
      .sort((a, b) => finite(a.tableAngle, 0) - finite(b.tableAngle, 0))
      .map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    rows = global.LabelerServoCommandDriver?.finalize ? global.LabelerServoCommandDriver.finalize(rows) : rows;

    if (current.motionPlan && typeof current.motionPlan === "object") {
      current.motionPlan.rows = rows;
      current.motionPlan.issues = [...(Array.isArray(current.motionPlan.issues) ? current.motionPlan.issues : []), ...localIssues];
      current.motionPlan.autocolCoderPlans = plans;
      current.motionPlan.finalPlateAngle = rows.at(-1)?.plateAngle;
    }
    current.autocolCoderOrientation = {
      buildId: BUILD_ID,
      plans,
      issues: localIssues,
      operatorFacingLeftEdge: true,
      printedArtworkDirectionInvariant: true
    };

    return rows;
  }

  const base = (() => {
    try { return typeof generatedColdGlueFixedProfile === "function" ? generatedColdGlueFixedProfile : global.generatedColdGlueFixedProfile; }
    catch { return global.generatedColdGlueFixedProfile; }
  })();

  if (typeof base !== "function") {
    throw new Error("Autocol coder v122 loaded before the cold-glue profile generator.");
  }

  if (base.autocolCoderCodeBoxV122 !== true) {
    const wrapped = function generatedColdGlueFixedProfileWithAutocolCoderV122(...args) {
      return applyAutocolCoderOrientation(base.apply(this, args));
    };
    wrapped.autocolCoderCodeBoxV122 = true;
    wrapped.previousGeneratedColdGlueFixedProfile = base;
    try { generatedColdGlueFixedProfile = wrapped; } catch { }
    global.generatedColdGlueFixedProfile = wrapped;
  }

  const api = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    resolveSection,
    geometryForSection,
    coderWindow,
    planCoderTurn,
    applyAutocolCoderOrientation,
    operatorFacingLeftEdge: true,
    printedArtworkDirectionInvariant: true
  });
  global.ServoForgeAutocolCoderCodeBoxV122 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
