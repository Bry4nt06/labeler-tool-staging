"use strict";

(function installAplBodyBackTwoLabelTransitionFix() {
  const RETRY_MS = 50;
  const EPSILON = 0.001;
  let installed = false;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function finish(value) {
    return typeof finishAngle === "function"
      ? finishAngle(value)
      : Math.round(finite(value, 0) * 10) / 10;
  }

  function nearestEquivalent(target, reference) {
    const base = finite(target, 0);
    const current = finite(reference, base);
    return base + 360 * Math.round((current - base) / 360);
  }

  function activeMap() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function isNoNeckBodyBackProgram() {
    if (state.applicationMode !== "apl" || typeof selectedLabelApplicationState !== "function") return false;
    const applications = selectedLabelApplicationState();
    return Boolean(!applications.neck && applications.body && applications.back);
  }

  function stationSectionMap(map) {
    try {
      return typeof inferAplStationSections === "function" ? inferAplStationSections(map) : {};
    } catch {
      return {};
    }
  }

  function activeStationSequence(map) {
    const sections = stationSectionMap(map);
    const applications = selectedLabelApplicationState();
    const stations = [...new Set((map?.objects || [])
      .filter((item) => item.kind === "roller" || item.kind === "pad")
      .filter((item) => typeof isStationEnabled !== "function" || isStationEnabled(map, Number(item.station)))
      .map((item) => Number(item.station))
      .filter((station) => Number.isFinite(station) && station >= 1 && station <= 6))]
      .sort((left, right) => left - right);

    return stations.map((station) => {
      const section = String(sections[String(station)] || (typeof labelSectionForStation === "function" ? labelSectionForStation(station) : ""));
      return { station, section };
    }).filter((entry) => (entry.section === "body" || entry.section === "back") && applications[entry.section]);
  }

  function actionPattern(turn, section, station) {
    return new RegExp(`Wipe\\s+Turn\\s+${turn}\\s+${section}\\s*-\\s*Agg\\s*${station}(?:\\D|$)`, "i");
  }

  function applicationPattern(section, station) {
    return new RegExp(`(?:Turn|Hold).*${section}\\s+Application\\s*-\\s*Agg\\s*${station}(?:\\D|$)`, "i");
  }

  function findRow(rows, pattern, start = 0) {
    for (let index = Math.max(0, start); index < rows.length; index += 1) {
      if (pattern.test(String(rows[index]?.action || ""))) return index;
    }
    return -1;
  }

  function firstRestAfter(rows, index) {
    for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
      if (Number(rows[cursor]?.cmd) === 3) return cursor;
    }
    return -1;
  }

  function reindex(rows) {
    return rows.map((row, index) => ({
      ...row,
      hmi: index + 1,
      plc: index
    }));
  }

  function updateMotionPlan(rows, bodyStation, wipe, transitionIssue = null) {
    if (!state.motionPlan || typeof state.motionPlan !== "object") return;
    state.motionPlan.rows = rows;
    state.motionPlan.profileKind = "apl-map-driven-no-neck-body-back";
    state.motionPlan.noNeckBodyBackTransitionFixed = true;

    const stationPlan = Array.isArray(state.motionPlan.stationPlans)
      ? state.motionPlan.stationPlans.find((plan) => Number(plan.station) === Number(bodyStation) && plan.section === "body")
      : null;
    if (stationPlan) {
      stationPlan.requiredRotation = finite(wipe?.totalRequired, stationPlan.requiredRotation);
      stationPlan.movePath = [
        -finite(wipe?.backSpinRequired, finite(wipe?.stages?.[0]?.requiredRotation, 0)),
        finite(wipe?.forwardWipeRequired, finite(wipe?.stages?.[1]?.requiredRotation, 0))
      ];
      stationPlan.valid = true;
    }

    const retainedIssues = (Array.isArray(state.motionPlan.issues) ? state.motionPlan.issues : [])
      .filter((issue) => issue?.code !== "apl-no-neck-body-back-transition-capacity");
    if (transitionIssue) retainedIssues.push(transitionIssue);
    state.motionPlan.issues = retainedIssues;
  }

  function fixBodyToBackBoundary(sourceRows, map) {
    if (!isNoNeckBodyBackProgram() || !Array.isArray(sourceRows) || !sourceRows.length || !map) return sourceRows;

    const sequence = activeStationSequence(map);
    const firstBackIndex = sequence.findIndex((entry) => entry.section === "back");
    if (firstBackIndex <= 0) return sourceRows;
    const bodyStations = sequence.slice(0, firstBackIndex).filter((entry) => entry.section === "body");
    const bodyEntry = bodyStations.at(-1);
    const backEntry = sequence[firstBackIndex];
    if (!bodyEntry || !backEntry) return sourceRows;

    let rows = sourceRows.map((row) => ({ ...row }));
    const turn1Index = findRow(rows, actionPattern(1, "Body", bodyEntry.station));
    const turn2Index = findRow(rows, actionPattern(2, "Body", bodyEntry.station), turn1Index + 1);
    const restIndex = turn2Index >= 0 ? firstRestAfter(rows, turn2Index) : -1;
    if (turn1Index < 0 || turn2Index < 0 || restIndex < 0) return sourceRows;

    const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan("body") : null;
    const backSpin = finite(wipe?.backSpinRequired, finite(wipe?.stages?.[0]?.requiredRotation, 0));
    const forward = finite(wipe?.forwardWipeRequired, finite(wipe?.stages?.[1]?.requiredRotation, 0));
    if (!(backSpin > EPSILON) || !(forward > EPSILON)) return sourceRows;

    const bodyApplication = finite(rows[turn1Index].plateAngle, 0);
    const setDownAngle = bodyApplication - backSpin;
    const completeBodyAngle = setDownAngle + forward;

    rows[turn1Index] = {
      ...rows[turn1Index],
      plateAngle: finish(bodyApplication),
      action: `Wipe Turn 1 Body - Agg ${bodyEntry.station}`,
      section: "body",
      station: bodyEntry.station,
      plannedRotation: -backSpin,
      noNeckBodyBackFix: true
    };
    rows[turn2Index] = {
      ...rows[turn2Index],
      plateAngle: finish(setDownAngle),
      action: `Wipe Turn 2 Body - Agg ${bodyEntry.station}`,
      section: "body",
      station: bodyEntry.station,
      plannedRotation: forward,
      noNeckBodyBackFix: true
    };
    rows[restIndex] = {
      ...rows[restIndex],
      plateAngle: finish(completeBodyAngle),
      action: `Wipe Hold Body - Agg ${bodyEntry.station}`,
      section: "body",
      station: bodyEntry.station,
      bodyWipeCompletedBeforeBackAlignment: true,
      noNeckBodyBackFix: true
    };

    // Remove any previously generated body-to-back shortcut. That shortcut
    // used the second body wipe to land on the back-label target, which reduced
    // the actual body wipe and produced the Aggregate 4 coverage fault.
    const backWipeIndexBeforeRemoval = findRow(rows, actionPattern(1, "Back", backEntry.station), restIndex + 1);
    const obsolete = new Set();
    if (backWipeIndexBeforeRemoval > restIndex) {
      const backApplication = applicationPattern("Back", backEntry.station);
      for (let index = restIndex + 1; index < backWipeIndexBeforeRemoval; index += 1) {
        if (backApplication.test(String(rows[index]?.action || ""))) obsolete.add(index);
      }
    }
    if (obsolete.size) rows = rows.filter((_, index) => !obsolete.has(index));

    const bodyRestIndex = findRow(rows, new RegExp(`Wipe\\s+Hold\\s+Body\\s*-\\s*Agg\\s*${bodyEntry.station}(?:\\D|$)`, "i"));
    const backWipeIndex = findRow(rows, actionPattern(1, "Back", backEntry.station), bodyRestIndex + 1);
    if (bodyRestIndex < 0 || backWipeIndex < 0) return reindex(rows);

    const seed = typeof generatedAplSeedProfile === "function" ? generatedAplSeedProfile() : [];
    const rawBackTarget = finite(seed?.[21]?.plateAngle, completeBodyAngle);
    const backTarget = nearestEquivalent(rawBackTarget, completeBodyAngle);
    const aggregateAngle = finite(map.aggregateAngles?.[String(backEntry.station)], finite(map.stationAngles?.[String(backEntry.station)], NaN));
    const arriveEarly = finite(typeof profileTiming !== "undefined" ? profileTiming.spenderArriveEarly : 1, 1);
    const applicationTable = aggregateAngle - arriveEarly;
    const moveStartTable = finite(rows[bodyRestIndex].tableAngle, 0) + 0.5;
    const available = applicationTable - moveStartTable;
    const rotation = backTarget - completeBodyAngle;
    const ratio = Math.abs(rotation) / Math.max(EPSILON, available);
    let transitionIssue = null;

    if (Number.isFinite(applicationTable) && available > EPSILON) {
      const transitionRows = [
        {
          ...rows[bodyRestIndex],
          hmi: 0,
          plc: 0,
          cmd: 7,
          tableAngle: finish(moveStartTable),
          plateAngle: finish(completeBodyAngle),
          action: `Turn for Back Application - Agg ${backEntry.station}`,
          section: "back",
          station: backEntry.station,
          plannedRotation: rotation,
          plannedRatio: ratio,
          bodyBackTransition: true,
          noNeckBodyBackFix: true,
          terminalRest: false
        },
        {
          ...rows[bodyRestIndex],
          hmi: 0,
          plc: 0,
          cmd: 3,
          tableAngle: finish(applicationTable),
          plateAngle: finish(backTarget),
          action: `Hold for Back Application - Agg ${backEntry.station}`,
          section: "back",
          station: backEntry.station,
          plannedRotation: rotation,
          plannedRatio: ratio,
          backApplicationReference: true,
          bodyBackTransition: true,
          noNeckBodyBackFix: true,
          terminalRest: false
        }
      ];
      rows.splice(backWipeIndex, 0, ...transitionRows);

      if (ratio >= finite(state.maxMoveRatio, 21)) {
        transitionIssue = {
          level: "bad",
          code: "apl-no-neck-body-back-transition-capacity",
          station: backEntry.station,
          section: "back",
          message: `The completed body wipe needs ${Math.abs(rotation).toFixed(1)} deg of bottle rotation before Back Aggregate ${backEntry.station}, but only ${available.toFixed(1)} deg of table travel is available (${ratio.toFixed(2)}:1; limit ${finite(state.maxMoveRatio, 21).toFixed(1)}:1). Move the back aggregate later or end the final body pad earlier.`
        };
      }
    } else {
      transitionIssue = {
        level: "bad",
        code: "apl-no-neck-body-back-transition-capacity",
        station: backEntry.station,
        section: "back",
        message: `Back Aggregate ${backEntry.station} begins before the final body wipe can finish. Move the back aggregate later or end the final body pad earlier.`
      };
    }

    rows = reindex(rows);
    const finalized = window.LabelerServoCommandDriver?.finalize
      ? window.LabelerServoCommandDriver.finalize(rows)
      : rows;
    const reindexed = reindex(finalized);
    updateMotionPlan(reindexed, bodyEntry.station, wipe, transitionIssue);
    return reindexed;
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || typeof generatedAplMapDrivenProfile !== "function"
      || generatedAplMapDrivenProfile.noNeckBodyBackTransitionFix) return false;

    const before = generatedAplMapDrivenProfile;
    generatedAplMapDrivenProfile = function generatedAplMapDrivenProfileWithBodyBackTransition(machineMap, ...args) {
      const rows = before.call(this, machineMap, ...args);
      return fixBodyToBackBoundary(rows, machineMap);
    };
    generatedAplMapDrivenProfile.noNeckBodyBackTransitionFix = true;
    installed = true;

    try {
      if (isNoNeckBodyBackProgram() && typeof applyGeneratedServoProfile === "function") {
        applyGeneratedServoProfile();
        if (typeof render === "function") render();
      }
    } catch (error) {
      console.error("Unable to refresh the no-neck Body/Back APL profile.", error);
    }
    return true;
  }

  function wait() {
    if (install()) return;
    window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();