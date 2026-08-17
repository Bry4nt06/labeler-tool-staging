"use strict";

(() => {
  const form = document.getElementById("authForm");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const displayField = document.getElementById("displayNameField");
  const displayName = document.getElementById("displayName");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const submit = document.getElementById("authSubmit");
  const message = document.getElementById("authMessage");
  const help = document.getElementById("authHelp");
  let setupMode = false;

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `auth-message visible ${type}`;
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "auth-message";
  }

  function configure(mode) {
    setupMode = mode === "setup";
    displayField.hidden = !setupMode;
    displayName.required = setupMode;
    password.autocomplete = setupMode ? "new-password" : "current-password";
    title.textContent = setupMode ? "Create owner account" : "Sign in";
    subtitle.textContent = setupMode
      ? "This one-time setup creates the local ServoForge owner account."
      : "Use the ServoForge account created for you.";
    submit.textContent = setupMode ? "Create owner & continue" : "Sign in";
    help.textContent = setupMode
      ? "The first account becomes Owner and can create, disable, and manage all other ServoForge accounts."
      : "Accounts are managed locally by the ServoForge administrator. There is no public account registration.";
  }

  async function clearLegacyOfflineAccess() {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("servoforge-labeler-")).map((key) => caches.delete(key)));
      }
    } catch {
      // Authentication remains server-enforced even if browser cache cleanup is unavailable.
    }
  }

  async function loadStatus() {
    await clearLegacyOfflineAccess();
    const response = await fetch("/api/auth/status", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Authentication service is unavailable.");
    const status = await response.json();
    if (status.authenticated) {
      location.replace("/");
      return;
    }
    configure(status.configured ? "login" : "setup");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    submit.disabled = true;
    submit.textContent = setupMode ? "Creating owner…" : "Signing in…";
    try {
      const endpoint = setupMode ? "/api/auth/setup" : "/api/auth/login";
      const payload = {
        username: username.value,
        password: password.value
      };
      if (setupMode) payload.displayName = displayName.value;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "SETUP_REQUIRED") {
          configure("setup");
          throw new Error("Create the owner account before signing in.");
        }
        throw new Error(result.error || "Unable to sign in.");
      }
      showMessage(setupMode ? "Owner account created." : "Signed in.", "success");
      location.replace("/");
    } catch (error) {
      showMessage(error.message || "Unable to sign in.");
    } finally {
      submit.disabled = false;
      submit.textContent = setupMode ? "Create owner & continue" : "Sign in";
    }
  });

  loadStatus().catch((error) => showMessage(error.message || "Authentication service is unavailable."));
})();
