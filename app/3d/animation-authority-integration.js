(function installServoForge3DAnimationAuthority(global) {
  "use strict";

  const VERSION = "servoforge.3d-animation-authority.v2";
  const RETRY_MS = 50;
  const MAX_ATTEMPTS = 240;

  let installed = false;
  let syncFrame = null;
  let viewportControls = null;

  function sourceControls() {
    return {
      playPause: document.querySelector("#playPause"),
      angle: document.querySelector("#previewAngle"),
      speed: document.querySelector("#animationSpeed"),
      speedReadout: document.querySelector("#animationStepReadout")
    };
  }

  function dispatchInput(input, value) {
    if (!input) return false;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function cleanupDuplicateViewportDom() {
    const backdrops = [...document.querySelectorAll("#servoforge3dBackdrop")];
    if (backdrops.length <= 1) return backdrops[0] || null;
    const canonical = backdrops[backdrops.length - 1];
    backdrops.slice(0, -1).forEach((backdrop) => backdrop.remove());
    return canonical;
  }

  function removeLegacyMechanicalMapLauncher() {
    document.querySelectorAll("#servoforge3dOpen").forEach((button) => button.remove());
  }

  function syncControlValues() {
    if (!viewportControls) return;
    const source = sourceControls();
    if (source.angle && document.activeElement !== viewportControls.angle) {
      viewportControls.angle.value = source.angle.value;
      viewportControls.angleReadout.textContent = `${Number(source.angle.value || 0).toFixed(1)}°`;
    }
    if (source.speed && document.activeElement !== viewportControls.speed) {
      viewportControls.speed.value = source.speed.value;
      viewportControls.speedReadout.textContent = source.speedReadout?.textContent || `${Number(source.speed.value || 0).toFixed(1)} deg / sec`;
    }
    if (source.playPause) {
      viewportControls.playPause.textContent = source.playPause.textContent;
      viewportControls.playPause.setAttribute("aria-pressed", String(/pause/i.test(source.playPause.textContent || "")));
    }
    syncFrame = global.requestAnimationFrame(syncControlValues);
  }

  function installViewportControls() {
    cleanupDuplicateViewportDom();
    if (viewportControls?.root?.isConnected) return viewportControls;
    viewportControls = null;
    const header = document.querySelector("#servoforge3dBackdrop .servoforge-3d-head");
    const existingControls = header?.querySelector(".servoforge-3d-controls");
    if (!header || !existingControls) return null;

    const title = header.querySelector("#servoforge3dTitle");
    if (title) title.textContent = "ServoForge 3D Animation";
    const subtitle = header.querySelector(".servoforge-3d-title small");
    if (subtitle) subtitle.textContent = "Live servo-program animation using the current staging 3D hardware render";

    let controls = header.querySelector(".servoforge-3d-animation-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "servoforge-3d-animation-controls";
      controls.innerHTML = `
        <button type="button" data-3d-animation-play>Pause</button>
        <label>Table angle <input data-3d-animation-angle type="range" min="0" max="360" step="0.5"><output data-3d-animation-angle-readout>0.0°</output></label>
        <label>Speed <input data-3d-animation-speed type="range" min="1" max="50" step="0.5"><output data-3d-animation-speed-readout>10 deg / sec</output></label>`;
      header.insertBefore(controls, existingControls);
    }

    if (!document.querySelector("#servoforge3dAnimationAuthorityStyles")) {
      const style = document.createElement("style");
      style.id = "servoforge3dAnimationAuthorityStyles";
      style.textContent = `
        .servoforge-3d-head{grid-template-columns:minmax(0,1fr) auto auto}
        .servoforge-3d-animation-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
        .servoforge-3d-animation-controls button{border:1px solid rgba(150,183,197,.28);background:#122833;color:#eef7fa;border-radius:8px;padding:7px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
        .servoforge-3d-animation-controls label{display:grid;grid-template-columns:auto minmax(88px,130px) auto;align-items:center;gap:6px;color:#9db2bb;font-size:10px;white-space:nowrap}
        .servoforge-3d-animation-controls input[type=range]{width:100%;min-width:88px}
        .servoforge-3d-animation-controls output{min-width:46px;color:#eef7fa;font-variant-numeric:tabular-nums}
        @media(max-width:1050px){.servoforge-3d-animation-controls{width:100%;justify-content:flex-start}.servoforge-3d-animation-controls label{flex:1 1 220px}}
      `;
      document.head.appendChild(style);
    }

    viewportControls = {
      root: controls,
      playPause: controls.querySelector("[data-3d-animation-play]"),
      angle: controls.querySelector("[data-3d-animation-angle]"),
      angleReadout: controls.querySelector("[data-3d-animation-angle-readout]"),
      speed: controls.querySelector("[data-3d-animation-speed]"),
      speedReadout: controls.querySelector("[data-3d-animation-speed-readout]")
    };

    if (!controls.dataset.servoforgeAnimationBindingsV2) {
      controls.dataset.servoforgeAnimationBindingsV2 = "true";
      viewportControls.playPause.addEventListener("click", () => sourceControls().playPause?.click());
      viewportControls.angle.addEventListener("input", () => dispatchInput(sourceControls().angle, viewportControls.angle.value));
      viewportControls.speed.addEventListener("input", () => dispatchInput(sourceControls().speed, viewportControls.speed.value));
    }

    if (syncFrame !== null) global.cancelAnimationFrame(syncFrame);
    syncControlValues();
    return viewportControls;
  }

  function installLauncher() {
    removeLegacyMechanicalMapLauncher();
    cleanupDuplicateViewportDom();

    const source = sourceControls();
    const panel = source.playPause?.closest(".preview-panel") || document.querySelector(".preview-panel");
    if (panel) {
      const heading = panel.querySelector("h2");
      if (heading) heading.textContent = "3D Preview & Animation";
      const help = panel.querySelector(".panel-help");
      if (help) help.textContent = "This is the single ServoForge 3D animation entry point and uses the generated servo program.";
      const row = panel.querySelector(".anim-controls");
      if (row && !row.querySelector("#servoforge3dAnimationOpen")) {
        const button = document.createElement("button");
        button.id = "servoforge3dAnimationOpen";
        button.type = "button";
        button.className = "secondary-button";
        button.textContent = "Open 3D Animation";
        button.addEventListener("click", async () => {
          cleanupDuplicateViewportDom();
          await global.Labeler3DViewport?.open?.();
          cleanupDuplicateViewportDom();
          installViewportControls();
        });
        row.insertBefore(button, row.firstChild);
      }
    }
  }

  function installWhenReady(attempt = 0) {
    installLauncher();
    const viewport = global.Labeler3DViewport;
    if (!viewport?.open) {
      if (attempt < MAX_ATTEMPTS) global.setTimeout(() => installWhenReady(attempt + 1), RETRY_MS);
      return false;
    }

    if (!viewport.__animationAuthorityWrappedV2) {
      const nativeOpen = viewport.open.bind(viewport);
      const wrapped = Object.freeze({
        ...viewport,
        open: async (...args) => {
          cleanupDuplicateViewportDom();
          const result = await nativeOpen(...args);
          cleanupDuplicateViewportDom();
          installViewportControls();
          installLauncher();
          return result;
        },
        __animationAuthorityWrapped: true,
        __animationAuthorityWrappedV2: true
      });
      global.Labeler3DViewport = wrapped;
    }

    installLauncher();
    installed = true;
    return true;
  }

  global.Labeler3DAnimationAuthority = Object.freeze({
    VERSION,
    install: installWhenReady,
    cleanupDuplicateViewportDom,
    status() {
      return Object.freeze({
        version: VERSION,
        installed,
        viewportReady: Boolean(global.Labeler3DViewport?.open),
        controlsInstalled: Boolean(viewportControls?.root?.isConnected),
        mechanicalMapLauncherRemoved: !document.querySelector("#servoforge3dOpen"),
        viewportDomCount: document.querySelectorAll("#servoforge3dBackdrop").length,
        visualAuthority: "current-servoforge-3d-hardware-render",
        motionAuthority: "existing-preview-animation-clock-and-servo-program",
        launcherAuthority: "3d-preview-animation-panel-only"
      });
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installWhenReady(), { once: true });
  } else {
    installWhenReady();
  }
})(window);
