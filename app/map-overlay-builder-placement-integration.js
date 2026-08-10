"use strict";

(function installMapOverlayBuilderPlacement(global) {
  if (global.LabelerMapOverlayBuilderPlacement?.installed) return;

  const source = document.querySelector(".map-overlay-control");
  const anchor = document.querySelector("#objectDepthSection");
  if (!source || !anchor) {
    throw new Error("Map Overlay controls or Map Builder placement anchor are unavailable.");
  }

  const details = document.createElement("details");
  details.id = "mapOverlaySettingsSection";
  details.className = "builder-card collapsible-builder-section map-overlay-builder-section";

  const summary = document.createElement("summary");
  summary.innerHTML = "<span><strong>Map Overlays</strong><small>Control servo-motion overlays shown on the Mechanical Map.</small></span>";

  const content = document.createElement("div");
  content.className = "collapsible-builder-content";

  source.querySelectorAll("label.switch-setting").forEach((label) => {
    label.classList.add("map-overlay-builder-toggle");
    content.appendChild(label);
  });

  details.append(summary, content);
  anchor.insertAdjacentElement("afterend", details);
  source.remove();

  global.LabelerMapOverlayBuilderPlacement = Object.freeze({
    installed: true,
    section: details,
    movedIntoMapBuilderV1: true
  });
})(typeof window !== "undefined" ? window : globalThis);
