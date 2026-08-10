"use strict";

(function installRuntimeContextBridge(global) {
  if (global.LabelerRuntimeContextBridge?.installed) return;

  let runtimeState = null;
  let runtimeElements = null;
  try { runtimeState = state; } catch { runtimeState = global.state || null; }
  try { runtimeElements = els; } catch { runtimeElements = global.els || null; }

  if (!runtimeState || !runtimeElements) {
    throw new Error("ServoForge runtime context is unavailable before Map Builder startup.");
  }

  // Several extracted integration modules are intentionally wrapped in IIFEs
  // and receive `window` as their runtime boundary. The original application
  // state and DOM registry are global lexical bindings, not Window properties.
  // Publish references to those same objects so integrations using global.state
  // or global.els do not silently wait forever for a property that can never
  // otherwise exist.
  global.state = runtimeState;
  global.els = runtimeElements;

  global.LabelerRuntimeContextBridge = Object.freeze({
    installed: true,
    state: runtimeState,
    elements: runtimeElements,
    globalLexicalBridgeV1: true
  });
})(typeof window !== "undefined" ? window : globalThis);
