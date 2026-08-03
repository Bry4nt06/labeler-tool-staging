"use strict";

(function installWorkspacePanelController(global) {
  if (global.LabelerWorkspacePanelController?.installed) return;

  function setWipeTelemetryOpen(open) {
    if (!els.wipeDownDataPanel) return false;
    const visible = Boolean(open);
    els.wipeDownDataPanel.hidden = !visible;
    els.showWipeDownData?.setAttribute("aria-expanded", String(visible));
    if (visible && typeof renderWipeDownData === "function") renderWipeDownData();
    return visible;
  }

  function toggleWipeTelemetry() {
    return setWipeTelemetryOpen(els.wipeDownDataPanel?.hidden !== false);
  }

  function initialize() {
    if (els.wipeDownDataPanel) els.wipeDownDataPanel.hidden = true;
    els.showWipeDownData?.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest?.("#showWipeDownData")) toggleWipeTelemetry();
    else if (target.closest?.("#closeWipeDownData")) setWipeTelemetryOpen(false);
    else return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  global.LabelerWorkspacePanelController = Object.freeze({
    installed: true,
    initialize,
    setWipeTelemetryOpen,
    toggleWipeTelemetry
  });
})(window);
