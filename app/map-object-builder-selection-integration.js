"use strict";

(function installMapObjectBuilderSelection() {
  const RETRY_MS = 50;
  const CLICK_DISTANCE_PX = 7;
  let installed = false;
  let pendingPointer = null;

  function activeMap() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function objectFromId(objectId) {
    return activeMap()?.objects?.find((item) => String(item.id) === String(objectId)) || null;
  }

  function ensureBuilderOpen() {
    state.wipeBuilderOpen = true;
    const drawer = document.querySelector("#applicationSetupDialog");
    const rightRail = document.querySelector("#mapRightRail");
    const reference = document.querySelector("#labelerMapReference");
    if (drawer) drawer.hidden = false;
    rightRail?.classList.add("builder-open");
    reference?.classList.add("builder-open");
  }

  function scrollToSelectedObject(objectId) {
    window.requestAnimationFrame(() => {
      const list = document.querySelector("#wipeBuilderList");
      if (!list) return;
      const selector = `[data-builder-object-id="${CSS.escape(String(objectId))}"]`;
      const editor = list.querySelector(selector);
      if (!editor) return;
      const stationGroup = editor.closest(".configured-station-group");
      if (stationGroup) stationGroup.open = true;
      editor.open = true;
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectAndOpenObject(objectId) {
    const item = objectFromId(objectId);
    if (!item) return;

    state.selectedMapObjectId = String(objectId);
    try {
      if (typeof builderExpandedStation !== "undefined") {
        builderExpandedStation = String(item.kind === "coding" ? "coding" : item.station);
      }
    } catch {
      // The builder can still render and locate the selected object by ID.
    }

    ensureBuilderOpen();
    try { if (typeof renderMap === "function") renderMap(); } catch { }
    try { if (typeof renderWipeDownBuilder === "function") renderWipeDownBuilder(); } catch { }
    try { if (typeof saveCurrentSettings === "function") saveCurrentSettings(); } catch { }
    scrollToSelectedObject(objectId);
  }

  function mapObjectNode(event) {
    return event.target?.closest?.("#mapSvg [data-map-object-id]") || null;
  }

  function beginSelection(event) {
    if (event.button !== 0) return;
    const node = mapObjectNode(event);
    if (!node) return;
    const objectId = String(node.dataset.mapObjectId || "");
    if (!objectId || !objectFromId(objectId)) return;

    pendingPointer = {
      pointerId: event.pointerId,
      objectId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };

    // The workspace outside-click handler runs later during this same
    // pointerdown. Mark the event so its synthetic Close button click can be
    // ignored without blocking the SVG's normal drag handler.
    document.documentElement.dataset.mapObjectSelectionPointer = "true";
    window.queueMicrotask(() => {
      delete document.documentElement.dataset.mapObjectSelectionPointer;
    });
  }

  function trackSelection(event) {
    if (!pendingPointer || event.pointerId !== pendingPointer.pointerId) return;
    if (Math.hypot(event.clientX - pendingPointer.startX, event.clientY - pendingPointer.startY) >= CLICK_DISTANCE_PX) {
      pendingPointer.moved = true;
    }
  }

  function finishSelection(event) {
    if (!pendingPointer || event.pointerId !== pendingPointer.pointerId) return;
    const completed = pendingPointer;
    pendingPointer = null;
    if (completed.moved) return;

    // Run after the native SVG pointerup handler. On locked maps that handler
    // finishes a pan gesture; this final selection restores the intended map
    // object and opens its editor.
    window.setTimeout(() => selectAndOpenObject(completed.objectId), 0);
  }

  function cancelSelection(event) {
    if (pendingPointer && event.pointerId === pendingPointer.pointerId) pendingPointer = null;
  }

  function protectBuilderFromSelectionClose(event) {
    if (document.documentElement.dataset.mapObjectSelectionPointer !== "true") return;
    const closeButton = event.target?.closest?.("#closeApplicationSetup");
    if (!closeButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function installStyles() {
    if (document.querySelector("#mapObjectBuilderSelectionStyles")) return;
    const style = document.createElement("style");
    style.id = "mapObjectBuilderSelectionStyles";
    style.textContent = `
      #mapSvg [data-map-object-id]{cursor:pointer}
      #mapSvg.map-is-locked [data-map-object-id]{cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || !document.querySelector("#mapSvg")) return false;
    installed = true;
    installStyles();
    document.addEventListener("pointerdown", beginSelection, true);
    document.addEventListener("pointermove", trackSelection, true);
    document.addEventListener("pointerup", finishSelection, false);
    document.addEventListener("pointercancel", cancelSelection, true);
    document.addEventListener("click", protectBuilderFromSelectionClose, true);
    return true;
  }

  function wait() {
    if (install()) return;
    window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
