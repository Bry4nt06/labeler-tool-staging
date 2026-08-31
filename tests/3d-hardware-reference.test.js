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
assert.ok(catalogIndex >= 0);
assert.ok(factoryIndex > catalogIndex);
assert.ok(equipmentIndex > factoryIndex);
assert.ok(runtimeIndex > equipmentIndex);

const sandbox = { window: {}, console, Object, Array, Number, String, Boolean, Math };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
assert.doesNotThrow(() => vm.runInContext(catalogSource, sandbox, { filename: "hardware-reference-catalog.js" }));
assert.doesNotThrow(() => vm.runInContext(factorySource, sandbox, { filename: "hardware-mesh-factory.js" }));

const catalog = sandbox.Labeler3DHardwareReferenceCatalog;
assert.ok(catalog);
assert.strictEqual(catalog.CATALOG_VERSION, "servoforge.3d-hardware-reference.v2");
assert.strictEqual(catalog.profileIdForKind("pad"), "wipe-pad");
assert.strictEqual(catalog.profileIdForKind("roller"), "wipe-roller");
assert.strictEqual(catalog.profileIdForKind("coding"), "laser-coder");
assert.strictEqual(catalog.profileIdForKind("sensor"), "label-sensor");
assert.strictEqual(catalog.resolve({ aggregate: 1 }).id, "application-spender");
assert.strictEqual(catalog.profile("wipe-pad").dimensionalAuthority, true);
assert.strictEqual(catalog.profile("wipe-roller").dimensionalAuthority, false);
assert.strictEqual(catalog.profile("laser-coder").dimensionalAuthority, false);
assert.strictEqual(catalog.profile("label-sensor").dimensionalAuthority, false);

assert.match(factorySource, /createSpenderPlateAssembly/);
assert.match(factorySource, /createRollerAssembly/);
assert.match(factorySource, /createCoderAssembly/);
assert.match(factorySource, /createSensorAssembly/);
assert.match(factorySource, /sensorFieldOfViewDegrees/);
assert.match(factorySource, /fovAuthority:\s*"servoforge-runtime-data"/);

assert.match(runtime, /servoforge\.3d-runtime\.v3/);
assert.match(runtime, /three-scene-renderer-v08\.js/);
assert.match(runtime, /sensorsRenderedIn3D:\s*true/);
assert.match(runtime, /coderRenderedIn3D:\s*true/);
assert.match(runtime, /rollersRenderedIn3D:\s*true/);
assert.match(runtime, /sensorRuntimeDataPreserved:\s*true/);
assert.match(runtime, /coderTimingLogicUntouched:\s*true/);
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/);
assert.match(runtime, /sceneAuthority: "starwheel-bottle-handling-only"/);

assert.match(viewport, /servoforge\.3d-viewport\.v0\.10/);
assert.match(viewport, /ServoForgeCanonicalBottleHandlingScene/);
assert.match(viewport, /factory\?\.createEquipmentAssembly/);
assert.match(viewport, /Sensors/);
assert.match(viewport, /Coders/);
assert.match(viewport, /sensorsRendered:\s*true/);
assert.match(viewport, /coderRendered:\s*true/);
assert.match(viewport, /sensorLogicUntouched:\s*true/);
assert.match(viewport, /coderLogicUntouched:\s*true/);
assert.match(viewport, /legacyCarouselEnvironment: false/);

[/saveCurrentSettings\s*\(/, /setServoAngleOverride\s*\(/, /state\.program\s*=/, /simulation\.lines\s*=/]
  .forEach((pattern) => {
    assert.doesNotMatch(factorySource, pattern);
    assert.doesNotMatch(viewport, pattern);
  });

console.log("ServoForge v303 3D hardware-reference regression passed.");
