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

  function codingObject(machineMap) {
    return (Array.isArray(machineMap?.objects) ? machineMap.objects : [])
      .find((item) => item?.kind === "coding" && item?.application !== "cold-glue" && item?.enabled !== false) || null;
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

  function applicationTarget(section) {
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

  function clearTerminalFlags(row) {
    return {
      ...row,
      terminalRest: false,
      aggregateTerminal: false,
      terminalAggregate: undefined,
      plannerIntent: row?.plannerIntent === "HOLD" ? "HOLD" : row?.plannerIntent,
      plannerRequestedCommand: row?.plannerRequestedCommand,
      plannerRecommendedCommand: row?.plannerRecommendedCommand
    };
  }

  function appendCoderOrientation(machineMap, baseRows) {
    const current = runtimeState();
    const driver = global.LabelerCoderOrientationDriver;
    const rows = (Array.isArray(baseRows) ? baseRows : []).map((row) => ({ ...row }));
    if (!current || !driver?.codeBoxTarget || !rows.length) return rows;

    const coder = codingObject(machineMap);
    if (!coder) return rows;

    const section = activeCodingSection();
    if (section === "none") return rows;

    const label = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    const bottle = typeof selectedBottleSpec === "function" ? selectedBottleSpec() : null;
    const circumferenceMm = sectionCircumference(section, label, bottle);
    const codeBoxCenterMm = finite(label?.codeBoxCenterMm, NaN);
    const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan(section) : null;
    const labelWidthDeg = finite(wipe?.labelDeg, NaN);
    const codeBoxOffsetDeg = typeof degFromMm === "function"
      ? finite(degFromMm(codeBoxCenterMm, circumferenceMm), NaN)
      : NaN;
    const targetApplication = applicationTarget(section);
    const lastRow = rows.at(-1);
    const lastTable = finite(lastRow?.tableAngle, NaN);
    const currentPlate = finite(lastRow?.plateAngle, NaN);
    const coderStart = finite(coder.start, finite(coder.angle, NaN));
    let coderEnd = finite(coder.end, coderStart + 5);
    if (Number.isFinite(coderStart) && Number.isFinite(coderEnd)) {
      while (coderEnd <= coderStart + EPS) coderEnd += 360;
    }

    if (![circumferenceMm, codeBoxCenterMm, labelWidthDeg, codeBoxOffsetDeg, targetApplication, lastTable, currentPlate, coderStart, coderEnd].every(Number.isFinite)) {
      appendIssue({
        level: "bad",
        code: "apl-coder-codebox-geometry",
        section,
        message: "Coder orientation could not be calculated. Verify the selected bottle circumference, label length, Code Box Center from Left Edge, and coder map position."
      });
      return rows;
    }

    // The coder must occur after the final aggregate in the same table cycle.
    // Never unwrap it into a second revolution just to create a motion window.
    const readyTable = coderStart - PRE_CODER_MARGIN_DEG;
    const moveStart = lastTable + COMMAND_GAP_DEG;
    if (coderStart <= lastTable + EPS || readyTable <= moveStart + EPS) {
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
    if (!targetInfo || !Number.isFinite(targetInfo.target)) return rows;

    const rotation = targetInfo.target - currentPlate;
    if (Math.abs(rotation) <= EPS) {
      // The bottle is already correctly oriented. The existing final Aggregate
      // 6 Rest holds that orientation through the coder, so do not create an
      // unnecessary Rest -> Rest waypoint.
      if (current.motionPlan) {
        current.motionPlan.coderPlan = {
          objectId: coder.id,
          section,
          codeBoxCenterMm,
          codeBoxOffsetDeg,
          targetPlateAngle: finish(targetInfo.target),
          currentPlateAngle: finish(currentPlate),
          rotation: 0,
          readyTableAngle: finish(readyTable),
          physicalStart: finish(coderStart),
          physicalEnd: finish(coderEnd),
          preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
          alreadyAligned: true
        };
      }
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
      objectId: coder.id,
      section,
      codeBoxCenterMm,
      codeBoxOffsetDeg: finish(codeBoxOffsetDeg),
      applicationTarget: finish(targetApplication),
      labelWidthDeg: finish(labelWidthDeg),
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
    const original = global.generatedAplMapDrivenProfile;
    if (typeof original !== "function") return false;
    if (original.aplCoderCodeBoxOrientationV1) return true;

    const wrapped = function generatedAplMapDrivenProfileWithCoderCodeBox(machineMap) {
      return appendCoderOrientation(machineMap, original.call(this, machineMap));
    };
    wrapped.aplCoderCodeBoxOrientationV1 = true;
    wrapped.previousGenerator = original;

    global.generatedAplMapDrivenProfile = wrapped;
    global.LabelerAplMapProfileGenerator = Object.freeze({
      ...(global.LabelerAplMapProfileGenerator || {}),
      generate: wrapped
    });
    global.LabelerAplCoderCodeBoxOrientation = Object.freeze({
      installed: true,
      version: 1,
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
      activeCodingSection,
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
