"use strict";

(function installAplNeckPadCenterTackIntegration() {
  const RETRY_MS = 50;
  let installed = false;

  function installedApplicationStations(machineMap) {
    return [...new Set((machineMap?.objects || [])
      .filter((item) => item?.kind === "roller" || item?.kind === "pad")
      .filter((item) => typeof isStationEnabled !== "function" || isStationEnabled(machineMap, Number(item.station)))
      .map((item) => Number(item.station))
      .filter((station) => Number.isFinite(station) && station >= 1 && station <= 6))]
      .sort((a, b) => a - b);
  }

  function inferSections(machineMap) {
    return typeof window.inferAplStationSections === "function"
      ? window.inferAplStationSections(machineMap)
      : {};
  }

  function singleSidedNeckPadStations(machineMap) {
    const sections = inferSections(machineMap);
    const result = [];
    installedApplicationStations(machineMap).forEach((station) => {
      if (sections[String(station)] !== "neck") return;
      const pads = (machineMap.objects || []).filter((item) => item?.kind === "pad" && Number(item.station) === station);
      if (!pads.length) return;
      const outside = pads.some((item) => item.side !== "inner");
      const inside = pads.some((item) => item.side === "inner");
      if (!outside || !inside) result.push({ station, pads, outside, inside });
    });
    return result;
  }

  function install() {
    if (installed) return true;
    if (typeof window.inferAplStationSections !== "function"
      || typeof window.generatedAplMapDrivenProfile !== "function") return false;

    installed = true;
    const baseGenerate = window.generatedAplMapDrivenProfile;


    window.generatedAplMapDrivenProfile = function generatedAplMapDrivenProfileWithNeckPads(machineMap) {
      const singleSided = singleSidedNeckPadStations(machineMap);
      const temporary = [];

      // The legacy pad branch split one physical pad into two virtual halves.
      // For Neck center-tack wiping that is mechanically invalid. Route a
      // single-sided pad through the two-surface branch so only its real side
      // moves and the missing opposite side is reported.
      singleSided.forEach(({ pads }) => {
        pads.forEach((pad) => {
          temporary.push({ pad, kind: pad.kind, wipeSpanDeg: pad.wipeSpanDeg });
          pad.kind = "roller";
          pad.wipeSpanDeg = Math.max(0.1, Number(pad.end) - Number(pad.start));
        });
      });

      try {
        const rows = baseGenerate(machineMap);
        if (state?.motionPlan) {
          state.motionPlan.profileVariant = "apl-neck-pad-center-tack-v1";
          state.motionPlan.stationPlans?.forEach((plan) => {
            if (inferSections(machineMap)[String(plan.station)] === "neck") {
              plan.section = "neck";
              plan.centerTack = true;
              plan.hardwareIndependentSection = true;
            }
          });
          state.motionPlan.issues = (state.motionPlan.issues || []).map((issue) => {
            if (issue?.code !== "apl-neck-roller-side-missing") return issue;
            const missing = singleSided.find((entry) => Number(entry.station) === Number(issue.station));
            if (!missing) return issue;
            return {
              ...issue,
              code: "apl-neck-pad-side-missing",
              message: `Station ${issue.station} is a Neck center-tack station and requires both an outside and inside wipe-down pad. Add the ${missing.outside ? "inside" : "outside"} pad so each label wing is wiped from the center toward its edge using the pad's actual table-contact window.`
            };
          });
        }
        return rows.map((row) => ({
          ...row,
          profileVariant: row.profileVariant || "apl-neck-pad-center-tack-v1"
        }));
      } finally {
        temporary.forEach(({ pad, kind, wipeSpanDeg }) => {
          pad.kind = kind;
          if (wipeSpanDeg === undefined) delete pad.wipeSpanDeg;
          else pad.wipeSpanDeg = wipeSpanDeg;
        });
      }
    };
    try { generatedAplMapDrivenProfile = window.generatedAplMapDrivenProfile; } catch { /* global property is sufficient */ }

    if (typeof renderWipeDownBuilder === "function") renderWipeDownBuilder();
    if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
    if (typeof render === "function") render();
    return true;
  }

  function wait() {
    if (install()) return;
    window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
