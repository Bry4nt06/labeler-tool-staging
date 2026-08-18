"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const catalogSource = read("app/3d/hardware-reference-catalog.js");
const factorySource = read("app/3d/hardware-mesh-factory.js");
const runtime = read("app/3d/scene-runtime.js");
const viewport = read("app/3d/three-scene-renderer-v08.js");

const catalogIndex = bootstrap.indexOf("app/3d/hardware-reference-catalog.js");
const factoryIndex = bootstrap.indexOf("app/3d/hardware-mesh-factory.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");
assert.ok(catalogIndex >= 0, "Hardware reference catalog must be bootstrap-loaded.");
assert.ok(factoryIndex > catalogIndex, "Hardware mesh factory must load after the catalog.");
assert.ok(equipmentIndex > factoryIndex, "Equipment layout must load after hardware presentation contracts.");
assert.ok(runtimeIndex > equipmentIndex, "3D runtime must load after the equipment adapter.");

const sandbox = { window: {}, console, Object, Array, Number, String, Boolean, Math };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
assert.doesNotThrow(() => vm.runInContext(catalogSource, sandbox, { filename: "app/3d/hardware-reference-catalog.js" }));
assert.doesNotThrow(() => vm.runInContext(factorySource, sandbox, { filename: "app/3d/hardware-mesh-factory.js" }));

const catalog = sandbox.Labeler3DHardwareReferenceCatalog;
assert.ok(catalog);
assert.strictEqual(catalog.CATALOG_VERSION, "servoforge.3d-hardware-reference.v2");
assert.strictEqual(catalog.REFERENCE_SET, "labeler-hardware-photo-set-2");
assert.strictEqual(catalog.profileIdForKind("pad"), "wipe-pad");
assert.strictEqual(catalog.profileIdForKind("roller"), "wipe-roller");
assert.strictEqual(catalog.profileIdForKind("coding"), "laser-coder");
assert.strictEqual(catalog.profileIdForKind("sensor"), "label-sensor");
assert.strictEqual(catalog.resolve({ aggregate: 1 }).id, "application-spender");
assert.strictEqual(catalog.profile("wipe-pad").dimensionalAuthority, true, "Measured wipe pad is the only currently dimension-authoritative hardware profile.");
assert.strictEqual(catalog.profile("wipe-roller").dimensionalAuthority, false);
assert.strictEqual(catalog.profile("laser-coder").dimensionalAuthority, false);
assert.strictEqual(catalog.profile("label-sensor").dimensionalAuthority, false);
assert.match(catalog.profile("application-spender").notes, /Exact CAD dimensions remain provisional/);

const spenderEvidence = catalog.profile("application-spender").evidence;
assert.ok(spenderEvidence.observedFeatures.includes("vertical guide roller adjacent to label web"));
assert.ok(spenderEvidence.observedFeatures.includes("plate mounted to adjustable tubular application arm"));
assert.ok(spenderEvidence.pendingMeasurements.includes("spender plate length mm"));
assert.ok(spenderEvidence.pendingMeasurements.includes("plate face to bottle-table centerline distance mm"));

const padEvidence = catalog.profile("wipe-pad").evidence;
assert.match(padEvidence.confidence, /measured-contact/);
assert.ok(padEvidence.observedFeatures.includes("curved orange/brown sponge contact face"));
assert.ok(padEvidence.observedFeatures.includes("dual vertical support posts"));

const rollerEvidence = catalog.profile("wipe-roller").evidence;
assert.ok(rollerEvidence.observedFeatures.includes("vertical cylindrical dark-rubber contact roller"));
assert.ok(rollerEvidence.pendingMeasurements.includes("roller outside diameter mm"));

const coderEvidence = catalog.profile("laser-coder").evidence;
assert.ok(coderEvidence.observedFeatures.includes("coding face aimed radially toward passing bottle"));
assert.ok(coderEvidence.pendingMeasurements.includes("coding face to bottle surface distance mm"));

const sensorEvidence = catalog.profile("label-sensor").evidence;
assert.ok(sensorEvidence.observedFeatures.includes("visible status LED"));
assert.ok(sensorEvidence.pendingMeasurements.includes("sensor face to bottle surface distance mm"));

const catalogStatus = catalog.status();
assert.strictEqual(catalogStatus.measuredProfileCount, 1);
assert.ok(catalogStatus.photoReferenceProfileCount >= 5);
assert.ok(catalogStatus.pendingMeasurementCount > 20);
assert.ok(catalogStatus.measurementBacklog["application-spender"].length > 0);
assert.ok(Object.isFrozen(catalogStatus));

assert.match(factorySource, /createSpenderPlateAssembly/);
assert.match(factorySource, /ServoForgeApplicationArmRoot/);
assert.match(factorySource, /ServoForgeForwardAnglePivot/);
assert.match(factorySource, /ServoForgeSideAnglePivot/);
assert.match(factorySource, /ServoForgeEngagementAnglePivot/);
assert.match(factorySource, /createRollerAssembly/);
assert.match(factorySource, /createCoderAssembly/);
assert.match(factorySource, /createSensorAssembly/);
assert.match(factorySource, /sensorFieldOfViewDegrees/);
assert.match(factorySource, /beamPresentationOnly:\s*true/);
assert.match(factorySource, /fovAuthority:\s*"servoforge-runtime-data"/);
assert.match(factorySource, /createMeasuredAssembly/);
assert.match(factorySource, /mountingDimensionalAuthority:\s*false/);

assert.match(runtime, /three-scene-renderer-v08\.js/);
assert.match(runtime, /sensorsRenderedIn3D:\s*true/);
assert.match(runtime, /coderRenderedIn3D:\s*true/);
assert.match(runtime, /rollersRenderedIn3D:\s*true/);
assert.match(runtime, /sensorRuntimeDataPreserved:\s*true/);
assert.match(runtime, /coderTimingLogicUntouched:\s*true/);
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/);

assert.match(viewport, /servoforge\.3d-viewport\.v0\.8/);
assert.match(viewport, /Hardware Reference/);
assert.match(viewport, /factory\?\.createEquipmentAssembly/);
assert.match(viewport, /Sensors/);
assert.match(viewport, /Coders/);
assert.match(viewport, /sensorsRendered:\s*true/);
assert.match(viewport, /coderRendered:\s*true/);
assert.match(viewport, /sensorLogicUntouched:\s*true/);
assert.match(viewport, /coderLogicUntouched:\s*true/);

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /simulation\.lines\s*=/,
  /state\.simulation/
].forEach((pattern) => {
  assert.doesNotMatch(factorySource, pattern, `Hardware mesh factory must be presentation-only: ${pattern}`);
  assert.doesNotMatch(viewport, pattern, `Hardware viewport must remain read-only: ${pattern}`);
});

console.log("ServoForge 3D hardware-reference regression passed.");
