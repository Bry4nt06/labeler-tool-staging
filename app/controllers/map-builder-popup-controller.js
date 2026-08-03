"use strict";

(function installMapBuilderPopupController(global) {
  if (global.LabelerMapBuilderPopupController?.installed) return;

  function control(id, fallback) {
    return document.querySelector(`#${id}`) || fallback || null;
  }

  function elements() {
    return {
      button: control("wipeDownBuilderButton", global.els?.applicationSetupButton),
      dialog: control("applicationSetupDialog", global.els?.applicationSetupDialog),
      close: control("closeApplicationSetup", global.els?.closeApplicationSetup),
      apply: control("applyApplicationSetup", global.els?.applyApplicationSetup),
      rightRail: control("mapRightRail", global.els?.mapRightRail),
      labelerMapReference: control("labelerMapReference", global.els?.labelerMapReference),
      list: control("wipeBuilderList", global.els?.wipeBuilderList),
      status: control("builderStatus", global.els?.builderStatus)
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setVisibility(open) {
    const ui = elements();
    const visible = Boolean(open);
    global.state.wipeBuilderOpen = visible;
    if (ui.dialog) ui.dialog.hidden = !visible;
    ui.rightRail?.classList.toggle("builder-open", visible);
    ui.labelerMapReference?.classList.toggle("builder-open", visible);
    ui.button?.setAttribute("aria-expanded", String(visible));
    ui.button?.setAttribute("aria-pressed", String(visible));
    document.body?.classList.toggle("map-builder-popup-open", visible);
    return ui;
  }

  function showFailure(error) {
    const ui = elements();
    const message = error?.message || String(error || "Unknown Map Builder error");
    console.error("Map Builder popup failed to initialize", error);
    if (ui.list) {
      ui.list.innerHTML = `<div class="notice bad"><strong>Map Builder could not load.</strong><span>${escapeHtml(message)}</span></div>`;
    }
    if (ui.status) ui.status.textContent = `Map Builder error • ${message}`;
  }

  function ensureRendered() {
    const ui = elements();
    try {
      if (typeof global.ensurePersistentApplicationMaps !== "function") {
        throw new Error("Map library service is unavailable.");
      }
      global.ensurePersistentApplicationMaps();
      const activeMap = typeof global.activeMachineMap === "function"
        ? global.activeMachineMap()
        : global.state.mapLibrary?.find((map) => map.id === global.state.activeMapId) || global.state.mapLibrary?.[0];
      if (!activeMap) throw new Error("No machine map is available to edit.");
      if (typeof global.renderWipeDownBuilder !== "function") {
        throw new Error("Map Builder renderer is unavailable.");
      }

      global.renderWipeDownBuilder();
      if (ui.list && !ui.list.children.length) {
        ui.list.innerHTML = '<div class="notice"><strong>No configured map objects.</strong><span>Use Add Object to begin building this machine map.</span></div>';
      }
      if (ui.status) ui.status.textContent = "Changes are applied live.";
      return true;
    } catch (error) {
      showFailure(error);
      return false;
    }
  }

  function open() {
    const ui = setVisibility(true);
    ensureRendered();
    global.requestAnimationFrame?.(() => {
      ensureRendered();
      ui.dialog?.focus?.({ preventScroll: true });
    });
    if (typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
  }

  function close() {
    setVisibility(false);
    if (typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
  }

  function toggle() {
    if (global.state.wipeBuilderOpen && !elements().dialog?.hidden) close();
    else open();
  }

  function apply() {
    if (typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
    close();
    if (typeof global.render === "function") global.render();
  }

  function ownedControl(target, id) {
    return target?.closest?.(`#${id}`) || null;
  }

  // Register before the general setup-event boundary. This popup has a
  // dedicated lifecycle because it must become visible before its dynamic
  // controls are rendered and measured.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (ownedControl(target, "wipeDownBuilderButton")) toggle();
    else if (ownedControl(target, "closeApplicationSetup")) close();
    else if (ownedControl(target, "applyApplicationSetup")) apply();
    else return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  global.LabelerMapBuilderPopupController = Object.freeze({
    installed: true,
    open,
    close,
    toggle,
    apply,
    ensureRendered
  });
})(window);
