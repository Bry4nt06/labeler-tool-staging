"use strict";

(function installServoForgeCommunityRuntimeStability(global) {
  if (global.ServoForgeCommunityRuntimeStability?.installed) return;

  const BUILD = "community-runtime-stability-v131-20260819-1606";
  const BUTTON_ID = "communityLibraryButton";
  const DIALOG_ID = "servoforgeCommunityDialog";
  const BROWSE_HOST_ID = "communityBrowseList";
  const STABLE_BUTTON_FLAG = "communityRuntimeStableV131";
  const STABLE_HOST_FLAG = "communityRuntimeStableHostV131";

  let opening = false;
  let repairQueued = false;

  function safeShowDialog(dialog) {
    if (!dialog) return false;
    try {
      if (!dialog.open) dialog.showModal();
    } catch (error) {
      // A dialog can throw InvalidStateError if another integration temporarily
      // left it in non-modal open state. Keep Community usable instead of letting
      // that exception escape through the application click handler.
      try { dialog.setAttribute("open", ""); }
      catch { return false; }
    }
    return true;
  }

  function detachLegacyBrowseObserver() {
    const host = document.getElementById(BROWSE_HOST_ID);
    if (!host || host.dataset[STABLE_HOST_FLAG] === "true") return host;

    // V103 historically observed this node directly. Replacing only the browse
    // list preserves the dialog and delegated Community actions while detaching
    // any stale MutationObserver bound to the old node. The replacement remains
    // the same DOM contract for the base Community renderer.
    const replacement = host.cloneNode(true);
    replacement.dataset[STABLE_HOST_FLAG] = "true";
    host.replaceWith(replacement);
    return replacement;
  }

  function activateBrowse(dialog) {
    if (!dialog) return;
    const browseTab = dialog.querySelector('[data-community-tab="browse"]');
    if (browseTab) {
      // Use the existing dialog delegation so the base module remains the sole
      // owner of browse rendering/API behavior. This generates one browse load.
      browseTab.click();
      return;
    }

    dialog.querySelectorAll("[data-community-tab]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.communityTab === "browse");
    });
    dialog.querySelectorAll("[data-community-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.communityPane !== "browse";
    });
  }

  async function openCommunity() {
    if (opening) return true;
    opening = true;
    global.__SERVOFORGE_COMMUNITY_OPEN_STATE = "opening-stable-v131";

    try {
      let dialog = document.getElementById(DIALOG_ID);
      if (!dialog) {
        const recovery = global.ServoForgeCommunityLibraryV104?.openCommunity;
        if (typeof recovery === "function") {
          await recovery();
          dialog = document.getElementById(DIALOG_ID);
        }
      }
      if (!dialog) throw new Error("Community Library dialog is unavailable.");

      detachLegacyBrowseObserver();
      if (!safeShowDialog(dialog)) throw new Error("Community Library dialog could not be opened.");
      activateBrowse(dialog);
      global.__SERVOFORGE_COMMUNITY_OPEN_STATE = "open-stable-v131";
      return true;
    } catch (error) {
      global.__SERVOFORGE_COMMUNITY_OPEN_STATE = `error:${String(error?.message || error)}`;
      console.error("[ServoForge Community] stable launcher failed", error);
      return false;
    } finally {
      opening = false;
    }
  }

  function stabilizeButton() {
    const current = document.getElementById(BUTTON_ID);
    if (!current) return false;
    if (current.dataset[STABLE_BUTTON_FLAG] === "true") return true;

    // Clone the final rendered button to intentionally discard all previous
    // direct click listeners from the base/V104 recovery layers. Community gets
    // one authoritative launch path regardless of Railway or browser history.
    const button = current.cloneNode(true);
    button.id = BUTTON_ID;
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.dataset[STABLE_BUTTON_FLAG] = "true";
    current.replaceWith(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      void openCommunity();
    }, true);
    return true;
  }

  function repair() {
    repairQueued = false;
    stabilizeButton();
  }

  function queueRepair() {
    if (repairQueued) return;
    repairQueued = true;
    setTimeout(repair, 0);
  }

  function bind() {
    repair();

    // Top-action/header integrations can rebuild their action cluster. Reapply
    // the stable button only when the actual Community button is replaced.
    const observer = new MutationObserver((records) => {
      const needsRepair = records.some((record) => [...record.addedNodes].some((node) => {
        if (node?.nodeType !== 1) return false;
        return node.id === BUTTON_ID || Boolean(node.querySelector?.(`#${BUTTON_ID}`));
      }));
      if (needsRepair) queueRepair();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    global.__SERVOFORGE_COMMUNITY_RUNTIME_STABILITY_OBSERVER = observer;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCommunityRuntimeStability = Object.freeze({
    installed: true,
    build: BUILD,
    openCommunity,
    stabilizeButton,
    detachLegacyBrowseObserver,
    singleAuthoritativeButtonListener: true,
    safeDialogReentry: true,
    legacyBrowseObserverDetachedOnOpen: true
  });
})(typeof window !== "undefined" ? window : globalThis);
