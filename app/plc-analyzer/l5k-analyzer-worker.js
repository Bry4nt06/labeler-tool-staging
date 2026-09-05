"use strict";

importScripts("./l5k-analyzer-core.js?v=1", "./l5k-analyzer-legacy-v4.js?v=4");

self.addEventListener("message", (event) => {
  const payload = event.data || {};
  if (payload.type !== "analyze") return;
  try {
    const project = self.ServoForgeL5KAnalyzer.parseL5K(payload.text || "", {
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
