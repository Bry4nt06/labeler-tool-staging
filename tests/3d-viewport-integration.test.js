"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtime = read("app/3d/scene-runtime.js");
const geometry = read("app/3d/physical-geometry-adapter.js");
const carousel = read("app/3d/carousel-layout-adapter.js");
const labelGeometry = read("app/3d/label-geometry-adapter.js");
const labelMesh = read("app/3d/label-mesh-factory.js");
const wipeGeometry = read("app/3d/wipe-pad-geometry-adapter.js");
const wipeMesh = read("app/3d/wipe-pad-mesh-factory.js");
const hardwareCatalog = read("app/3d/hardware-reference-catalog.js");
const hardwareMesh = read("app/3d/hardware-mesh-factory.js");
const equipment = read("app/3d/equipment-layout-adapter.js");
const viewport = read("app/3d/three-scene-renderer-v09.js");
const handlingViewport = read("app/3d/bottle-handling-viewport-integration.js");
const progressiveFlow = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
const viewportControls = read("app/3d/viewport-ui-controls-integration.js");
const spacingOverlay = read("app/3d/measured-spacing-overlay.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v09\.js/, "3D runtime must load the single starwheel viewport.");
assert.doesNotMatch(runtime, /three-scene-renderer-v08/);
assert.match(runtime, /Labeler3DLabelGeometryAdapter/);
assert.match(runtime, /Labeler3DLabelMeshFactory/);
assert.match(runtime, /Labeler3DHardwareReferenceCatalog/);
assert.match(runtime, /Labeler3DHardwareMeshFactory/);
assert.match(runtime, /snapshotAuthority:\s*"canonical-3d-render-frame"/);
assert.match(runtime, /viewportAuthority:\s*"starwheel-bottle-handling-single-scene-v09"/);
assert.match(runtime, /legacyCarouselViewportRetired:\s*true/);
assert.match(runtime, /labelWrapAuthority:\s*"active-servoforge-label-spec"/);
assert.match(runtime, /sensorsRenderedIn3D:\s*true/);
assert.match(runtime, /coderRenderedIn3D:\s*true/);
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/);

const labelGeometryIndex = bootstrap.indexOf("app/3d/label-geometry-adapter.js");
const labelMeshIndex = bootstrap.indexOf("app/3d/label-mesh-factory.js");
const wipeGeometryIndex = bootstrap.indexOf("app/3d/wipe-pad-geometry-adapter.js");
const wipeMeshIndex = bootstrap.indexOf("app/3d/wipe-pad-mesh-factory.js");
const hardwareCatalogIndex = bootstrap.indexOf("app/3d/hardware-reference-catalog.js");
const hardwareMeshIndex = bootstrap.indexOf("app/3d/hardware-mesh-factory.js");
const handlingViewportIndex = bootstrap.indexOf("app/3d/bottle-handling-viewport-integration.js");
const progressiveFlowIndex = bootstrap.indexOf("app/3d/bottle-handling-progressive-label-flow-integration.js");
const controlsIndex = bootstrap.indexOf("app/3d/viewport-ui-controls-integration.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");
assert.ok(labelGeometryIndex >= 0);
assert.ok(labelMeshIndex > labelGeometryIndex);
assert.ok(wipeGeometryIndex > labelMeshIndex);
assert.ok(wipeMeshIndex > wipeGeometryIndex);
assert.ok(hardwareCatalogIndex > wipeMeshIndex);
assert.ok(hardwareMeshIndex > hardwareCatalogIndex);
assert.ok(handlingViewportIndex > hardwareMeshIndex);
assert.ok(progressiveFlowIndex > handlingViewportIndex);
assert.ok(controlsIndex > progressiveFlowIndex);
assert.ok(runtimeIndex > controlsIndex);
assert.doesNotMatch(bootstrap, /bottle-handling-progressive-label-authority-integration|three-scene-renderer-v08/);

assert.match(geometry, /centerSpacingMm:\s*110/);
assert.match(geometry, /edgeClearanceMm:\s*16/);
assert.match(geometry, /pitchRadiusFromChordSpacing/);
assert.match(carousel, /servoforge\.3d-carousel\.v1/);
assert.match(carousel, /neutral-no-invented-motion/);
assert.match(labelGeometry, /servoforge\.3d-labels\.v1/);
assert.match(labelMesh, /servoforge\.3d-label-mesh\.v1/);
assert.match(labelMesh, /curvedLabelGeometry/);
assert.match(wipeGeometry, /heightMm:\s*70/);
assert.match(wipeGeometry, /spongeThicknessMm:\s*18/);
assert.match(wipeGeometry, /backingPlateThicknessMm:\s*4/);
assert.match(wipeMesh, /ServoForgeWipePadSponge18mm/);
assert.match(wipeMesh, /ServoForgeWipePadSteelBacking4mm/);
assert.match(hardwareCatalog, /servoforge\.3d-hardware-reference\.v1/);
assert.match(hardwareMesh, /createSpenderPlateAssembly/);
assert.match(hardwareMesh, /createRollerAssembly/);
assert.match(hardwareMesh, /createCoderAssembly/);
assert.match(hardwareMesh, /createSensorAssembly/);
assert.match(equipment, /machine-map-angle-plus-user-measured-wipe-contact-geometry/);
assert.match(equipment, /sensorFieldOfViewDegrees/);

assert.match(viewport, /servoforge\.3d-viewport\.v0\.9/);
assert.match(viewport, /new THREE\.WebGLRenderer/);
assert.match(viewport, /new THREE\.PerspectiveCamera/);
assert.match(viewport, /new THREE\.Scene\(\)/);
assert.match(viewport, /ServoForgeCanonicalBottleHandlingScene/);
assert.match(viewport, /handling\.attachScene\(scene\)/);
assert.match(viewport, /handlingViewport\(\)\?\.sync\?\.\(snapshot\)/);
assert.match(viewport, /progressiveLabelFlow\(\)\?\.sync\?\.\(snapshot\)/);
assert.match(viewport, /viewportControls\(\)\?\.syncScene\?\.\(scene, camera, snapshot\)/);
assert.match(viewport, /sceneAuthority:\s*"starwheel-bottle-handling-only"/);
assert.match(viewport, /legacyCarouselEnvironment:\s*false/);
assert.match(viewport, /ServoForge 3D • Bottle Handling/);
assert.match(viewport, /Follow Head 1/);
assert.doesNotMatch(viewport, /ServoForgeBottleTablePopulation|createHeadAssembly|createBottleModel|carouselBody|carouselTop|pathRing/);

assert.match(handlingViewport, /servoforge\.3d-bottle-handling-viewport\.v5/);
assert.match(handlingViewport, /function attachScene\(sceneRoot\)/);
assert.match(handlingViewport, /ServoForgeBottleHandlingSystem/);
assert.match(handlingViewport, /prototypeSceneHook:\s*false/);
assert.match(handlingViewport, /singleSceneAuthority:\s*true/);
assert.doesNotMatch(handlingViewport, /\.prototype\.add\s*=/);
assert.doesNotMatch(handlingViewport, /requestAnimationFrame\s*\(/);

assert.match(progressiveFlow, /servoforge\.3d-progressive-label-flow\.v2/);
assert.match(progressiveFlow, /function sync\(snapshot\)/);
assert.match(progressiveFlow, /snapshotAuthority:\s*"canonical-3d-render-frame"/);
assert.doesNotMatch(progressiveFlow, /requestAnimationFrame\s*\(/);
assert.doesNotMatch(progressiveFlow, /\.prototype\.add\s*=/);

assert.match(viewportControls, /servoforge\.3d-viewport-ui-controls\.v5/);
assert.match(viewportControls, /function syncScene\(scene, camera, snapshot/);
assert.match(viewportControls, /independentAnimationLoop:\s*false/);
assert.match(viewportControls, /objectHooksInstalled:\s*false/);
assert.doesNotMatch(viewportControls, /requestAnimationFrame\s*\(/);
assert.doesNotMatch(viewportControls, /\.prototype\.(?:add|lookAt)\s*=/);

assert.match(spacingOverlay, /Plate center spacing/);
assert.match(spacingOverlay, /measuredCenterSpacingMm:\s*110/);
assert.match(spacingOverlay, /independentTimer:\s*false/);
assert.match(spacingOverlay, /addFrameListener/);
assert.doesNotMatch(spacingOverlay, /setInterval\s*\(/);
assert.doesNotMatch(spacingOverlay, /\.snapshot\s*\(/);

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /state\.simulation/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(viewport, pattern, `3D viewport must not mutate ServoForge program state: ${pattern}`);
  assert.doesNotMatch(equipment, pattern, `3D equipment adapter must not mutate ServoForge program state: ${pattern}`);
  assert.doesNotMatch(wipeMesh, pattern, `Measured wipe-pad mesh factory must remain presentation-only: ${pattern}`);
  assert.doesNotMatch(labelMesh, pattern, `Bottle label mesh factory must remain presentation-only: ${pattern}`);
  assert.doesNotMatch(hardwareMesh, pattern, `Hardware mesh factory must remain presentation-only: ${pattern}`);
});

[
  [carousel, "app/3d/carousel-layout-adapter.js"],
  [labelGeometry, "app/3d/label-geometry-adapter.js"],
  [labelMesh, "app/3d/label-mesh-factory.js"],
  [wipeMesh, "app/3d/wipe-pad-mesh-factory.js"],
  [hardwareCatalog, "app/3d/hardware-reference-catalog.js"],
  [hardwareMesh, "app/3d/hardware-mesh-factory.js"],
  [equipment, "app/3d/equipment-layout-adapter.js"],
  [viewport, "app/3d/three-scene-renderer-v09.js"],
  [handlingViewport, "app/3d/bottle-handling-viewport-integration.js"],
  [progressiveFlow, "app/3d/bottle-handling-progressive-label-flow-integration.js"],
  [viewportControls, "app/3d/viewport-ui-controls-integration.js"],
  [spacingOverlay, "app/3d/measured-spacing-overlay.js"]
].forEach(([source, filename]) => {
  assert.doesNotThrow(() => new vm.Script(source, { filename }));
});

console.log("ServoForge single starwheel 3D viewport boundary regression passed.");
