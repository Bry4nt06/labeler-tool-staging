"use strict";

const fs = require("fs");

const VERSION = "0.9.10";
const PREVIOUS_BUILD = "autocol-codebox-orientation-v122-20260815-0001";
const BUILD = "map-builder-object-add-v123-20260816-0735";
const UPDATED = "Aug 16, 2026 7:35 AM ET";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replace(path, transform) {
  const current = read(path);
  const next = transform(current);
  if (next === current) throw new Error(`${path} was not changed.`);
  write(path, next);
}

function replaceOnce(value, before, after, label) {
  if (value.includes(after)) return value;
  const index = value.indexOf(before);
  if (index < 0) throw new Error(`Unable to find ${label}.`);
  return value.slice(0, index) + after + value.slice(index + before.length);
}

replace("app/defaults.js", (value) => replaceOnce(
  value,
  '  builderObjectEnd: document.querySelector("#builderObjectEnd"),\n  builderSensorAimOffsetDeg: document.querySelector("#builderSensorAimOffsetDeg"),',
  '  builderObjectEnd: document.querySelector("#builderObjectEnd"),\n  builderObjectExtension: document.querySelector("#builderObjectExtension"),\n  builderSensorAssist: document.querySelector("#builderSensorAssist"),\n  builderSensorVisibility: document.querySelector("#builderSensorVisibility"),\n  addBuilderObject: document.querySelector("#addBuilderObject"),\n  builderSensorAimOffsetDeg: document.querySelector("#builderSensorAimOffsetDeg"),',
  "current Map Builder element registry"
));

replace("app/controllers/map-controller.js", (value) => {
  let next = value.replace(
    '      setBuilderStatus(`STAGING 0.9.8 • ${machineMap.name} • ${objectCount} configured object${objectCount === 1 ? "" : "s"}`);',
    '      const releaseVersion = global.SERVOFORGE_RELEASE_VERSION || "0.9.10";\n      setBuilderStatus(`STAGING ${releaseVersion} • ${machineMap.name} • ${objectCount} configured object${objectCount === 1 ? "" : "s"}`);'
  );
  next = next.replace(
    '      actions.call("refreshAfterBuilderEdit", { persist: true });',
    '      actions.call("refreshAfterBuilderEdit", { persist: true, structural: true });'
  );
  if (next === value) throw new Error("Map controller v123 changes were not applied.");
  return next;
});

replace("app/map-builder-history-service.js", (value) => replaceOnce(
  value,
  'function refreshAfterBuilderEdit({ persist = false } = {}) {\n  syncApplicationMapToLegacyState();',
  'function refreshAfterBuilderEdit({ persist = false, structural = false } = {}) {\n  if (structural) {\n    const machineMap = typeof activeMachineMap === "function" ? activeMachineMap() : null;\n    if (machineMap) machineMap.localStructuralMapOverride = true;\n  }\n  syncApplicationMapToLegacyState();',
  "structural Map Builder persistence marker"
));

replace("app/map-builder-controller.js", (value) => {
  let next = value.replaceAll(
    'refreshAfterBuilderEdit({ persist: true });',
    'refreshAfterBuilderEdit({ persist: true, structural: true });'
  );
  next = replaceOnce(
    next,
    '  loadMachineMapIntoRuntime(machineMap, true);\n  saveCurrentSettings();\n  renderWipeDownBuilder();\n  return true;\n}\n\n// Compatibility entrypoint retained for modules that still call the original',
    '  machineMap.localStructuralMapOverride = true;\n  loadMachineMapIntoRuntime(machineMap, true);\n  saveCurrentSettings();\n  renderWipeDownBuilder();\n  return true;\n}\n\n// Compatibility entrypoint retained for modules that still call the original',
    "reset structural override marker"
  );
  if (!next.includes('refreshAfterBuilderEdit({ persist: true, structural: true });')) {
    throw new Error("Map Builder structural refresh was not applied.");
  }
  return next;
});

replace("app/controllers/map-builder-row-controller.js", (value) => {
  const next = value.replaceAll(
    'refreshAfterBuilderEdit({ persist: true });',
    'refreshAfterBuilderEdit({ persist: true, structural: true });'
  );
  if (next === value) throw new Error("Map Builder row structural persistence was not applied.");
  return next;
});

replace("app/company-default-map-catalog-integration.js", (value) => replaceOnce(
  value,
  '      const local = localById.get(key(packaged?.id));\n      if (!local?.localMachineSettingsOverride) return packaged;\n      return {\n        ...packaged,\n        machineSettings: clone(local.machineSettings || packaged.machineSettings),\n        localMachineSettingsOverride: true\n      };',
  '      const local = localById.get(key(packaged?.id));\n      if (local?.localStructuralMapOverride) {\n        return {\n          ...clone(local),\n          id: packaged.id,\n          companyDefaultProgram: true,\n          companyDefaultProgramVersion: packaged.companyDefaultProgramVersion,\n          protectedDefaultMap: true,\n          localStructuralMapOverride: true,\n          localMachineSettingsOverride: Boolean(local.localMachineSettingsOverride)\n        };\n      }\n      if (!local?.localMachineSettingsOverride) return packaged;\n      return {\n        ...packaged,\n        machineSettings: clone(local.machineSettings || packaged.machineSettings),\n        localMachineSettingsOverride: true\n      };',
  "protected default-map structural override reconciliation"
));

replace("app/controllers/map-builder-event-controller.js", (value) => {
  let next = replaceOnce(
    value,
    '  function consume(event, preventDefault = false) {\n    if (preventDefault) event.preventDefault();\n    event.stopImmediatePropagation();\n  }',
    '  function consume(event, preventDefault = false) {\n    if (preventDefault) event.preventDefault();\n    event.stopImmediatePropagation();\n  }\n\n  function runBuilderAction(label, action) {\n    try {\n      const result = action();\n      if (label === "Add map object" && !result) throw new Error("The Map Builder did not create an object.");\n      return result;\n    } catch (error) {\n      const message = error?.message || String(error || "Unknown Map Builder error");\n      console.error(`${label} failed`, error);\n      const status = document.querySelector("#builderStatus");\n      if (status) {\n        status.textContent = `${label} failed: ${message}`;\n        status.classList?.add("status-bad");\n      }\n      return null;\n    }\n  }',
    "Map Builder action error reporting"
  );
  next = next.replace(
    '    else if (target.closest("#addBuilderObject")) builder.addObject();',
    '    else if (target.closest("#addBuilderObject")) runBuilderAction("Add map object", () => builder.addObject());'
  );
  if (!next.includes('runBuilderAction("Add map object"')) throw new Error("Add Object error reporting was not wired.");
  return next;
});

replace("app/bootstrap.js", (value) => value
  .replace(/const build = "[^"]+";/, `const build = "${BUILD}";`)
  .replace(/const buildUpdatedAt = "[^"]+";/, `const buildUpdatedAt = "${UPDATED}";`));

replace("app.js", (value) => value.replace(/const build = "[^"]+";/, `const build = "${BUILD}";`));

replace("service-worker.js", (value) => value
  .replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "servoforge-labeler-staging-v${VERSION}-${BUILD}";`));

replace("index.html", (value) => value.replaceAll(PREVIOUS_BUILD, BUILD));

write("update-manifest.json", JSON.stringify({
  schemaVersion: 1,
  version: VERSION,
  buildId: BUILD,
  releaseUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  downloadUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  notes: "Map Builder object-add v123 repairs the current Add Object DOM binding, surfaces Add Object runtime failures in the builder status, and preserves locally edited object layouts on protected company-default maps. Structural Map Builder edits now mark the map as a local structural override so added, edited, duplicated, removed, and dragged objects survive persistence and company-default catalog reconciliation. Existing v122 Autocol coder orientation and servo behavior are unchanged."
}, null, 2) + "\n");

console.log(`Applied ${BUILD}.`);
