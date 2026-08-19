(function installServoForge3DBottleHandlingDeadZoneAnchors(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.snapshot || !base?.pointAtPitch || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-dead-zone-anchors.v1";
  const REFERENCE_SOURCE = "user-machine-map-entry-exit-dead-zone-boundaries-2026-08-18";
  const ENTRY_TRANSFER_ANGLE_DEGREES = 30;
  const DISCHARGE_TRANSFER_ANGLE_DEGREES = 330;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function fraction(value) {
    const numeric = number(value, 0);
    return numeric - Math.floor(numeric);
  }

  function subtract(a, b) {
    return { x: number(a?.x) - number(b?.x), z: number(a?.z) - number(b?.z) };
  }

  function polarAngle(vector) {
    return Math.atan2(number(vector?.z), number(vector?.x));
  }

  function machineOrbit(angleDegrees, layout) {
    return sceneAdapter.machineOrbit(angleDegrees, {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
  }

  function forceTransferOptions(options = {}) {
    return {
      ...options,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES
    };
  }

  function contactPhase(machineTransferAngleDegrees, headPitchDegrees) {
    return fraction(number(machineTransferAngleDegrees) / Math.max(0.000001, number(headPitchDegrees, 1)));
  }

  function pocketReferenceForContact(wheel, contactPoint, transferPhasePitch) {
    const contactPolar = polarAngle(subtract(contactPoint, wheel.center));
    const directionSign = number(wheel.routeDirectionSign, 1) >= 0 ? 1 : -1;
    const pocketPitchRadians = Math.max(0.000001, Math.abs(number(wheel.pocketPitchRadians, Math.PI * 2 / Math.max(3, number(wheel.pocketCount, 8)))));

    // Viewport wheel rotation is:
    //   worldPocketAngle = reference + routeDirectionSign * feedPhase * pocketPitch
    // Therefore choose the phase-zero reference so a pocket center is exactly on
    // the fixed machine transfer contact when a carousel table center reaches it.
    return contactPolar - directionSign * transferPhasePitch * pocketPitchRadians;
  }

  function enhanceLayout(layout) {
    const entryContact = machineOrbit(ENTRY_TRANSFER_ANGLE_DEGREES, layout);
    const dischargeContact = machineOrbit(DISCHARGE_TRANSFER_ANGLE_DEGREES, layout);
    const entryPhasePitch = contactPhase(ENTRY_TRANSFER_ANGLE_DEGREES, layout.headPitchDegrees);
    const dischargePhasePitch = contactPhase(DISCHARGE_TRANSFER_ANGLE_DEGREES, layout.headPitchDegrees);

    const intermediate = layout.wheels?.intermediate;
    const discharge = layout.wheels?.discharge;
    const infeed = layout.wheels?.infeed;
    const infeedSegment = layout.segments?.find((segment) => segment.owner === "infeed-star");
    const intermediateSegment = layout.segments?.find((segment) => segment.owner === "intermediate-star");

    const intermediateReference = intermediate
      ? pocketReferenceForContact(intermediate, entryContact, entryPhasePitch)
      : 0;
    const dischargeReference = discharge
      ? pocketReferenceForContact(discharge, dischargeContact, dischargePhasePitch)
      : 0;

    // Keep the infeed star synchronized to its handoff with the intermediate star.
    // This remains provisional because the actual pocket count/diameter set has not
    // been measured. The carousel-facing 30° and 330° anchors are the hard targets.
    const infeedIntermediateContact = infeedSegment && intermediateSegment
      ? {
          x: number(infeedSegment.center?.x) + Math.cos(number(infeedSegment.startRadians) + number(infeedSegment.deltaRadians)) * number(infeedSegment.radius),
          z: number(infeedSegment.center?.z) + Math.sin(number(infeedSegment.startRadians) + number(infeedSegment.deltaRadians)) * number(infeedSegment.radius)
        }
      : null;
    const infeedReference = infeed && infeedIntermediateContact
      ? pocketReferenceForContact(infeed, infeedIntermediateContact, entryPhasePitch)
      : number(infeed?.referencePocketAngleRadians, 0);

    const wheels = freeze({
      ...layout.wheels,
      ...(infeed ? {
        infeed: {
          ...infeed,
          referencePocketAngleRadians: infeedReference,
          pocketPhaseAuthority: "provisional-synchronized-to-intermediate-handoff",
          transferPhasePitch: entryPhasePitch
        }
      } : {}),
      ...(intermediate ? {
        intermediate: {
          ...intermediate,
          referencePocketAngleRadians: intermediateReference,
          carouselTransferAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
          carouselTransferContact: { x: entryContact.x, z: entryContact.z },
          transferPhasePitch: entryPhasePitch,
          pocketPhaseAuthority: "machine-map-30-degree-carousel-handoff"
        }
      } : {}),
      ...(discharge ? {
        discharge: {
          ...discharge,
          referencePocketAngleRadians: dischargeReference,
          carouselTransferAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
          carouselTransferContact: { x: dischargeContact.x, z: dischargeContact.z },
          transferPhasePitch: dischargePhasePitch,
          pocketPhaseAuthority: "machine-map-330-degree-carousel-handoff"
        }
      } : {})
    });

    return freeze({
      ...layout,
      schemaVersion: "servoforge.3d-bottle-handling.v4-dead-zone-anchors",
      patchVersion: PATCH_VERSION,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
      transferGapDegrees: 60,
      wheels,
      deadZoneTransferAnchors: {
        source: REFERENCE_SOURCE,
        zeroAngleDegrees: 0,
        entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        dischargeAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
        entrySignedOffsetFromZero: 30,
        dischargeSignedOffsetFromZero: -30,
        exactMachineMapBoundaryAuthority: true,
        pocketCentersPhaseLocked: true
      },
      authority: {
        ...(layout.authority || {}),
        transferAngles: "user-machine-map-dead-zone-boundaries-30deg-330deg",
        pocketPhase: "phase-locked-to-carousel-table-arrival-at-transfer-boundaries",
        dimensionalAuthority: false
      }
    });
  }

  function buildLayout(geometry, options = {}) {
    return enhanceLayout(base.buildLayout(geometry, forceTransferOptions(options)));
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const raw = base.snapshot(machineAngleDegrees, geometry, forceTransferOptions(options));
    const layout = enhanceLayout(raw.layout);
    const wheels = Object.fromEntries(Object.entries(layout.wheels || {}).map(([key, wheel]) => [key, freeze({
      ...(raw.wheels?.[key] || wheel),
      ...wheel
    })]));

    return freeze({
      ...raw,
      schemaVersion: layout.schemaVersion,
      layout,
      wheels,
      deadZoneTransferAnchors: layout.deadZoneTransferAnchors,
      exactDeadZoneTransferAnchors: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    REFERENCE_SOURCE,
    ENTRY_TRANSFER_ANGLE_DEGREES,
    DISCHARGE_TRANSFER_ANGLE_DEGREES,
    exactDeadZoneTransferAnchors: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
