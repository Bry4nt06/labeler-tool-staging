"use strict";

(function installCommunityAdminDeleteV126(global) {
  const BUILD_ID = "community-admin-delete-v126-20260816-0920";
  const ADMIN_SESSION_KEY = "servoforge-feedback-admin-session-v1";
  if (global.ServoForgeCommunityAdminDeleteV126?.buildId === BUILD_ID) return;

  function communityApi() {
    return global.LabelerCommunityLibrary?.api;
  }

  function adminKey() {
    try { return String(global.sessionStorage?.getItem(ADMIN_SESSION_KEY) || ""); }
    catch { return ""; }
  }

  function adminRowTitle(row) {
    const card = row?.previousElementSibling;
    const heading = String(card?.querySelector?.("h3")?.textContent || "").replace(/\s+/g, " ").trim();
    return heading || "this Community package";
  }

  function ensureDeleteButtons(root = global.document) {
    if (!root?.querySelectorAll) return 0;
    let added = 0;
    root.querySelectorAll(".sf-community-admin-actions[data-community-admin-id]").forEach((row) => {
      if (row.querySelector(".sf-community-admin-delete")) return;
      const button = global.document.createElement("button");
      button.type = "button";
      button.className = "sf-community-admin-delete danger";
      button.textContent = "Delete";
      button.setAttribute("aria-label", `Delete ${adminRowTitle(row)}`);
      row.appendChild(button);
      added += 1;
    });
    return added;
  }

  async function deleteAdminPackage(row) {
    const api = communityApi();
    const key = adminKey();
    const packageId = String(row?.dataset?.communityAdminId || "");
    if (typeof api !== "function") throw new Error("Community Admin service is unavailable.");
    if (!key) throw new Error("Community Admin access has expired. Unlock Community Admin again.");
    if (!packageId) throw new Error("Community package identifier is unavailable.");

    const title = adminRowTitle(row);
    const confirmed = global.confirm?.(`Permanently delete ${title}?\n\nThis removes the Community package and its ratings and cannot be undone.`);
    if (!confirmed) return false;

    const button = row.querySelector(".sf-community-admin-delete");
    if (button) {
      button.disabled = true;
      button.textContent = "Deleting…";
    }

    try {
      await api("adminDelete", { adminKey: key, packageId });
      const card = row.previousElementSibling;
      card?.remove?.();
      row.remove?.();
      global.document?.getElementById?.("communityAdminRefresh")?.click?.();
      return true;
    } catch (error) {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = "Delete";
      }
      throw error;
    }
  }

  function bind() {
    const dialog = global.document?.getElementById?.("servoforgeCommunityDialog");
    if (!dialog) return false;
    if (dialog.dataset.communityAdminDeleteV126 === "true") {
      ensureDeleteButtons(dialog);
      return true;
    }
    dialog.dataset.communityAdminDeleteV126 = "true";
    ensureDeleteButtons(dialog);

    dialog.addEventListener("click", async (event) => {
      const button = event.target?.closest?.(".sf-community-admin-delete");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const row = button.closest(".sf-community-admin-actions[data-community-admin-id]");
      try {
        await deleteAdminPackage(row);
      } catch (error) {
        global.alert?.(String(error?.message || error || "Unable to delete Community package."));
      }
    });

    const observer = new MutationObserver(() => ensureDeleteButtons(dialog));
    observer.observe(dialog, { childList: true, subtree: true });
    global.__servoForgeCommunityAdminDeleteObserverV126 = observer;
    return true;
  }

  function start() {
    if (bind()) return;
    let attempts = 0;
    const timer = global.setInterval?.(() => {
      attempts += 1;
      if (bind() || attempts >= 40) global.clearInterval?.(timer);
    }, 250);
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  global.ServoForgeCommunityAdminDeleteV126 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    adminKey,
    adminRowTitle,
    ensureDeleteButtons,
    deleteAdminPackage,
    bind,
    adminDeleteAuthorizedServerSideV126: true,
    cascadeRatingsOnDeleteV126: true
  });
})(typeof window !== "undefined" ? window : globalThis);
