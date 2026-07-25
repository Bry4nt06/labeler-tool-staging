"use strict";

// Temporarily remove Zone/Site from the field workflow while preserving the
// stored metadata for backward compatibility with existing settings and maps.
function removeZoneSiteControls() {
  document.querySelector("#developerMenu")?.remove();
  document.querySelector("#mapZone")?.closest("label")?.remove();
  document.querySelector("#mapSite")?.closest("label")?.remove();
  document.querySelector("#buildInputs .zone-site-selection")?.remove();
}

// Saved maps are no longer filtered by Zone/Site in Map Builder.
if (typeof mapsForMapLibraryLocation === "function") {
  mapsForMapLibraryLocation = () => [...state.mapLibrary];
}

// Build Inputs is rebuilt during normal rendering, so remove its location
// controls after every render rather than only during initial startup.
if (typeof renderBuildInputs === "function") {
  const renderBuildInputsWithoutLocation = renderBuildInputs;
  renderBuildInputs = function renderBuildInputsWithoutZoneSite(...args) {
    const result = renderBuildInputsWithoutLocation.apply(this, args);
    document.querySelector("#buildInputs .zone-site-selection")?.remove();
    return result;
  };
}

// Keep all map-related display switches together in the Map Overlays panel.
const quadrantControl = document.querySelector("#showQuadrantReferences")?.closest("label");
const mapOverlayPanel = document.querySelector(".map-overlay-control");
if (quadrantControl && mapOverlayPanel) {
  mapOverlayPanel.querySelector("h2")?.insertAdjacentElement("afterend", quadrantControl);
}

removeZoneSiteControls();
initializeLabelerApp();
removeZoneSiteControls();
