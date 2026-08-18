(function installServoForge3DBottleHandlingPocketPhasePresentation(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-pocket-phase-presentation.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const MARKER_Y = 0.292;

  let THREE = null;
  let running = false;
  let handlingLayer = null;
  const wheelGroups = new Map();
  const transferMarkers = new Map();
  let appliedPhaseUpdates = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function wheelKeyForObject(object) {
    const name = String(object?.name || "");
    if (name === "ServoForgeInfeedStar") return "infeed";
    if (name === "ServoForgeIntermediateStar") return "intermediate";
    if (name === "ServoForgeDischargeStar") return "discharge";
    return null;
  }

  function ensureTransferMarker(key, contact, color) {
    if (!THREE || !handlingLayer || !contact) return;
    let marker = transferMarkers.get(key);
    if (!marker) {
      marker = new THREE.Group();
      marker.name = key === "entry" ? "ServoForgeEntryTransfer30DegreeMarker" : "ServoForgeDischargeTransfer330DegreeMarker";
      marker.userData.machineMapTransferBoundary = key === "entry" ? 30 : 330;
      marker.userData.readOnly = true;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.012, 8, 30),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
      );
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);

      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.12, 16),
        new THREE.MeshBasicMaterial({ color })
      );
      pin.position.y = 0.06;
      marker.add(pin);

      handlingLayer.add(marker);
      transferMarkers.set(key, marker);
    }
    marker.position.set(number(contact.x), MARKER_Y, number(contact.z));
  }

  function currentHandlingSnapshot() {
    const activeRuntime = runtime();
    const handlingAdapter = adapter();
    if (!activeRuntime?.snapshot || !handlingAdapter?.snapshot) return null;
    const sceneSnapshot = activeRuntime.snapshot({
      scene: {
        tableY: 0.20,
        bottleLift: 0.155,
        unitMode: "physical-mm-bottle-handling-pocket-phase"
      }
    });
    return handlingAdapter.snapshot(
      sceneSnapshot?.scene?.carousel?.machineAngleDegrees,
      sceneSnapshot.geometry,
      {
        carouselDirection: String(global.state?.direction || "ccw"),
        zeroAngleDegrees: number(global.state?.zeroAngle, 0)
      }
    );
  }

  function applyPhaseAnchors() {
    let handling;
    try {
      handling = currentHandlingSnapshot();
    } catch {
      return;
    }
    if (!handling?.layout?.wheels) return;

    wheelGroups.forEach((group, key) => {
      const wheel = handling.layout.wheels[key];
      if (!wheel || !Number.isFinite(Number(wheel.referencePocketAngleRadians))) return;
      const nextReference = Number(wheel.referencePocketAngleRadians);
      if (Math.abs(number(group.userData.referencePocketAngleRadians) - nextReference) > 1e-10) {
        group.userData.referencePocketAngleRadians = nextReference;
        group.userData.pocketPhaseAuthority = wheel.pocketPhaseAuthority || "dead-zone-transfer-anchor";
        group.userData.carouselTransferAngleDegrees = wheel.carouselTransferAngleDegrees ?? null;
        appliedPhaseUpdates += 1;
      }
    });

    const entry = handling.layout.wheels.intermediate?.carouselTransferContact;
    const discharge = handling.layout.wheels.discharge?.carouselTransferContact;
    ensureTransferMarker("entry", entry, 0x39ff73);
    ensureTransferMarker("discharge", discharge, 0xff3b30);
  }

  function loop() {
    if (!running) return;
    applyPhaseAnchors();
    global.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    global.requestAnimationFrame(loop);
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeBottlePocketPhasePresentationV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeBottlePocketPhaseAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (object?.name === "ServoForgeBottleHandlingSystem") {
          handlingLayer = object;
          startLoop();
        }
        const key = wheelKeyForObject(object);
        if (key) {
          wheelGroups.set(key, object);
          startLoop();
        }
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeBottlePocketPhasePresentationV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge bottle pocket phase presentation failed", error);
  });

  global.Labeler3DBottleHandlingPocketPhasePresentation = Object.freeze({
    PATCH_VERSION,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        wheelGroups: wheelGroups.size,
        transferMarkers: transferMarkers.size,
        appliedPhaseUpdates,
        entryTransferAngleDegrees: 30,
        dischargeTransferAngleDegrees: 330,
        readOnly: true
      });
    }
  });
})(window);
