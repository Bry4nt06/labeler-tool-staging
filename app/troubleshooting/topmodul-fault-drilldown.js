"use strict";

(function installTopModulFaultDrillDown(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulFaultDrillDownExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.topModulNamedFaultCount) {
      throw new Error("TopModul PLC fault catalog is required before fault drill-down.");
    }

    const catalogEntries = Object.freeze(base.entries.filter((entry) => entry?.plcFault?.array === "Faults_LB1"));

    function broadFamily(family = "") {
      if (family.startsWith("Labeler encoder")) return "labeler-encoder";
      if (family.startsWith("Servo axis")) return "servo-axis";
      if (family.startsWith("Safety")) return "safety";
      if (family.startsWith("Labeling station")) return "labeling-station";
      if (family.startsWith("Controls")) return "controls";
      if (family.startsWith("Electrical")) return "electrical";
      if (family.startsWith("Synchronization")) return "synchronization";
      if (family.startsWith("Servo bottle table")) return "servo-bottle-table";
      if (family.startsWith("Main machine encoder")) return "main-encoder";
      return family.toLowerCase();
    }

    function resolveFault(value) {
      if (!value) return null;
      if (typeof value === "object" && value.plcFault) return value;
      if (typeof value === "string" && value.startsWith("topmodul-plc-fault-")) return base.getEntry(value);
      return base.getTopModulFault(value);
    }

    function parentSummaryNumbers(station) {
      if (!station) return [];
      return [641 + station, 648 + station, 662 + station];
    }

    function sameStationRootCandidates(station) {
      if (!station) return [];
      const stationBase = 1024 + (station - 1) * 80;
      const offsets = [2, 3, 5, 6, 7, 9, 10, 11, 14, 16, 21, 22, 23, 24, 26, 28, 29, 30, 31, 32, 40, 45, 46, 53, 54, 64, 65, 66, 67, 68, 69];
      return offsets.map((offset) => stationBase + offset);
    }

    function relationScore(source, candidate) {
      if (!source?.plcFault || !candidate?.plcFault || source.id === candidate.id) return { score: 0, reason: "" };
      const sourceFamily = source.plcFault.family || "";
      const candidateFamily = candidate.plcFault.family || "";
      const sourceBroad = broadFamily(sourceFamily);
      const candidateBroad = broadFamily(candidateFamily);
      const sourceStation = source.plcFault.station;
      const candidateStation = candidate.plcFault.station;
      const sameStation = sourceStation && candidateStation === sourceStation;
      let score = 0;
      let reason = "";

      if (sameStation) score += 30;
      if (candidateFamily === sourceFamily) score += 35;
      if (candidateBroad === sourceBroad) score += 22;

      if (sourceBroad === "labeler-encoder" && sameStation) {
        if (candidateBroad === "labeler-encoder") { score += 75; reason = "Same station encoder supervision"; }
        else if (candidateBroad === "synchronization") { score += 48; reason = "Synchronization can be downstream of encoder state"; }
        else if (candidateBroad === "servo-axis" && /feedback|position|sercos|module/i.test(candidateFamily)) { score += 28; reason = "Same station motion feedback path"; }
        else if (/reference/i.test(candidateFamily)) { score += 18; reason = "Same station reference/timing evidence"; }
      }

      if (sourceBroad === "servo-axis" && sameStation) {
        if (candidateBroad === "servo-axis") { score += 70; reason = "Same station servo-axis diagnostic family"; }
        else if (candidateBroad === "labeler-encoder") { score += 30; reason = "Encoder feedback can affect station motion/synchronization"; }
        else if (candidateBroad === "synchronization") { score += 34; reason = "Same station synchronization state"; }
      }

      if (sourceFamily === "Labeling station / readiness" && sameStation) {
        if (candidateFamily !== "Labeling station / readiness") { score += 70; reason = "Underlying station fault candidate"; }
      }

      if (sourceFamily === "Synchronization / motion group" && sameStation) {
        if (["labeler-encoder", "servo-axis"].includes(candidateBroad) || /reference/i.test(candidateFamily)) {
          score += 65;
          reason = "Likely upstream synchronization evidence";
        }
      }

      if (sourceFamily === "Labeling station / main contactor" && sameStation) {
        if (["safety", "controls", "electrical", "servo-axis"].includes(candidateBroad) || candidateFamily === "Labeling station / web-feed-rewind") {
          score += 55;
          reason = "Upstream condition that can inhibit station contactor/readiness";
        }
      }

      if (sourceFamily === "Labeling station / web-feed-rewind" && sameStation) {
        if (candidateFamily === "Labeling station / web-feed-rewind") { score += 60; reason = "Same label web/feed/rewind path"; }
        else if (candidateFamily === "Electrical protection") { score += 24; reason = "Feed/rewind protected-load evidence"; }
      }

      if (sourceBroad === "main-encoder") {
        if ([480, 482, 490, 669, 670].includes(candidate.number)) {
          score += 80;
          reason = "Main-drive/fine-clock monitoring relationship";
        }
      }

      if (sourceBroad === "servo-bottle-table" && candidateBroad === "servo-bottle-table") {
        score += 75;
        reason = "Same RPC bottle-table servo fault family";
      }

      if (sourceBroad === "controls" && candidateBroad === "controls") {
        score += 50;
        reason = "Same communication/control path";
      }

      if (sourceBroad === "electrical" && candidateBroad === "electrical") {
        score += 45;
        reason = "Same electrical protection path";
      }

      if (sourceStation && parentSummaryNumbers(sourceStation).includes(candidate.number)) {
        score += 28;
        if (!reason) reason = "Parent station summary alarm";
      }

      if (sourceStation && sameStationRootCandidates(sourceStation).includes(candidate.number)) {
        score += 12;
        if (!reason) reason = "Same station root-cause candidate";
      }

      return { score, reason: reason || (sameStation ? "Same station related fault" : "Related diagnostic family") };
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const source = resolveFault(value);
      if (!source?.plcFault) return [];
      return catalogEntries
        .map((candidate) => {
          const relation = relationScore(source, candidate);
          return relation.score > 0 ? { ...candidate, relationScore: relation.score, relationReason: relation.reason } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.relationScore - a.relationScore || a.number - b.number)
        .slice(0, Math.max(1, Number(limit) || 10));
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const entry = resolveFault(value);
      if (!entry?.plcFault) return null;
      const related = getTopModulFaultRelations(entry, limit);
      const station = entry.plcFault.station;
      const family = entry.plcFault.family;
      return Object.freeze({
        entry,
        station,
        family,
        traceStatus: entry.plcFault.traceStatus,
        related,
        prompt: station
          ? `Fault ${entry.code} is in Labeling Station ${station}. Check faults that occurred first in this station before treating summary/downstream alarms as root cause.`
          : `Fault ${entry.code} is a ${family} alarm. Use related faults to narrow the upstream subsystem before component-level tracing.`
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const encoder = getTopModulFaultRelations(1091, 10);
      if (!encoder.some((entry) => entry.number === 1090)) errors.push("Fault 1091 drill-down does not include station encoder sync fault 1090.");
      if (!encoder.some((entry) => entry.number === 1092)) errors.push("Fault 1091 drill-down does not include station encoder feedback-noise fault 1092.");
      const readiness = getTopModulFaultRelations(663, 12);
      if (!readiness.some((entry) => entry.plcFault.station === 1 && entry.number >= 1024)) errors.push("Station 1 readiness drill-down has no station-block root candidate.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-fault-drilldown-v1`,
      getTopModulFaultRelations,
      getTopModulFaultDrillDown,
      validate
    });
  };
});
