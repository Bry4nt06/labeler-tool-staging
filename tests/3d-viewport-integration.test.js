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
const viewport = read("app/3d/three-scene-renderer-v08.js");
const spacingOverlay = read("app/3d/measured-spacing-overlay.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v08\.js/, "3D runtime must load the hardware-reference viewport.");
assert.match(runtime, /Labeler3DLabelGeometryAdapter/, "Runtime must require the label geometry contract.");
assert.match(runtime, /Labeler3DLabelMeshFactory/, "Runtime must require the label mesh factory.");
assert.match(runtime, /Labeler3DHardwareReferenceCatalog/, "Runtime must require the hardware reference catalog.");
assert.match(runtime, /Labeler3DHardwareMeshFactory/, "Runtime must require the hardware mesh factory.");
assert.match(runtime, /labelWrapAuthority:\s*"active-servoforge-label-spec"/);
assert.match(runtime, /labelArtworkAuthority:\s*false/);
assert.match(runtime, /labelBodyBackVerticalAuthority:\s*false/);
assert.match(runtime, /spenderPlateMechanicalHierarchyAuthority:\s*true/);
assert.match(runtime, /spenderPlateDimensionalAuthority:\s*false/);
assert.match(runtime, /sensorsRenderedIn3D:\s*true/);
assert.match(runtime, /sensorRuntimeDataPreserved:\s*true/);
assert.match(runtime, /coderRenderedIn3D:\s*true/);
assert.match(runtime, /coderTimingLogicUntouched:\s*true/);
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/);

const labelGeometryIndex = bootstrap.indexOf("app/3d/label-geometry-adapter.js");
const labelMeshIndex = bootstrap.indexOf("app/3d/label-mesh-factory.js");
const wipeGeometryIndex = bootstrap.indexOf("app/3d/wipe-pad-geometry-adapter.js");
const wipeMeshIndex = bootstrap.indexOf("app/3d/wipe-pad-mesh-factory.js");
const hardwareCatalogIndex = bootstrap.indexOf("app/3d/hardware-reference-catalog.js");
const hardwareMeshIndex = bootstrap.indexOf("app/3d/hardware-mesh-factory.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");
assert.ok(labelGeometryIndex >= 0);
assert.ok(labelMeshIndex > labelGeometryIndex);
assert.ok(wipeGeometryIndex > labelMeshIndex);
assert.ok(wipeMeshIndex > wipeGeometryIndex);
assert.ok(hardwareCatalogIndex > wipeMeshIndex);
assert.ok(hardwareMeshIndex > hardwareCatalogIndex);
assert.ok(equipmentIndex > hardwareMeshIndex);
assert.ok(runtimeIndex > equipmentIndex);

assert.match(geometry, /centerSpacingMm:\s*110/);
assert.match(geometry, /edgeClearanceMm:\s*16/);
assert.match(geometry, /pitchRadiusFromChordSpacing/);
assert.match(carousel, /servoforge\.3d-carousel\.v1/);
assert.match(carousel, /neutral-no-invented-motion/);

assert.match(labelGeometry, /servoforge\.3d-labels\.v1/);
assert.match(labelGeometry, /CENTER_ANGLES/);
assert.match(labelGeometry, /back:\s*180/);
assert.match(labelGeometry, /active-servoforge-label-spec/);
assert.match(labelGeometry, /reference-until-body-back-label-height-is-stored/);
assert.match(labelGeometry, /bottleHasPassedApplication/);
assert.match(labelMesh, /servoforge\.3d-label-mesh\.v1/);
assert.match(labelMesh, /curvedLabelGeometry/);
assert.match(labelMesh, /radiusAtY/);
assert.match(labelMesh, /new THREE\.CanvasTexture/);
assert.match(labelMesh, /REFERENCE ART/);
assert.match(labelMesh, /ServoForgeBottleLabels/);

assert.match(wipeGeometry, /heightMm:\s*70/);
assert.match(wipeGeometry, /spongeThicknessMm:\s*18/);
assert.match(wipeGeometry, /backingPlateThicknessMm:\s*4/);
assert.match(wipeGeometry, /totalThicknessMm:\s*22/);
assert.match(wipeGeometry, /bottlePenetrationMm:\s*2/);
assert.match(wipeMesh, /annularPrismGeometry/);
assert.match(wipeMesh, /ServoForgeWipePadSponge18mm/);
assert.match(wipeMesh, /ServoForgeWipePadSteelBacking4mm/);

assert.match(hardwareCatalog, /servoforge\.3d-hardware-reference\.v1/);
assert.match(hardwareCatalog, /user-supplied-machine-photos-2026-08-18/);
assert.match(hardwareCatalog, /application-spender/);
assert.match(hardwareCatalog, /wipe-roller/);
assert.match(hardwareCatalog, /laser-coder/);
assert.match(hardwareCatalog, /label-sensor/);
assert.match(hardwareMesh, /servoforge\.3d-hardware-mesh\.v1/);
assert.match(hardwareMesh, /createSpenderPlateAssembly/);
assert.match(hardwareMesh, /ServoForgeApplicationArmRoot/);
assert.match(hardwareMesh, /ServoForgeForwardAnglePivot/);
assert.match(hardwareMesh, /ServoForgeSideAnglePivot/);
assert.match(hardwareMesh, /ServoForgeEngagementAnglePivot/);
assert.match(hardwareMesh, /createRollerAssembly/);
assert.match(hardwareMesh, /createCoderAssembly/);
assert.match(hardwareMesh, /createSensorAssembly/);
assert.match(hardwareMesh, /sensorFieldOfViewDegrees/);
assert.match(hardwareMesh, /beamPresentationOnly:\s*true/);
assert.match(hardwareMesh, /fovAuthority:\s*"servoforge-runtime-data"/);

assert.match(equipment, /machine-map-angle-plus-user-measured-wipe-contact-geometry/);
assert.match(equipment, /machine-map-aggregate-centerline/);
assert.match(equipment, /sensorFieldOfViewDegrees/);
assert.match(equipment, /orientationTarget/);

assert.match(viewport, /servoforge\.3d-viewport\.v0\.8/);
assert.match(viewport, /0\.185\.1/);
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/);
assert.match(viewport, /new THREE\.WebGLRenderer/);
assert.match(viewport, /new THREE\.PerspectiveCamera/);
assert.match(viewport, /new THREE\.LatheGeometry/);
assert.match(viewport, /Hardware Reference/);
assert.match(viewport, /Hardware authority:/);
assert.match(viewport, /factory\?\.createAggregateAssembly/);
assert.match(viewport, /factory\?\.createEquipmentAssembly/);
assert.match(viewport, /sensorsRendered:\s*true/);
assert.match(viewport, /coderRendered:\s*true/);
assert.match(viewport, /sensorLogicUntouched:\s*true/);
assert.match(viewport, /coderLogicUntouched:\s*true/);
assert.match(viewport, /activeServoPlate\.rotation\.y/);
assert.match(viewport, /handlingViewport\?\.attach\?\.\(scene\)/);
assert.match(viewport, /handlingViewport\?\.sync\?\.\(snapshot\)/);
assert.doesNotMatch(viewport, /ServoForgeLiveBottle|createBottleModel|activeBottleModel/);
assert.match(viewport, /Follow Head 1/);
assert.match(viewport, /requestAnimationFrame/);
assert.match(viewport, /textContent = "3D View"/);

assert.match(spacingOverlay, /Plate center spacing/);
assert.match(spacingOverlay, /measuredCenterSpacingMm:\s*110/);
assert.match(spacingOverlay, /measuredClearanceMm:\s*16/);
assert.match(spacingOverlay, /derivedPlateDiameterMm:\s*94/);

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

const syntaxSandbox = { window: {}, console, setTimeout() { return 0; } };
syntaxSandbox.window = syntaxSandbox;
syntaxSandbox.globalThis = syntaxSandbox;
vm.createContext(syntaxSandbox);
assert.doesNotThrow(() => vm.runInContext(carousel, syntaxSandbox, { filename: "app/3d/carousel-layout-adapter.js" }));
assert.doesNotThrow(() => vm.runInContext(labelGeometry, syntaxSandbox, { filename: "app/3d/label-geometry-adapter.js" }));
assert.doesNotThrow(() => vm.runInContext(labelMesh, syntaxSandbox, { filename: "app/3d/label-mesh-factory.js" }));
assert.doesNotThrow(() => vm.runInContext(wipeMesh, syntaxSandbox, { filename: "app/3d/wipe-pad-mesh-factory.js" }));
assert.doesNotThrow(() => vm.runInContext(hardwareCatalog, syntaxSandbox, { filename: "app/3d/hardware-reference-catalog.js" }));
assert.doesNotThrow(() => vm.runInContext(hardwareMesh, syntaxSandbox, { filename: "app/3d/hardware-mesh-factory.js" }));
assert.doesNotThrow(() => vm.runInContext(equipment, syntaxSandbox, { filename: "app/3d/equipment-layout-adapter.js" }));
assert.doesNotThrow(() => vm.runInContext(viewport, syntaxSandbox, { filename: "app/3d/three-scene-renderer-v08.js" }));

console.log("ServoForge hardware-reference 3D viewport boundary regression passed.");
