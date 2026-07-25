"use strict";

(function installMilestonesSixAndSeven() {
  const RELEASE_VERSION = "0.8.2";
  const RETRY_MS = 25;
  let installed = false;

  function activeMachineType() {
    const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
    return String(map?.machineType || map?.name || "TopModul");
  }

  function isTopModulMachine() {
    return /top\s*modul/i.test(activeMachineType());
  }

  function topModulChainIssues(rows, tolerance = 0.001) {
    const source = Array.isArray(rows) ? rows : [];
    const issues = [];
    let openChain = null;
    let lastReferenceIndex = null;
    let chainNumber = 0;

    source.forEach((row, index) => {
      const command = Number(row?.cmd);
      const hmi = row?.hmi ?? index + 1;
      const next = source[index + 1];
      const plateTravel = next && Number.isFinite(Number(row?.plateAngle)) && Number.isFinite(Number(next?.plateAngle))
        ? Number(next.plateAngle) - Number(row.plateAngle)
        : 0;

      if (command === 3) {
        if (openChain) {
          openChain.endHmi = hmi;
          openChain = null;
        }
        lastReferenceIndex = index;
        return;
      }

      if (command !== 7) {
        if (openChain) {
          issues.push({
            level: "bad",
            code: "topmodul-chain-interrupted",
            category: "grammar",
            hmi,
            message: `TopModul correction chain ${openChain.id} is interrupted by CMD ${command} before a CMD 3 reference.`
          });
          openChain = null;
        }
        lastReferenceIndex = null;
        return;
      }

      if (!openChain) {
        chainNumber += 1;
        openChain = { id: `CC${String(chainNumber).padStart(2, "0")}`, startHmi: hmi };
        if (lastReferenceIndex === null || Number(source[lastReferenceIndex]?.cmd) !== 3) {
          issues.push({
            level: "bad",
            code: "topmodul-chain-missing-start-reference",
            category: "grammar",
            hmi,
            message: `TopModul correction chain ${openChain.id} begins at HMI ${hmi} without an earlier CMD 3 reference.`
          });
        }
      }

      if (!next) {
        issues.push({
          level: "bad",
          code: "topmodul-chain-missing-end-reference",
          category: "grammar",
          hmi,
          message: `TopModul correction chain ${openChain.id} reaches the end of the curve without a closing CMD 3 reference.`
        });
      }

      if (Math.abs(plateTravel) <= tolerance && row?.activeHold !== true && !String(row?.motionSource || "").includes("inactive")) {
        issues.push({
          level: "bad",
          code: "topmodul-empty-correction",
          category: "motion",
          hmi,
          message: `HMI ${hmi} is CMD 7 but produces no bottle-plate movement.`
        });
      }
    });

    if (openChain) {
      const last = source[source.length - 1];
      const hmi = last?.hmi ?? source.length;
      if (!issues.some((issue) => issue.code === "topmodul-chain-missing-end-reference" && issue.hmi === hmi)) {
        issues.push({
          level: "bad",
          code: "topmodul-chain-missing-end-reference",
          category: "grammar",
          hmi,
          message: `TopModul correction chain ${openChain.id} must close at a CMD 3 reference.`
        });
      }
    }

    if (!issues.some((issue) => issue.level === "bad")) {
      issues.push({
        level: "ok",
        code: "topmodul-correction-chain-ok",
        category: "grammar",
        message: "TopModul correction-chain grammar is valid: CMD 3 → one or more CMD 7 commands → CMD 3."
      });
    }
    return issues;
  }

  function summarizeIssues(issues) {
    const summary = { bad: 0, warn: 0, ok: 0, total: issues.length };
    const categories = {};
    issues.forEach((issue) => {
      const level = issue.level || "warn";
      summary[level] = (summary[level] || 0) + 1;
      const category = issue.category || "general";
      categories[category] ||= { bad: 0, warn: 0, ok: 0, total: 0 };
      categories[category][level] = (categories[category][level] || 0) + 1;
      categories[category].total += 1;
    });
    return { summary, categories };
  }

  function installTopModulValidator() {
    const base = window.LabelerServoPipelineValidator;
    if (!base?.analyze || base.topModulCorrectionChains) return;
    const ignoredCodes = new Set([
      "correction-missing-leading-reference",
      "correction-missing-trailing-reference",
      "legacy-grammar-ok"
    ]);

    window.LabelerServoPipelineValidator = Object.freeze({
      ...base,
      topModulCorrectionChains: true,
      analyze(options = {}) {
        const result = base.analyze(options);
        if (!isTopModulMachine()) return result;
        const retained = (result.issues || []).filter((issue) => !ignoredCodes.has(issue.code));
        const chainIssues = topModulChainIssues(options.rows, options.tolerance);
        const seen = new Set();
        const issues = [...retained, ...chainIssues].filter((issue) => {
          const key = `${issue.level}|${issue.code}|${issue.hmi ?? ""}|${issue.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const { summary, categories } = summarizeIssues(issues);
        return {
          ...result,
          valid: summary.bad === 0,
          status: summary.bad ? "FAIL" : summary.warn ? "REVIEW" : "PASS",
          summary,
          categories,
          issues,
          grammar: "TOPMODUL_CORRECTION_CHAIN"
        };
      }
    });
  }

  function plannerOptions() {
    const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
    return {
      map,
      machineType: activeMachineType(),
      applicationMode: state.applicationMode,
      objects: map?.objects || [],
      aplObjects: state.aplMapObjects,
      coldGlueObjects: state.coldGlueMap
    };
  }

  function installMechanicalEventPlanner() {
    const planner = window.LabelerMechanicalEventPlannerDriver;
    if (!planner?.buildPlan) return false;
    window.LabelerMotionPlannerDriver = Object.freeze({
      ...planner,
      buildPlan(rows, options = {}) {
        return planner.buildPlan(rows, { ...plannerOptions(), ...options });
      },
      buildTimeline(rows, options = {}) {
        return planner.buildTimeline(rows, { ...plannerOptions(), ...options });
      }
    });
    return true;
  }

  function applyMechanicalEventsToCurrentProgram() {
    if (typeof applyGeneratedServoProfile === "function") {
      applyGeneratedServoProfile();
    }
    const planner = window.LabelerMotionPlannerDriver;
    if (!planner?.buildPlan || !Array.isArray(state.program)) return;
    const selectedProfile = typeof allMotionProfiles === "function"
      ? allMotionProfiles().find((profile) => profile.id === (state.selectedMotionProfileId || state.defaultMotionProfileId || "automatic"))
      : null;
    const machineProfile = typeof resolveProfileMachine === "function" ? resolveProfileMachine(selectedProfile) : "APL";
    const plan = planner.buildPlan(state.program, {
      profileId: selectedProfile?.id || "automatic",
      machineProfile,
      customIntents: selectedProfile?.builtIn ? [] : selectedProfile?.intents || []
    });
    state.mechanicalTimeline = {
      source: plan.source,
      machineType: plan.machineType,
      applicationMode: plan.applicationMode,
      events: plan.events,
      processes: plan.processes,
      eventSummary: plan.eventSummary
    };
    state.motionPlan = {
      ...(state.motionPlan || {}),
      planner: plan,
      mechanicalTimeline: state.mechanicalTimeline
    };
  }

  function installMilestoneStyles() {
    if (document.querySelector("#milestone67Styles")) return;
    const style = document.createElement("style");
    style.id = "milestone67Styles";
    style.textContent = `
      .mechanical-event-process { color:var(--muted);font-size:7px;font-weight:600; }
      .topmodul-chain-badge { display:inline-flex;margin-left:4px;padding:1px 4px;border:1px solid var(--line);border-radius:999px;color:#ffc56b;font-size:7px;vertical-align:middle; }
    `;
    document.head.appendChild(style);
  }

  function decorateMechanicalTimeline() {
    const plan = state.motionPlan?.planner;
    if (!plan?.steps?.length) return;
    const cards = document.querySelectorAll(".mechanical-event");
    cards.forEach((card, index) => {
      const step = plan.steps[index];
      if (!step) return;
      card.dataset.mechanicalEventId = step.eventId || "";
      card.dataset.processId = step.processId || "";
      card.dataset.correctionChain = step.correctionChainId || "";
      const small = card.querySelector("small");
      if (small && step.processId && !small.querySelector(".mechanical-event-process")) {
        small.insertAdjacentHTML("beforeend", `<span class="mechanical-event-process">${step.processId}</span>`);
      }
      const strong = card.querySelector("strong");
      if (strong && step.correctionChainId && !strong.querySelector(".topmodul-chain-badge")) {
        strong.insertAdjacentHTML("beforeend", `<span class="topmodul-chain-badge">${step.correctionChainId}</span>`);
      }
    });
  }

  function installRenderDecoration() {
    if (typeof enhanceProgramWithMotionPlanner !== "function" || enhanceProgramWithMotionPlanner.milestone67) return;
    const before = enhanceProgramWithMotionPlanner;
    enhanceProgramWithMotionPlanner = function enhanceProgramWithMechanicalEvents(...args) {
      const output = before.apply(this, args);
      decorateMechanicalTimeline();
      return output;
    };
    enhanceProgramWithMotionPlanner.milestone67 = true;
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined"
      || !window.LabelerMechanicalEventPlannerDriver
      || !window.LabelerServoPipelineValidator
      || typeof applyGeneratedServoProfile !== "function") return false;

    installed = true;
    installMilestoneStyles();
    installMechanicalEventPlanner();
    installTopModulValidator();
    installRenderDecoration();
    applyMechanicalEventsToCurrentProgram();

    const versionMeta = document.querySelector('meta[name="application-version"]');
    if (versionMeta) versionMeta.content = RELEASE_VERSION;
    const versionStatus = document.querySelector("#updateCheckStatus");
    if (versionStatus) versionStatus.textContent = `Version ${RELEASE_VERSION} • Updates are checked automatically.`;

    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    if (typeof render === "function") render();
    return true;
  }

  function waitForDependencies() {
    if (install()) return;
    window.setTimeout(waitForDependencies, RETRY_MS);
  }

  waitForDependencies();
})();
