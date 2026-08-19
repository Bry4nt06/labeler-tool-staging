(function installServoForge3DBottleHandlingDirectionAuthority(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  if (!base?.buildLayout || !base?.snapshot) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-direction-authority.v1";
  const AUTHORITY_SOURCE = "servoforge-authoritative-application-state-direction";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // Fall through to the window mirror when isolated from the application lexical state.
    }
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function normalizeDirection(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "cw" || normalized === "clockwise" ? "cw" : "ccw";
  }

  function authoritativeOptions(options = {}) {
    const current = appState();
    return {
      ...options,
      carouselDirection: normalizeDirection(current?.direction || options.carouselDirection || "ccw"),
      zeroAngleDegrees: number(current?.zeroAngle, number(options.zeroAngleDegrees, 0))
    };
  }

  function buildLayout(geometry, options = {}) {
    const resolved = authoritativeOptions(options);
    const layout = base.buildLayout(geometry, resolved);
    return freeze({
      ...layout,
      carouselDirection: resolved.carouselDirection,
      zeroAngleDegrees: resolved.zeroAngleDegrees,
      directionAuthority: {
        source: AUTHORITY_SOURCE,
        carouselDirection: resolved.carouselDirection,
        zeroAngleDegrees: resolved.zeroAngleDegrees,
        windowStateFallbackOnly: true
      }
    });
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const resolved = authoritativeOptions(options);
    const raw = base.snapshot(machineAngleDegrees, geometry, resolved);
    const layout = buildLayout(geometry, resolved);
    return freeze({
      ...raw,
      layout,
      carouselDirection: resolved.carouselDirection,
      zeroAngleDegrees: resolved.zeroAngleDegrees,
      directionAuthority: layout.directionAuthority,
      directionParityEnabled: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    AUTHORITY_SOURCE,
    directionAuthorityV1: true,
    normalizeDirection,
    authoritativeOptions,
    buildLayout,
    snapshot
  });
})(window);
