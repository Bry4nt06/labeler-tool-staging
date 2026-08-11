"use strict";

(function installBottleOrientationPanelRecovery(global) {
  if (global.ServoForgeBottleOrientationPanelRecovery?.installed) return;

  const sources = ["program", "simulation"];
  const observers = new Map();
  let recoveryQueued = false;

  function api() { return global.LabelerBottleOrientationPanel || null; }

  function recoverSource(source) {
    const visual = api();
    const host = document.getElementById(source);
    if (!visual?.renderSource || !host) return false;
    if (!host.querySelector(`[data-bottle-orientation-panel="${source}"]`)) {
      visual.renderSource(source);
    }
    return Boolean(host.querySelector(`[data-bottle-orientation-panel="${source}"]`));
  }

  function recoverAll() {
    recoveryQueued = false;
    sources.forEach(recoverSource);
  }

  function queueRecovery() {
    if (recoveryQueued) return;
    recoveryQueued = true;
    global.requestAnimationFrame ? global.requestAnimationFrame(recoverAll) : global.setTimeout(recoverAll, 0);
  }

  function observeHost(source) {
    const host = document.getElementById(source);
    if (!host || observers.has(source) || typeof MutationObserver !== "function") return false;
    const observer = new MutationObserver(() => {
      if (!host.querySelector(`[data-bottle-orientation-panel="${source}"]`)) queueRecovery();
    });
    observer.observe(host, { childList: true });
    observers.set(source, observer);
    return true;
  }

  function install() {
    sources.forEach(observeHost);
    recoverAll();
    global.setTimeout(recoverAll, 150);
    global.setTimeout(recoverAll, 750);
    global.setTimeout(recoverAll, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  global.addEventListener("load", recoverAll, { once: true });

  global.ServoForgeBottleOrientationPanelRecovery = Object.freeze({
    installed: true,
    version: 1,
    recoverSource,
    recoverAll,
    servoProgramPanelGuaranteedV75: true
  });
})(typeof window !== "undefined" ? window : globalThis);
