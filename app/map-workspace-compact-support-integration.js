"use strict";

(function installMapWorkspaceCompactSupport(global) {
  if (global.ServoForgeMapWorkspaceCompactSupport?.installed) return;

  const STYLE_ID = "servoforge-map-workspace-compact-support-v75";
  const SUPPORT_CLASS = "map-support-panels";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .map-area.servoforge-compact-map-panel {
        min-height: 0;
        height: auto;
        align-self: start;
        grid-template-rows: auto auto auto;
      }
      .map-area.servoforge-compact-map-panel .map-stage {
        height: clamp(400px, 52vh, 520px);
        min-height: 400px;
      }
      .map-area.servoforge-compact-map-panel .map-canvas,
      .map-area.servoforge-compact-map-panel #mapSvg {
        height: 100%;
        min-height: 400px;
      }
      .map-support-panels {
        display: grid;
        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
        gap: 10px;
        align-items: start;
        margin-top: 10px;
      }
      .map-support-panels > .panel {
        min-width: 0;
        width: 100%;
        margin: 0;
        box-shadow: none;
      }
      .map-support-panels > .map-overlay-control {
        padding: 10px;
      }
      .map-support-panels > .wipe-down-data-panel {
        position: static;
        inset: auto;
        max-width: none;
        max-height: none;
      }
      .map-support-panels:has(.wipe-down-data-panel[hidden]) > .map-overlay-control {
        grid-column: 1 / -1;
      }
      @media (min-width: 1250px) {
        .workspace-view-direct .map-area.servoforge-compact-map-panel .map-stage {
          height: clamp(400px, 48vh, 480px);
          min-height: 400px;
        }
        .workspace-view-direct .map-area.servoforge-compact-map-panel .map-canvas,
        .workspace-view-direct .map-area.servoforge-compact-map-panel #mapSvg {
          min-height: 400px;
        }
      }
      @media (max-width: 760px) {
        .map-support-panels { grid-template-columns: 1fr; }
        .map-support-panels > .map-overlay-control { grid-column: auto; }
      }
    `;
    document.head.appendChild(style);
  }

  function installLayout() {
    ensureStyles();
    const mapArea = document.querySelector(".map-area");
    const mapStage = mapArea?.querySelector(".map-stage");
    const overlays = document.querySelector(".map-overlay-control");
    const wipeDown = document.querySelector("#wipeDownDataPanel");
    if (!mapArea || !mapStage || !overlays || !wipeDown) return false;

    mapArea.classList.add("servoforge-compact-map-panel");
    let support = mapArea.querySelector(`.${SUPPORT_CLASS}`);
    if (!support) {
      support = document.createElement("section");
      support.className = SUPPORT_CLASS;
      support.setAttribute("aria-label", "Mechanical map support panels");
      mapStage.insertAdjacentElement("afterend", support);
    }
    if (overlays.parentElement !== support) support.appendChild(overlays);
    if (wipeDown.parentElement !== support) support.appendChild(wipeDown);
    return true;
  }

  function installWhenReady() {
    if (installLayout()) return;
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (installLayout() || attempts >= 40) global.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installWhenReady, { once: true });
  else installWhenReady();
  global.addEventListener("load", installLayout, { once: true });

  global.ServoForgeMapWorkspaceCompactSupport = Object.freeze({
    installed: true,
    version: 1,
    installLayout,
    supportPanelsBelowMapV75: true,
    directMapHeightCappedV75: true
  });
})(typeof window !== "undefined" ? window : globalThis);
