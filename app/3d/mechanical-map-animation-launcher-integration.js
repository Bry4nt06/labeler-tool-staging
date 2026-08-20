(function installServoForgeMechanicalMapAnimationLauncher(global) {
  "use strict";

  const VERSION = "servoforge.3d-mechanical-map-launcher.v1";
  const BUILD = "3d-map-launcher-v220-20260820-0942";
  const UPDATED_AT = "Aug 20, 2026 9:42 AM ET";
  let observer = null;

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  function removePreviewPanelLauncher() {
    document.querySelectorAll("#servoforge3dAnimationOpen").forEach((button) => button.remove());
  }

  function ensureMechanicalMapLauncher() {
    removePreviewPanelLauncher();
    const toolbar = document.querySelector(".map-toolbar");
    if (!toolbar) return false;

    let button = toolbar.querySelector("#servoforge3dMechanicalAnimationOpen");
    if (!button) {
      button = document.createElement("button");
      button.id = "servoforge3dMechanicalAnimationOpen";
      button.type = "button";
      button.className = "secondary-button compact-map-button";
      button.textContent = "3D Animation";
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", async () => {
        global.Labeler3DAnimationAuthority?.cleanupDuplicateViewportDom?.();
        await global.Labeler3DViewport?.open?.();
        global.Labeler3DAnimationAuthority?.cleanupDuplicateViewportDom?.();
        global.Labeler3DControlSurfaceRecovery?.ensure?.();
        global.Labeler3DAllBottleServoSynchronization?.synchronize?.();
      });
      toolbar.appendChild(button);
    }
    return true;
  }

  function installObserver() {
    if (observer || typeof MutationObserver !== "function" || !document.documentElement) return;
    observer = new MutationObserver(() => {
      removePreviewPanelLauncher();
      ensureMechanicalMapLauncher();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  publishBuild();
  ensureMechanicalMapLauncher();
  installObserver();

  global.Labeler3DMechanicalMapAnimationLauncher = Object.freeze({
    VERSION,
    BUILD,
    ensure: ensureMechanicalMapLauncher,
    status() {
      return Object.freeze({
        version: VERSION,
        mechanicalLauncherPresent: Boolean(document.querySelector("#servoforge3dMechanicalAnimationOpen")),
        previewPanelLauncherRemoved: !document.querySelector("#servoforge3dAnimationOpen"),
        viewportDomCount: document.querySelectorAll("#servoforge3dBackdrop").length
      });
    }
  });
})(window);
