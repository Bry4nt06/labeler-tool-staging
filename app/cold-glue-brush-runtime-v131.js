"use strict";

(function installColdGlueBrushRuntimeV131(global) {
  const BUILD_ID = "cold-glue-center-tack-brush-runtime-v131-20260816-2235";
  const UPDATED_AT = "Aug 16, 2026 10:35 PM ET";
  const RETRY_MS = 50;
  const EPSILON = 0.001;
  const FULL_CYCLE = 360;
  let installed = false;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function finish(value) {
    return typeof global.finishAngle === "function"
      ? global.finishAngle(value)
      : Math.round(finite(value, 0) * 10) / 10;
  }

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function currentMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function normalizedStoredDirection(value) {
    return String(value || "").trim().toLowerCase() === "cw" ? "cw" : "ccw";
  }

  function storedDirection(map = currentMap()) {
    const stateRef = runtimeState();
    const selected = String(global.document?.getElementById?.("mapDirection")?.value || "").toLowerCase();
    if (selected === "cw" || selected === "ccw") return selected;
    return normalizedStoredDirection(
      map?.machineSettings?.direction
      || stateRef?.coldGlueAggregateSettings?.machineSettings?.direction
      || stateRef?.direction
      || "ccw"
    );
  }

  function physicalDirectionForStored(direction) {
    const stored = normalizedStoredDirection(direction);
    const physicalHelper = global.ServoForgePhysicalWipeDirectionV125;
    if (typeof physicalHelper?.physicalDirectionForStored === "function") {
      return physicalHelper.physicalDirectionForStored(stored);
    }
    const coderDriver = global.LabelerCoderOrientationDriver;
    if (typeof coderDriver?.physicalDirection === "function") return coderDriver.physicalDirection(stored);
    return stored === "cw" ? "ccw" : "cw";
  }

  function channelEntryAngle(direction) {
    return physicalDirectionForStored(direction) === "cw" ? 90 : -90;
  }

  function wipeDirectionForPhysicalSide(side, direction) {
    const physical = physicalDirectionForStored(direction);
    const clockwiseServoDirection = side === "inner" ? 1 : -1;
    return physical === "cw" ? clockwiseServoDirection : -clockwiseServoDirection;
  }

  function shortestDelta(target, reference, preferredSign = 0) {
    const from = finite(reference, 0);
    const to = finite(target, from);
    let delta = ((to - from + 540) % FULL_CYCLE) - 180;
    if (Math.abs(Math.abs(delta) - 180) <= EPSILON && preferredSign) {
      delta = Math.sign(preferredSign) * 180;
    }
    return delta;
  }

  function nearestEquivalent(target, reference, preferredSign = 0) {
    return finite(reference, 0) + shortestDelta(target, reference, preferredSign);
  }

  function physicalSideForWipeRow(row) {
    if (row?.brushSide === "inner" || row?.brushSide === "outer") return row.brushSide;
    const objectIds = Array.isArray(row?.objectIds) ? row.objectIds.map(String) : [];
    const inner = objectIds.some((id) => /(?:^|[-_])inner(?:$|[-_])/i.test(id));
    const outer = objectIds.some((id) => /(?:^|[-_])outer(?:$|[-_])/i.test(id));
    if (inner !== outer) return inner ? "inner" : "outer";
    if (row?.neckWipeSide === "right" || row?.brushStage === "right") return "inner";
    if (row?.neckWipeSide === "left" || row?.brushStage === "left") return "outer";
    return null;
  }

  function isNeckWipeTurn(row) {
    if (!row?.coldGlueNeckTwoSideWipe || Number(row?.cmd) !== 7) return false;
    const stage = String(row?.brushStage || "");
    return stage === "left" || stage === "right" || row?.brushSide === "inner" || row?.brushSide === "outer";
  }

  function appendIssue(issue) {
    const stateRef = runtimeState();
    if (!stateRef?.motionPlan?.mapDriven) return;
    stateRef.motionPlan.issues = Array.isArray(stateRef.motionPlan.issues) ? stateRef.motionPlan.issues : [];
    const key = `${issue.code}:${issue.station || ""}:${issue.section || ""}`;
    if (stateRef.motionPlan.issues.some((entry) => `${entry.code}:${entry.station || ""}:${entry.section || ""}` === key)) return;
    stateRef.motionPlan.issues.push(issue);
  }

  function groupKeys(rows) {
    const keys = [];
    const seen = new Set();
    rows.forEach((row) => {
      if (!row?.coldGlueNeckTwoSideWipe || !Number.isFinite(Number(row?.station))) return;
      const key = `${Number(row.station)}:${String(row.section || "neck")}`;
      if (seen.has(key)) return;
      seen.add(key);
      keys.push({ station: Number(row.station), section: String(row.section || "neck") });
    });
    return keys;
  }

  function indexesForGroup(rows, station, section) {
    return rows
      .map((row, index) => row?.coldGlueNeckTwoSideWipe
        && Number(row?.station) === station
        && String(row?.section || "neck") === section
        ? index
        : -1)
      .filter((index) => index >= 0);
  }

  function normalizeApplicationRow(row, station) {
    return {
      ...row,
      cmd: 3,
      brushStage: "gripper-application",
      action: `Hold Center-Tacked Label Through Application - Agg ${station}`,
      plannedRotation: 0,
      plannedRatio: 0,
      centerLineApplication: true,
      centerOutFromApplication: true,
      leadingEdgeWipe: false,
      tackMode: "center"
    };
  }

  function repairGroup(rows, map, station, section) {
    let indexes = indexesForGroup(rows, station, section);
    if (!indexes.length) return;

    let applicationIndex = indexes.find((index) => {
      const stage = String(rows[index]?.brushStage || "");
      return stage === "gripper-application" || stage === "gripper-to-brush-entry";
    });
    let pressIndex = indexes.find((index) => String(rows[index]?.brushStage || "") === "press-both-sides");
    if (applicationIndex === undefined || pressIndex === undefined || pressIndex <= applicationIndex) return;

    const direction = storedDirection(map);
    const entryReference = channelEntryAngle(direction);
    const stateRef = runtimeState();
    const safeRatio = Math.max(0.1, finite(stateRef?.maxMoveRatio, 21) * 0.9);
    const applicationRow = rows[applicationIndex];
    const pressRow = rows[pressIndex];
    const applicationTable = finite(applicationRow?.tableAngle, 0);
    const brushContactTable = finite(pressRow?.tableAngle, applicationTable);
    const centerPlate = finite(applicationRow?.plateAngle, finite(stateRef?.buildInputs?.plateStartPositionDeg, 0));

    const firstWipeIndex = indexes.find((index) => isNeckWipeTurn(rows[index]));
    const firstPhysicalSide = firstWipeIndex === undefined ? null : physicalSideForWipeRow(rows[firstWipeIndex]);
    const preferredEntrySign = firstPhysicalSide
      ? wipeDirectionForPhysicalSide(firstPhysicalSide, direction)
      : (entryReference >= 0 ? 1 : -1);
    const entryPlate = nearestEquivalent(entryReference, centerPlate, preferredEntrySign);
    const entryRotation = entryPlate - centerPlate;
    const availableTravel = Math.max(0, brushContactTable - applicationTable);

    rows[applicationIndex] = normalizeApplicationRow(applicationRow, station);

    if (Math.abs(entryRotation) > EPSILON && availableTravel > EPSILON) {
      const requiredTravel = Math.abs(entryRotation) / safeRatio;
      const minimumLead = Math.min(0.1, availableTravel / 4);
      const turnStart = Math.max(applicationTable + minimumLead, brushContactTable - requiredTravel);
      const actualTravel = Math.max(EPSILON, brushContactTable - turnStart);
      const correction = {
        ...rows[applicationIndex],
        cmd: 7,
        tableAngle: finish(turnStart),
        plateAngle: finish(centerPlate),
        action: `Pre-Spin Center-Tacked ${section === "neck" ? "Neck " : ""}Label Toward Brush Before Contact - Agg ${station}`,
        motionSource: "cold-glue-brush-runtime-v131",
        brushStage: "pre-brush-entry",
        preBrushRotation: true,
        brushContactTableAngle: finish(brushContactTable),
        channelEntryAngle: finish(entryPlate),
        plannedRotation: finish(entryRotation),
        plannedRatio: Math.abs(entryRotation) / actualTravel,
        leadingEdgeWipe: false,
        tackMode: "center"
      };
      rows.splice(pressIndex, 0, correction);
      pressIndex += 1;

      if (requiredTravel > availableTravel + EPSILON) {
        appendIssue({
          level: "bad",
          code: "cold-glue-prebrush-spin-window",
          station,
          section,
          message: `Aggregate ${station} does not provide enough free table travel after center-tack application to face the label into the brush before contact. Move the brush later or increase the application-to-brush gap.`
        });
      }
    }

    rows[pressIndex] = {
      ...rows[pressIndex],
      cmd: 3,
      plateAngle: finish(entryPlate),
      holdAngle: finish(entryPlate),
      channelEntryAngle: finish(entryPlate),
      action: `Brush Contact — Center-Tacked Label Facing Into Channel - Agg ${station}`,
      brushStage: "press-both-sides",
      preBrushRotationComplete: true,
      centerOutFromApplication: true,
      leadingEdgeWipe: false,
      tackMode: "center"
    };

    indexes = indexesForGroup(rows, station, section);
    let currentPlate = entryPlate;
    let pending = null;

    indexes.forEach((index) => {
      if (index < pressIndex) return;
      const row = rows[index];
      row.centerOutFromApplication = true;
      row.leadingEdgeWipe = false;
      row.tackMode = "center";
      row.channelEntryAngle = finish(entryPlate);

      if (isNeckWipeTurn(row)) {
        const physicalSide = physicalSideForWipeRow(row);
        if (!physicalSide) return;
        const wipeDirection = wipeDirectionForPhysicalSide(physicalSide, direction);
        const rotation = Math.abs(finite(row.plannedRotation, 0));
        row.plateAngle = finish(currentPlate);
        row.plannedRotation = finish(wipeDirection * rotation);
        row.plannedDirection = wipeDirection;
        row.brushSide = physicalSide;
        row.wipeOutward = true;
        row.motionSource = "cold-glue-brush-runtime-v131";
        pending = {
          stage: String(row.brushStage || ""),
          physicalSide,
          signedRotation: wipeDirection * rotation
        };
        return;
      }

      if (Number(row?.cmd) === 3 && /-complete$/i.test(String(row?.brushStage || "")) && pending) {
        currentPlate += pending.signedRotation;
        row.plateAngle = finish(currentPlate);
        row.plannedRotation = finish(pending.signedRotation);
        row.plannedDirection = Math.sign(pending.signedRotation) || 0;
        row.brushSide = pending.physicalSide;
        row.wipeOutward = true;
        row.motionSource = "cold-glue-brush-runtime-v131";
        pending = null;
        return;
      }

      if (Number(row?.cmd) === 3) row.plateAngle = finish(currentPlate);
    });
  }

  function repairRows(rows, map = currentMap()) {
    if (!Array.isArray(rows) || !map || map.applicationMode !== "cold-glue") return rows;
    const output = rows.map((row) => ({ ...row }));
    groupKeys(output).forEach(({ station, section }) => repairGroup(output, map, station, section));
    const finalized = output.map((row, index) => ({
      ...row,
      hmi: index + 1,
      plc: index,
      leadingEdgeWipe: row?.coldGlueNeckTwoSideWipe ? false : row?.leadingEdgeWipe
    }));
    const stateRef = runtimeState();
    if (stateRef?.motionPlan?.mapDriven) stateRef.motionPlan.rows = finalized;
    return finalized;
  }

  function wrapGenerator() {
    const original = global.generatedColdGlueFixedProfile;
    if (typeof original !== "function") return false;
    if (original.coldGlueBrushRuntimeV131Wrapped) return true;

    const wrapped = function generatedColdGlueBrushRuntimeV131Profile(...args) {
      const rows = original.apply(this, args);
      return repairRows(rows, currentMap());
    };
    wrapped.coldGlueBrushRuntimeV131Wrapped = true;
    wrapped.originalGenerator = original;
    global.generatedColdGlueFixedProfile = wrapped;
    try { generatedColdGlueFixedProfile = wrapped; } catch { }
    return true;
  }

  function install() {
    if (installed) return true;
    if (typeof global.generatedColdGlueFixedProfile !== "function") return false;
    if (!wrapGenerator()) return false;
    installed = true;

    global.SERVOFORGE_BUILD_ID = BUILD_ID;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    const banner = global.document?.querySelector?.(".staging-environment-banner");
    if (banner) {
      const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
      banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED ${UPDATED_AT} — NOT PRODUCTION`;
    }

    global.ServoForgeColdGlueBrushRuntimeV131 = Object.freeze({
      installed: true,
      buildId: BUILD_ID,
      physicalDirectionForStored,
      channelEntryAngle,
      wipeDirectionForPhysicalSide,
      physicalSideForWipeRow,
      nearestEquivalent,
      repairRows,
      centerTackOnly: true,
      preBrushRotationRequired: true,
      physicalDirectionRequired: true,
      leadingEdgeWipeAllowed: false
    });
    return true;
  }

  function wait() {
    if (install()) return;
    global.setTimeout(wait, RETRY_MS);
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", wait, { once: true });
  } else {
    wait();
  }
})(window);
