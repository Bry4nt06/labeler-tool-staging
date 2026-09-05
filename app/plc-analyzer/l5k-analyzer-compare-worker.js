"use strict";

importScripts(
  "./l5k-analyzer-core.js?v=1",
  "./l5k-analyzer-legacy-v4.js?v=4.1",
  "./l5k-analyzer-dependencies-v5.js?v=5",
  "./l5k-analyzer-compare.js?v=2",
  "./l5k-analyzer-compare-dependencies-v5-2.js?v=5.2"
);

self.onmessage = (event) => {
  const payload = event.data || {};
  if (payload.type !== "compare") return;
  try {
    const core = self.ServoForgeL5KAnalyzer;
    const compare = self.ServoForgeL5KCompare;
    if (!core || !compare) throw new Error("PLC Analyzer comparison dependencies did not load.");
    const baseline = core.parseL5K(payload.baselineText || "", {
      fileName: payload.baselineFileName || "baseline.l5k",
      byteLength: payload.baselineByteLength || String(payload.baselineText || "").length
    });
    const current = core.parseL5K(payload.currentText || "", {
      fileName: payload.currentFileName || "current.l5k",
      byteLength: payload.currentByteLength || String(payload.currentText || "").length
    });
    const comparison = compare.compareProjects(baseline, current, {
      baselineLabel: payload.baselineFileName || "Baseline",
      currentLabel: payload.currentFileName || "Current"
    });
    self.postMessage({ type: "result", baseline, current, comparison });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || String(error),
      stack: error?.stack || null
    });
  }
};
