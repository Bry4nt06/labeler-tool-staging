"use strict";

// Compatibility-only migration for settings created before maps became
// global records. New maps and exports do not retain location metadata.
function purgeDeprecatedMapLocationMetadata(target = state) {
  if (!target || typeof target !== "object") return target;
  [
    "selected" + "Zone",
    "selected" + "Site",
    "mapLibrary" + "Zone",
    "mapLibrary" + "Site",
    "zoneSite" + "Configuration"
  ].forEach((key) => delete target[key]);
  if (Array.isArray(target.mapLibrary)) {
    target.mapLibrary.forEach((map) => {
      if (!map || typeof map !== "object") return;
      delete map.zone;
      delete map.site;
    });
  }
  return target;
}

function removeDeprecatedLocationControls() {
  ["#mapZone", "#mapSite"].forEach((selector) => {
    const control = document.querySelector(selector);
    (control?.closest("label") || control)?.remove();
  });
  document.querySelectorAll(".zone-site-editor,.zone-site-selection,.developer-menu-actions").forEach((node) => node.remove());
}

function normalizedZoneSiteName() {
  return "";
}

function normalizeZoneSiteConfiguration() {
  return { zones: {} };
}

function zoneNames() {
  return [];
}

function sitesForZone() {
  return [];
}

function ensureSelectedZoneAndSite() {
  purgeDeprecatedMapLocationMetadata();
}

function zoneSiteConfigurationDocument() {
  return {
    format: "servoforge-retired-location-metadata",
    version: 1,
    exportedAt: new Date().toISOString()
  };
}

function saveZoneSiteConfiguration() {
  purgeDeprecatedMapLocationMetadata();
  if (typeof saveCurrentSettings === "function") saveCurrentSettings();
}

function renderZoneSiteDeveloperMenu() {
  removeDeprecatedLocationControls();
}

function importZoneSiteConfigurationFile() {
  window.alert("Location configuration is no longer used. Maps are available globally by map name.");
}

function bindZoneSiteDeveloperMenu() {
  purgeDeprecatedMapLocationMetadata();
  removeDeprecatedLocationControls();
}

purgeDeprecatedMapLocationMetadata();
removeDeprecatedLocationControls();
