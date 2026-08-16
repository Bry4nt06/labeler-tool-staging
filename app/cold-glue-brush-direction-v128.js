"use strict";

(function installColdGlueBrushDirectionV128(global) {
  const BUILD_ID = "cold-glue-brush-direction-v128-20260816-0955";
  const EPSILON = 0.001;
  const FULL_CYCLE = 360;
  const RETRY_MS = 50;
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
    return String(value || "").toLowerCase() === "ccw" ? "ccw" : "cw";
  }

  function storedDirection(explicit) {
    if (explicit === "cw" || explicit === "ccw") return explicit;
    const stateRef = runtimeState();
    const selected = String(global.document?.getElementById?.("mapDirection")?.value || "").toLowerCase();
    if (selected === "cw" || selected === "ccw") return selected;
    const configured = String(
      stateRef?.coldGlueAggregateSettings?.machineSettings?.direction
      || currentMap()?.machineSettings?.direction
      || stateRef?.direction
      || "cw"
    ).toLowerCase();
    return normalizedStoredDirection(configured);
  }

  function physicalDirectionForStored(direction) {
    const stored = storedDirection(direction);
    const helper = global.ServoForgePhysicalWipeDirectionV125;
    if (typeof helper?.physicalDirectionForStored === "function") {
      return helper.physicalDirectionForStored(stored);
    }
    return stored === "cw" ? "ccw" : "cw";
  }

  function channelEntryAngle(direction) {
    return physicalDirectionForStored(direction) === "cw" ? 90 : -90;
  }

  function wipeDirectionForSide(side, direction) {
    const physical = physicalDirectionForStored(direction);
    const physicalCwDirection = side === "inner" ? 1 : -1;
    return physical === "cw" ? physicalCwDirection : -physicalCwDirection;
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

  function atOrAfter(angle, minimum) {
    let value = finite(angle, minimum);
    while (value < minimum - EPSILON) value += FULL_CYCLE;
    return value;
  }

  function stationObjects(map, station) {
    const stateRef = runtimeState();
    const runtime = Array.isArray(stateRef?.coldGlueMap) ? stateRef.coldGlueMap : [];
    const saved = Array.isArray(map?.objects) ? map.objects : [];
    const runtimeHasBrush = runtime.some((item) =>
      Number(item?.station) === Number(station)
      && (item?.kind === "brush" || item?.kind === "brush-channel")
    );
    const source = runtimeHasBrush ? runtime : saved;
    return source.filter((item) =>
      Number(item?.station) === Number(station)
      && (item?.kind === "brush" || item?.kind === "brush-channel")
    );
  }

  function earliestBrushContact(map, station, minimumTable, maximumTable) {
    const contacts = [];
    stationObjects(map, station).forEach((item) => {
      if (item?.kind === "brush-channel") {
        contacts.push(finite(item.outerStart, finite(item.start, 0)));
        contacts.push(finite(item.innerStart, finite(item.start, 0)));
      } else {
        contacts.push(finite(item.start, 0));
      }
    });
    if (!contacts.length) return NaN;
    let candidate = Math.min(...contacts.map((angle) => atOrAfter(angle, minimumTable)));
    while (Number.isFinite(maximumTable) && candidate > maximumTable + EPSILON) candidate -= FULL_CYCLE;
    while (candidate < minimumTable - EPSILON) candidate += FULL_CYCLE;
    return candidate;
  }

  function aggregateTableAngle(map, station, minimumTable) {
    const stateRef = runtimeState();
    const settings = stateRef?.coldGlueAggregateSettings || {};
    const raw = finite(
      settings?.aggregateAngles?.[String(station)],
      finite(map?.aggregateAngles?.[String(station)], finite(map?.stationAngles?.[String(station)], minimumTable))
    );
    return atOrAfter(raw, minimumTable);
  }

  function installDriverPatch() {
    const driver = global.LabelerColdGlueMotionDriver;
    if (!driver) return false;
    if (driver.coldGlueBrushDirectionV128) return true;

    const previousCreatePlan = driver.createPlan;
    const previousApplicationTarget = driver.applicationTarget;

    if (typeof previousCreatePlan === "function") {
      driver.createPlan = function createPhysicalCenterOutPlan(options = {}) {
        const plan = previousCreatePlan.call(this, options) || {};
        const direction = storedDirection(options?.mapDirection);
        const entry = channelEntryAngle(direction);

        const repairAllocation = (allocation) => {
          if (!allocation || (allocation.side !== "inner" && allocation.side !== "outer")) return { ...allocation };
          return {
            ...allocation,
            direction: wipeDirectionForSide(allocation.side, direction),
            centerOutFromApplication: true,
            leadingEdgeWipe: false,
            tackMode: "center"
          };
        };

        const process = (Array.isArray(plan.process) ? plan.process : []).map(repairAllocation);
        const final = (Array.isArray(plan.final) ? plan.final : []).map(repairAllocation);
        const holds = (Array.isArray(plan.holds) ? plan.holds : []).map((hold) => ({
          ...hold,
          holdAngle: entry,
          channelEntryAngle: entry,
          tackMode: "center"
        }));
        const allocations = [...process, ...final];

        return {
          ...plan,
          process,
          final,
          holds,
          centerOutFromApplication: true,
          leadingEdgeWipe: false,
          tackMode: "center",
          brushEntryLeadDeg: Math.max(0, finite(plan.brushEntryLeadDeg, 0)),
          channelEntryAngle: plan.simultaneousOppositeWipe ? entry : plan.channelEntryAngle,
          finalPlateTravel: allocations.reduce(
            (sum, allocation) => sum + finite(allocation.direction, 0) * Math.abs(finite(allocation.rotation, 0)),
            0
          )
        };
      };
    }

    driver.flowFacingTarget = function physicalColdGlueBrushFacingTarget(_applicationPlateDeg, mapDirection) {
      return channelEntryAngle(mapDirection);
    };
    driver.applicationTarget = typeof previousApplicationTarget === "function"
      ? previousApplicationTarget
      : (baseTargetDeg) => finite(baseTargetDeg, 0);
    driver.coldGlueBrushDirectionV128 = true;
    driver.centerTackOnlyV128 = true;
    return true;
  }

  function isCenterOutWipeRow(row) {
    return Boolean(
      row?.coldGlueCenterOut
      && (row?.brushSide === "inner" || row?.brushSide === "outer" || row?.brushStage === "inner" || row?.brushStage === "outer")
      && Number(row?.cmd) === 7
      && Math.abs(finite(row?.plannedRotation, 0)) > EPSILON
    );
  }

  function repairCenterOutRows(rows, map) {
    if (!Array.isArray(rows) || !map || map.applicationMode !== "cold-glue") return rows;
    const direction = storedDirection(map?.machineSettings?.direction);
    const entryAngle = channelEntryAngle(direction);
    const stateRef = runtimeState();
    const safeRatio = Math.max(0.1, finite(stateRef?.maxMoveRatio, 21) * 0.9);
    const result = rows.map((row) => ({ ...row }));

    const groups = [];
    const seen = new Set();
    result.forEach((row, index) => {
      if (!row?.coldGlueCenterOut || !Number.isFinite(Number(row?.station))) return;
      const key = `${Number(row.station)}:${String(row.section || "")}`;
      if (seen.has(key)) return;
      seen.add(key);
      groups.push({ station: Number(row.station), section: String(row.section || ""), firstIndex: index });
    });

    groups.forEach(({ station, section }) => {
      const indexes = result
        .map((row, index) => row?.coldGlueCenterOut && Number(row?.station) === station && String(row?.section || "") === section ? index : -1)
        .filter((index) => index >= 0);
      if (!indexes.length) return;

      const firstWipeIndex = indexes.find((index) => isCenterOutWipeRow(result[index]));
      if (firstWipeIndex === undefined) return;
      const firstWipe = result[firstWipeIndex];
      const firstSide = firstWipe.brushSide === "inner" || firstWipe.brushStage === "inner" ? "inner" : "outer";
      const preferredEntrySign = wipeDirectionForSide(firstSide, direction);
      const channelDriven = firstWipe.channelEntryAngle !== null && firstWipe.channelEntryAngle !== undefined;

      if (channelDriven) {
        const removable = new Set(indexes.filter((index) => {
          const row = result[index];
          return row?.brushStage === "channel-entry" || row?.brushStage === "opposed";
        }));
        const wiped = result.filter((_row, index) => !removable.has(index));
        const revisedFirstWipeIndex = wiped.findIndex((row) =>
          row?.coldGlueCenterOut
          && Number(row?.station) === station
          && String(row?.section || "") === section
          && isCenterOutWipeRow(row)
        );
        if (revisedFirstWipeIndex < 0) return;

        const previous = wiped[revisedFirstWipeIndex - 1] || null;
        const previousTable = finite(previous?.tableAngle, 0);
        const applicationTable = aggregateTableAngle(map, station, previousTable);
        const brushContact = earliestBrushContact(map, station, applicationTable, finite(wiped[revisedFirstWipeIndex]?.tableAngle, NaN));
        const startPlate = finite(previous?.plateAngle, finite(stateRef?.buildInputs?.plateStartPositionDeg, 0));
        const targetPlate = nearestEquivalent(entryAngle, startPlate, preferredEntrySign);
        const rotation = targetPlate - startPlate;

        if (Number.isFinite(brushContact) && Math.abs(rotation) > EPSILON) {
          const requiredSpan = Math.abs(rotation) / safeRatio;
          const turnStart = Math.max(applicationTable + 0.1, brushContact - requiredSpan);
          const actualSpan = Math.max(EPSILON, brushContact - turnStart);
          const entryCorrection = {
            hmi: 0,
            plc: 0,
            cmd: 7,
            tableAngle: finish(turnStart),
            plateAngle: finish(startPlate),
            action: `${section ? section[0].toUpperCase() + section.slice(1) : "Label"} Face Center-Tacked Label Into Brush Before Contact - Agg ${station}`,
            fixedColdGlueMap: false,
            motionSource: "cold-glue-brush-direction-v128",
            coldGlueCenterOut: true,
            station,
            section,
            brushStage: "channel-entry",
            channelEntryAngle: entryAngle,
            plannedRotation: rotation,
            plannedRatio: Math.abs(rotation) / actualSpan,
            centerOutFromApplication: true,
            leadingEdgeWipe: false,
            tackMode: "center"
          };
          const entryRest = {
            ...entryCorrection,
            cmd: 3,
            tableAngle: finish(brushContact),
            plateAngle: finish(targetPlate),
            action: `${section ? section[0].toUpperCase() + section.slice(1) : "Label"} Brush Entry Center-Tack Hold - Agg ${station}`,
            brushStage: "opposed",
            channelHold: true,
            holdAngle: entryAngle
          };
          wiped.splice(revisedFirstWipeIndex, 0, entryCorrection, entryRest);
        }

        result.length = 0;
        result.push(...wiped);
      }

      const repairedIndexes = result
        .map((row, index) => row?.coldGlueCenterOut && Number(row?.station) === station && String(row?.section || "") === section ? index : -1)
        .filter((index) => index >= 0);
      const entryRestIndex = repairedIndexes.find((index) => result[index]?.brushStage === "opposed" && Number(result[index]?.cmd) === 3);
      let currentPlate = entryRestIndex !== undefined
        ? finite(result[entryRestIndex]?.plateAngle, entryAngle)
        : finite(result[repairedIndexes[0] - 1]?.plateAngle, finite(stateRef?.buildInputs?.plateStartPositionDeg, 0));

      repairedIndexes.forEach((index) => {
        const row = result[index];
        if (!isCenterOutWipeRow(row)) return;
        const side = row.brushSide === "inner" || row.brushStage === "inner" ? "inner" : "outer";
        const wipeDirection = wipeDirectionForSide(side, direction);
        const rotation = Math.abs(finite(row.plannedRotation, 0));
        row.plateAngle = finish(currentPlate);
        row.plannedDirection = wipeDirection;
        row.leadingEdgeWipe = false;
        row.tackMode = "center";
        row.channelEntryAngle = channelDriven ? entryAngle : row.channelEntryAngle;

        const restIndex = result.findIndex((candidate, candidateIndex) =>
          candidateIndex > index
          && candidate?.coldGlueCenterOut
          && Number(candidate?.station) === station
          && String(candidate?.section || "") === section
          && Number(candidate?.cmd) === 3
          && (candidate?.brushSide === side || String(candidate?.brushStage || "").startsWith(side))
        );
        if (restIndex > index) {
          currentPlate += wipeDirection * rotation;
          result[restIndex] = {
            ...result[restIndex],
            plateAngle: finish(currentPlate),
            plannedDirection: wipeDirection,
            leadingEdgeWipe: false,
            tackMode: "center",
            channelEntryAngle: channelDriven ? entryAngle : result[restIndex]?.channelEntryAngle
          };
        }
      });

      const lastGroupIndex = repairedIndexes.at(-1);
      if (Number.isFinite(lastGroupIndex)) {
        const nextCorrectionIndex = result.findIndex((row, index) => index > lastGroupIndex && Number(row?.cmd) === 7);
        if (nextCorrectionIndex > lastGroupIndex) {
          result[nextCorrectionIndex] = { ...result[nextCorrectionIndex], plateAngle: finish(currentPlate) };
        }
      }
    });

    return result.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
  }

  function installGeneratorPatch() {
    const original = global.generatedColdGlueFixedProfile;
    if (typeof original !== "function") return false;
    if (original.coldGlueBrushDirectionV128Wrapped) return true;

    const wrapped = function generatedColdGlueBrushDirectionV128Profile(...args) {
      installDriverPatch();
      const rows = original.apply(this, args);
      const repaired = repairCenterOutRows(rows, currentMap());
      const stateRef = runtimeState();
      if (stateRef?.motionPlan?.mapDriven) stateRef.motionPlan.rows = repaired;
      return repaired;
    };
    wrapped.coldGlueBrushDirectionV128Wrapped = true;
    wrapped.originalGenerator = original;
    global.generatedColdGlueFixedProfile = wrapped;
    try { generatedColdGlueFixedProfile = wrapped; } catch { }
    return true;
  }

  function install() {
    if (installed) return true;
    if (!installDriverPatch()) return false;
    if (!installGeneratorPatch()) return false;
    installed = true;

    global.SERVOFORGE_BUILD_ID = BUILD_ID;
    global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 16, 2026 9:55 AM ET";
    const banner = global.document?.querySelector?.(".staging-environment-banner");
    if (banner) {
      const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
      banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 16, 2026 9:55 AM ET — NOT PRODUCTION`;
    }

    global.ServoForgeColdGlueBrushDirectionV128 = Object.freeze({
      installed: true,
      buildId: BUILD_ID,
      storedDirection,
      physicalDirectionForStored,
      channelEntryAngle,
      wipeDirectionForSide,
      shortestDelta,
      nearestEquivalent,
      repairCenterOutRows,
      centerTackOnly: true,
      preBrushRotationRequired: true,
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
