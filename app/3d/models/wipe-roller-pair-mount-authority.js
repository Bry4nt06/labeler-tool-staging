(function installServoForge3DRollerPairMountAuthority(global) {
  "use strict";

  const baseModel = global.Labeler3DWipeRollerModel;
  if (!baseModel?.create) {
    throw new Error("ServoForge roller clamp-side authority requires the wipe roller model.");
  }

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller-clamp-side.v3-geometry-derived";
  const EPSILON = 0.0005;

  const CLAMP_SIDE_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19-clamp-side-geometry",
    railGeometryRendered: false,
    pairRailRendered: false,
    extensionArmsRendered: false,
    risersRendered: false,
    immediateClampOwnedByCanonicalRollerModel: true,
    rollerIsBottleFacingTerminal: true,
    mountingHardwareExtendsAwayFromBottle: true,
    hardwareNeverBetweenBottleAndRoller: true,
    sideLabelDoesNotControlClampDirection: true,
    clampDirectionDerivedFromActualRollerRadius: true,
    bottlePathAuthority: "physical-bottle-table-pitch-radius",
    insideRollerRule: "roller-radius-less-than-bottle-path-radius-means-clamp-points-inward",
    outsideRollerRule: "roller-radius-greater-than-bottle-path-radius-means-clamp-points-outward",
    immediateHardwareRadialToCarouselCenter: true
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function rollerRadiusFromCenter(item = {}) {
    return Math.hypot(number(item?.position?.x), number(item?.position?.z));
  }

  function bottlePathRadiusWorld(geometry = {}, item = {}) {
    const candidates = [
      geometry?.machine?.physicalPitchRadiusWorld,
      geometry?.machine?.pitchRadiusWorld,
      geometry?.physicalPitchRadiusWorld,
      geometry?.pitchRadiusWorld
    ]
      .map((value) => number(value, NaN))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (candidates.length) return candidates[0];

    // Last-resort compatibility fallback. This branch is not the preferred
    // authority; current ServoForge physical geometry supplies the pitch radius.
    const rollerRadius = rollerRadiusFromCenter(item);
    const side = String(item?.side || "").toLowerCase();
    const bottleRadius = Math.max(0.001, number(geometry?.bottle?.radiusWorld, number(geometry?.bottle?.diameterWorld, 0.27) / 2));
    return side === "inner" ? rollerRadius + bottleRadius : Math.max(0.001, rollerRadius - bottleRadius);
  }

  function clampDirectionSign(item = {}, geometry = {}) {
    const rollerRadius = rollerRadiusFromCenter(item);
    const bottlePathRadius = bottlePathRadiusWorld(geometry, item);
    const delta = rollerRadius - bottlePathRadius;

    // The sign is based on actual geometry, never the map's side label:
    // roller inside bottle path -> hardware continues inward (-radial)
    // roller outside bottle path -> hardware continues outward (+radial)
    if (delta < -EPSILON) return -1;
    if (delta > EPSILON) return 1;

    // If a future machine places the roller center almost exactly on the bottle
    // pitch radius, keep a deterministic fallback without moving the roller.
    return String(item?.side || "").toLowerCase() === "inner" ? -1 : 1;
  }

  function correctedHardwareQuaternion(THREE, item, geometry) {
    const x = number(item?.position?.x);
    const z = number(item?.position?.z);
    const magnitude = Math.hypot(x, z) || 1;
    const sign = clampDirectionSign(item, geometry);
    const xAxis = new THREE.Vector3((x / magnitude) * sign, 0, (z / magnitude) * sign).normalize();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
  }

  function create(THREE, item, geometry, context = {}) {
    const group = baseModel.create(THREE, item, geometry, context);
    if (!group) return group;

    const hardwareRoot = group.getObjectByName?.("ServoForgeWipeRollerHardwareRadialRoot");
    if (hardwareRoot) {
      const rollerRadius = rollerRadiusFromCenter(item);
      const bottlePathRadius = bottlePathRadiusWorld(geometry, item);
      const sign = clampDirectionSign(item, geometry);
      hardwareRoot.quaternion.copy(correctedHardwareQuaternion(THREE, item, geometry));
      hardwareRoot.userData.hardwareDirection = "away-from-bottle";
      hardwareRoot.userData.hardwareDirectionAuthority = "actual-roller-radius-vs-bottle-pitch-radius";
      hardwareRoot.userData.rollerRadiusFromCarouselCenter = rollerRadius;
      hardwareRoot.userData.bottlePathRadiusFromCarouselCenter = bottlePathRadius;
      hardwareRoot.userData.clampDirectionSign = sign;
      hardwareRoot.userData.clampSide = sign < 0 ? "radially-inward" : "radially-outward";
      hardwareRoot.userData.hardwareNeverBetweenBottleAndRoller = true;
    }

    group.userData.clampSideAuthority = Object.freeze({
      modelVersion: MODEL_VERSION,
      sideLabelIgnoredForPrimaryDecision: true,
      bottlePathAuthority: CLAMP_SIDE_RULES.bottlePathAuthority,
      hardwareNeverBetweenBottleAndRoller: true,
      rollerRadiusFromCarouselCenter: rollerRadiusFromCenter(item),
      bottlePathRadiusFromCarouselCenter: bottlePathRadiusWorld(geometry, item),
      clampDirectionSign: clampDirectionSign(item, geometry)
    });
    return group;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    ...baseModel,
    MODEL_VERSION,
    create,
    standingRules: Object.freeze({
      ...(baseModel.standingRules || {}),
      ...CLAMP_SIDE_RULES
    }),
    authority: Object.freeze({
      ...(baseModel.authority || {}),
      clampSideAuthority: "actual-roller-radius-vs-physical-bottle-table-pitch-radius",
      sideLabelDoesNotControlClampDirection: true,
      hardwareNeverBetweenBottleAndRoller: true
    })
  });

  global.Labeler3DRollerPairMountAuthority = Object.freeze({
    MODEL_VERSION,
    rules: CLAMP_SIDE_RULES,
    clampDirectionSign,
    bottlePathRadiusWorld,
    status() {
      return Object.freeze({
        modelVersion: MODEL_VERSION,
        railGeometryRendered: false,
        extensionArmsRendered: false,
        risersRendered: false,
        immediateClampOwnedByCanonicalRollerModel: true,
        sideLabelDoesNotControlClampDirection: true,
        clampDirectionDerivedFromActualRollerRadius: true,
        readOnly: true
      });
    }
  });
})(window);