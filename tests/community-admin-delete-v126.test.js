"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/community-admin-delete-v126.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "community-admin-delete-v126.js" }));

const calls = [];
let refreshClicks = 0;
let cardRemoved = 0;
let rowRemoved = 0;
let confirmation = true;

const card = {
  querySelector(selector) {
    if (selector === "h3") return { textContent: "#SF-C42 · Test Package" };
    return null;
  },
  remove() { cardRemoved += 1; }
};
const button = {
  disabled: false,
  textContent: "Delete",
  isConnected: true
};
const row = {
  dataset: { communityAdminId: "pkg-42" },
  previousElementSibling: card,
  querySelector(selector) { return selector === ".sf-community-admin-delete" ? button : null; },
  remove() { rowRemoved += 1; }
};

const context = {
  console,
  document: {
    readyState: "complete",
    getElementById(id) {
      if (id === "communityAdminRefresh") return { click() { refreshClicks += 1; } };
      return null;
    },
    querySelectorAll() { return []; },
    createElement() { throw new Error("Unexpected createElement in direct delete regression."); }
  },
  sessionStorage: {
    getItem(key) { return key === "servoforge-feedback-admin-session-v1" ? "admin-secret" : ""; }
  },
  LabelerCommunityLibrary: {
    async api(action, payload) {
      calls.push({ action, payload });
      return { ok: true };
    }
  },
  confirm(message) {
    assert.match(message, /Permanently delete #SF-C42 · Test Package/);
    assert.match(message, /cannot be undone/);
    return confirmation;
  },
  alert() {},
  setInterval() { return 1; },
  clearInterval() {},
  MutationObserver: class { observe() {} }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "community-admin-delete-v126.js" });

const api = context.ServoForgeCommunityAdminDeleteV126;
assert.ok(api?.installed);
assert.equal(api.adminDeleteAuthorizedServerSideV126, true);
assert.equal(api.cascadeRatingsOnDeleteV126, true);
assert.equal(api.adminKey(), "admin-secret");

(async () => {
  const deleted = await api.deleteAdminPackage(row);
  assert.equal(deleted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "adminDelete");
  assert.equal(calls[0].payload.adminKey, "admin-secret");
  assert.equal(calls[0].payload.packageId, "pkg-42");
  assert.equal(cardRemoved, 1);
  assert.equal(rowRemoved, 1);
  assert.equal(refreshClicks, 1);

  confirmation = false;
  const cancelledRow = {
    dataset: { communityAdminId: "pkg-43" },
    previousElementSibling: { querySelector() { return { textContent: "#SF-C43 · Keep Package" }; } },
    querySelector() { return button; }
  };
  const before = calls.length;
  const cancelled = await api.deleteAdminPackage(cancelledRow);
  assert.equal(cancelled, false);
  assert.equal(calls.length, before, "Cancel must not call the delete endpoint.");

  assert.match(source, /\.sf-community-admin-delete/);
  assert.match(source, /api\("adminDelete"/);
  assert.match(source, /servoforge-feedback-admin-session-v1/);
  assert.doesNotMatch(source, /deleteOwn/);
  console.log("Community Admin delete v126 regression passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
