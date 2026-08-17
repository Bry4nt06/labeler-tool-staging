"use strict";

(() => {
  const message = document.getElementById("adminMessage");
  const usersBody = document.getElementById("usersBody");
  const signInsBody = document.getElementById("signInsBody");
  const createForm = document.getElementById("createUserForm");
  const roleSelect = document.getElementById("newRole");
  let currentUser = null;

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `auth-message visible ${type}`;
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "auth-message";
  }

  function fmtTime(value) {
    if (!value) return "Never";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    if (response.status === 401) {
      location.replace("/login.html");
      throw new Error("Session expired.");
    }
    if (response.status === 403 && path.startsWith("/api/admin/")) {
      location.replace("/");
      throw new Error("Administrator access required.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function badge(text, kind) {
    const span = document.createElement("span");
    span.className = `auth-badge ${kind}`;
    span.textContent = text;
    return span;
  }

  function actionButton(label, handler, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `auth-mini-button${danger ? " danger" : ""}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  async function setActive(user, active) {
    clearMessage();
    try {
      await api(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active })
      });
      showMessage(`${user.displayName || user.username} ${active ? "enabled" : "disabled"}.`, "success");
      await refresh();
    } catch (error) {
      showMessage(error.message);
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`Enter a new password for ${user.displayName || user.username}. Minimum 10 characters:`);
    if (password === null) return;
    clearMessage();
    try {
      await api(`/api/admin/users/${encodeURIComponent(user.id)}/password`, {
        method: "POST",
        body: JSON.stringify({ password })
      });
      showMessage(`Password reset for ${user.displayName || user.username}. Existing sessions were revoked.`, "success");
    } catch (error) {
      showMessage(error.message);
    }
  }

  function renderUsers(users) {
    usersBody.replaceChildren();
    for (const user of users) {
      const row = document.createElement("tr");

      const userCell = document.createElement("td");
      const display = document.createElement("strong");
      display.textContent = user.displayName || user.username;
      const handle = document.createElement("div");
      handle.className = "auth-muted";
      handle.textContent = `@${user.username}`;
      userCell.append(display, handle);

      const roleCell = document.createElement("td");
      roleCell.append(badge(user.role, user.role === "owner" ? "warn" : "ok"));

      const statusCell = document.createElement("td");
      statusCell.append(badge(user.active ? "Active" : "Disabled", user.active ? "ok" : "off"));

      const lastCell = document.createElement("td");
      lastCell.textContent = fmtTime(user.lastLoginAt);

      const countCell = document.createElement("td");
      countCell.textContent = String(user.loginCount || 0);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "auth-row-actions";
      const canManage = currentUser.role === "owner" || user.role === "user";
      const isSelf = user.id === currentUser.id;
      if (canManage && user.role !== "owner") {
        actions.append(actionButton(user.active ? "Disable" : "Enable", () => setActive(user, !user.active), user.active));
      }
      if (canManage && !isSelf) {
        actions.append(actionButton("Reset password", () => resetPassword(user)));
      }
      if (!actions.childElementCount) {
        const none = document.createElement("span");
        none.className = "auth-muted";
        none.textContent = isSelf ? "Current account" : "Owner protected";
        actions.append(none);
      }
      actionsCell.append(actions);

      row.append(userCell, roleCell, statusCell, lastCell, countCell, actionsCell);
      usersBody.append(row);
    }
  }

  function renderSignIns(rows) {
    signInsBody.replaceChildren();
    for (const entry of rows) {
      const row = document.createElement("tr");
      const time = document.createElement("td");
      time.textContent = fmtTime(entry.timestamp);
      const user = document.createElement("td");
      user.textContent = entry.displayName ? `${entry.displayName} (@${entry.username})` : `@${entry.username || "unknown"}`;
      const result = document.createElement("td");
      result.append(badge(entry.success ? "Success" : "Failed", entry.success ? "ok" : "off"));
      const reason = document.createElement("td");
      reason.textContent = String(entry.reason || "—").replaceAll("_", " ");
      const ip = document.createElement("td");
      const ipCode = document.createElement("code");
      ipCode.textContent = entry.ip || "—";
      ip.append(ipCode);
      const agent = document.createElement("td");
      agent.textContent = entry.userAgent || "—";
      row.append(time, user, result, reason, ip, agent);
      signInsBody.append(row);
    }
    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "auth-muted";
      cell.textContent = "No sign-in attempts recorded yet.";
      row.append(cell);
      signInsBody.append(row);
    }
  }

  async function refresh() {
    const [summary, users, signIns] = await Promise.all([
      api("/api/admin/summary"),
      api("/api/admin/users"),
      api("/api/admin/sign-ins?limit=100")
    ]);
    currentUser = summary.user;
    document.getElementById("statUsers").textContent = summary.totals.users;
    document.getElementById("statActive").textContent = summary.totals.activeUsers;
    document.getElementById("statSuccess").textContent = summary.totals.successfulSignIns;
    document.getElementById("statFailed").textContent = summary.totals.failedSignIns;
    roleSelect.querySelector('option[value="admin"]').disabled = currentUser.role !== "owner";
    if (currentUser.role !== "owner" && roleSelect.value === "admin") roleSelect.value = "user";
    renderUsers(users.users || []);
    renderSignIns(signIns.signIns || []);
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const submit = createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          displayName: document.getElementById("newDisplayName").value,
          username: document.getElementById("newUsername").value,
          password: document.getElementById("newPassword").value,
          role: roleSelect.value
        })
      });
      createForm.reset();
      showMessage("Account created.", "success");
      await refresh();
    } catch (error) {
      showMessage(error.message);
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("adminSignOut").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
    } finally {
      location.replace("/login.html");
    }
  });

  refresh().catch((error) => showMessage(error.message));
})();
