"use strict";

(function installBottleOrientationPanelRecovery(global) {
  if (global.ServoForgeBottleOrientationPanelRecovery?.installed) return;

  const VERSION = 4;
  const sources = ["program", "simulation"];
  const observers = new Map();
  const TOP_CORRECTION_ATTR = "data-machine-direction-bottle-datum-v79";
  // The v78 top-view polar basis used 0 degrees at 6 o'clock. The shared
  // Mechanical Map bottle datum is 0 degrees at 3 o'clock (+X). Reflecting the
  // angular graphics across y=x about the bottle center converts that old basis
  // to the same +X datum without changing any generated servo/HMI angle.
  const BOTTLE_CENTER_Y = 4;
  const DATUM_TRANSFORM = `matrix(0 1 1 0 ${-BOTTLE_CENTER_Y} ${BOTTLE_CENTER_Y})`;
  let recoveryQueued = false;
  let documentObserver = null;

  function api() { return global.LabelerBottleOrientationPanel || null; }

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Fall through to the Window property when the lexical binding is absent.
    }
    return global.state || null;
  }

  function machineDirection() {
    const current = String(runtimeState()?.direction || "").toLowerCase();
    if (current === "cw" || current === "ccw") return current;
    try {
      const mapped = String(global.activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
      if (mapped === "cw" || mapped === "ccw") return mapped;
    } catch {
      // Use the established clockwise fallback below.
    }
    return "cw";
  }

  function visualAngle(angleDeg, direction = machineDirection()) {
    const angle = Number(angleDeg);
    const resolved = Number.isFinite(angle) ? angle : 0;
    // Servo bottle rotation is opposite carousel travel. SVG positive rotation
    // is clockwise, so a clockwise carousel uses a negative local bottle angle.
    return String(direction).toLowerCase() === "cw" ? -resolved : resolved;
  }

  function markerPoint(angleDeg, radius, cx = 0, cy = BOTTLE_CENTER_Y, direction = machineDirection()) {
    const radians = visualAngle(angleDeg, direction) * Math.PI / 180;
    return {
      x: cx + Math.cos(radians) * radius,
      y: cy + Math.sin(radians) * radius
    };
  }

  function sourcePanel(source) {
    const host = typeof document !== "undefined" ? document.getElementById(source) : null;
    return host?.querySelector?.(`[data-bottle-orientation-panel="${source}"]`) || null;
  }

  function correctTopView(source) {
    const panel = sourcePanel(source);
    const top = panel?.querySelector?.("[data-orientation-top]");
    const svg = top?.querySelector?.(".bottle-orientation-svg");
    if (!svg) return false;

    // v79 renders the correct +X/right-front bottle datum natively. Keep the
    // reflection logic below only as a compatibility fallback for an older v78
    // panel that may still be present during a rolling staging update.
    if (api()?.rightFrontZeroDatumV79) {
      svg.setAttribute(TOP_CORRECTION_ATTR, machineDirection());
      svg.setAttribute("data-bottle-zero-datum", "right-front-reference");
      svg.setAttribute("data-bottle-spin-relative-to-carousel", "opposite");
      return true;
    }

    const direction = machineDirection();
    if (svg.getAttribute(TOP_CORRECTION_ATTR) === direction) return true;

    // Convert all circumferential paths from the legacy 6-o'clock basis to the
    // shared bottle +X datum. Bottle body circles are rotationally symmetric and
    // the fixed wipe hardware remains physically fixed at the right-hand side.
    svg.querySelectorAll("path").forEach((path) => {
      path.setAttribute("transform", DATUM_TRANSFORM);
    });

    const orientationLine = svg.querySelector('line[stroke="#ff4d3a"][stroke-dasharray="5 4"]');
    if (orientationLine) orientationLine.setAttribute("transform", DATUM_TRANSFORM);

    ["2.8", "3.2"].forEach((radius) => {
      svg.querySelectorAll(`circle[r="${radius}"]`).forEach((circle) => {
        circle.setAttribute("transform", DATUM_TRANSFORM);
      });
    });

    // Degree marker lines can use the same geometric basis conversion, while
    // marker text is positioned numerically so the glyphs are never mirrored.
    svg.querySelectorAll("text.degree-label").forEach((text) => {
      const degree = Number.parseFloat(String(text.textContent || "").replace("°", ""));
      if (!Number.isFinite(degree)) return;
      const markerLine = text.previousElementSibling;
      if (markerLine?.tagName?.toLowerCase?.() === "line") {
        markerLine.setAttribute("transform", DATUM_TRANSFORM);
      }
      const point = markerPoint(degree, 108, 0, BOTTLE_CENTER_Y, direction);
      text.setAttribute("x", String(point.x));
      text.setAttribute("y", String(point.y + 4));
    });

    svg.setAttribute(TOP_CORRECTION_ATTR, direction);
    svg.setAttribute("data-bottle-zero-datum", "right-front-reference");
    svg.setAttribute("data-bottle-spin-relative-to-carousel", "opposite");
    return true;
  }

  function recoverSource(source) {
    const visual = api();
    const host = typeof document !== "undefined" ? document.getElementById(source) : null;
    if (!visual?.renderSource || !host) return false;
    if (!host.querySelector(`[data-bottle-orientation-panel="${source}"]`)) {
      visual.renderSource(source);
    }
    const present = Boolean(host.querySelector(`[data-bottle-orientation-panel="${source}"]`));
    if (present) correctTopView(source);
    return present;
  }

  function recoverAll() {
    recoveryQueued = false;
    // Reacquire the workspace hosts every recovery pass. The Servo Program
    // workspace can be rebuilt after this integration first loads, so a one-time
    // observer install is not sufficient to keep the live Top View mounted.
    sources.forEach((source) => {
      observeHost(source);
      recoverSource(source);
    });
  }

  function queueRecovery() {
    if (recoveryQueued) return;
    recoveryQueued = true;
    global.requestAnimationFrame ? global.requestAnimationFrame(recoverAll) : global.setTimeout(recoverAll, 0);
  }

  function observeHost(source) {
    const host = typeof document !== "undefined" ? document.getElementById(source) : null;
    const existing = observers.get(source);
    if (existing?.host === host && host?.isConnected) return true;
    if (existing?.observer) {
      try { existing.observer.disconnect(); } catch { /* ignore stale observer */ }
      observers.delete(source);
    }
    if (!host || typeof MutationObserver !== "function") return false;
    // The orientation renderer replaces the SVG contents as the program player
    // advances. Child-list observation reapplies the datum correction to each new
    // SVG. Attribute-only corrections below do not retrigger this observer.
    const observer = new MutationObserver(() => queueRecovery());
    observer.observe(host, { childList: true, subtree: true });
    observers.set(source, { host, observer });
    return true;
  }

  function observeDocument() {
    if (documentObserver || typeof document === "undefined" || typeof MutationObserver !== "function" || !document.body) return false;
    documentObserver = new MutationObserver(() => queueRecovery());
    documentObserver.observe(document.body, { childList: true, subtree: true });
    return true;
  }

  function install() {
    observeDocument();
    sources.forEach(observeHost);
    recoverAll();
    global.setTimeout(recoverAll, 150);
    global.setTimeout(recoverAll, 750);
    global.setTimeout(recoverAll, 1800);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
    global.addEventListener?.("load", recoverAll, { once: true });
  }

  global.ServoForgeBottleOrientationPanelRecovery = Object.freeze({
    installed: true,
    version: VERSION,
    machineDirection,
    visualAngle,
    markerPoint,
    datumTransform: DATUM_TRANSFORM,
    correctTopView,
    recoverSource,
    recoverAll,
    observeHost,
    observeDocument,
    servoProgramPanelGuaranteedV75: true,
    persistentTopViewMountV85: true,
    workspaceHostReacquireV85: true,
    machineBottleDatumAlignedV79: true,
    oppositeCarouselBottleSpinV79: true,
    rightFrontZeroDatumV79: true,
    nativeBottleDatumCompatibilityV79: true
  });
})(typeof window !== "undefined" ? window : globalThis);
