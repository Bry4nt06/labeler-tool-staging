"use strict";

(() => {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...options
    });
    if (response.status === 401) {
      location.replace("/login.html");
      throw new Error("Session expired.");
    }
    return response;
  }

  async function mount() {
    const response = await request("/api/auth/me");
    if (!response.ok) return;
    const { user } = await response.json();
    if (!user) return;

    const topbar = document.querySelector(".topbar");
    if (!topbar || document.querySelector(".servoforge-auth-user")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "servoforge-auth-user";

    const identity = document.createElement("div");
    identity.className = "servoforge-auth-user__identity";

    const name = document.createElement("span");
    name.className = "servoforge-auth-user__name";
    name.textContent = user.displayName || user.username;

    const role = document.createElement("span");
    role.className = "servoforge-auth-user__role";
    role.textContent = user.role;

    identity.append(name, role);
    wrapper.append(identity);

    if (user.role === "owner" || user.role === "admin") {
      const admin = document.createElement("a");
      admin.href = "/admin.html";
      admin.textContent = "Users";
      wrapper.append(admin);
    }

    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", async () => {
      signOut.disabled = true;
      try {
        await request("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
      } finally {
        location.replace("/login.html");
      }
    });
    wrapper.append(signOut);
    topbar.append(wrapper);
  }

  mount().catch(() => {});
})();
