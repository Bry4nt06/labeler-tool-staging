"use strict";

importScripts(
  "./l5k-analyzer-core.js?v=1",
  "./l5k-analyzer-legacy-v4.js?v=4.1",
  "./l5k-analyzer-dependencies-v5.js?v=5",
  "./l5k-analyzer-discrepancies-v6.js?v=6",
  "./l5k-analyzer-task-schedule-v7.js?v=7",
  "./l5k-analyzer-communication-v8.js?v=8",
  "./l5k-analyzer-message-v9.js?v=9",
  "./l5k-analyzer-consistency-v10.js?v=10",
  "./l5k-analyzer-sequence-v11.js?v=11",
  "./l5k-analyzer-interlocks-v12.js?v=12",
  "./l5k-analyzer-recovery-v13.js?v=13",
  "./l5k-analyzer-afi-v14.js?v=14",
  "./l5x-analyzer-adapter-v15.js?v=15",
  "./l5x-source-provenance-v15.js?v=15"
);

self.addEventListener("message", (event) => {
  const payload = event.data || {};
  if (payload.type !== "analyze") return;
  try {
    const analyzer = self.ServoForgeL5KAnalyzer;
    const parseSource = analyzer.parseControllerSource || analyzer.parseL5K;
    const project = parseSource(payload.text || "", {
      fileName: payload.fileName || null,
      byteLength: payload.byteLength || 0
    });
    self.postMessage({ type: "result", project });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || String(error),
      stack: error?.stack || ""
    });
  }
});
