"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const stability = read("app/community-library-runtime-stability-integration.js");

test("Community runtime stability guard loads after the final top-action button layer", () => {
  const baseIndex = bootstrap.indexOf('"app/community-library-integration.js"');
  const v104Index = bootstrap.indexOf('"app/community-library-v104-metadata-integration.js"');
  const v103Index = bootstrap.indexOf('"app/community-library-v103-integration.js"');
  const topActionIndex = bootstrap.indexOf('"app/top-action-icons-integration.js"');
  const stabilityIndex = bootstrap.indexOf('"app/community-library-runtime-stability-integration.js"');

  assert.ok(baseIndex >= 0, "base Community module must load");
  assert.ok(v104Index > baseIndex, "v104 metadata layer must load after base Community");
  assert.ok(v103Index > v104Index, "v103 UI layer must load after v104 metadata");
  assert.ok(topActionIndex > v103Index, "top-action layer must finish before launcher stabilization");
  assert.ok(stabilityIndex > topActionIndex, "runtime stability guard must own the final Community button");
});

test("Community launcher has one guarded click owner and safe dialog re-entry", () => {
  assert.match(stability, /if \(opening\) return true/);
  assert.match(stability, /if \(!dialog\.open\) dialog\.showModal\(\)/);
  assert.match(stability, /dialog\.setAttribute\("open", ""\)/);
  assert.match(stability, /current\.cloneNode\(true\)/);
  assert.match(stability, /current\.replaceWith\(button\)/);
  assert.match(stability, /event\.stopImmediatePropagation\(\)/);
  assert.match(stability, /singleAuthoritativeButtonListener: true/);
  assert.match(stability, /safeDialogReentry: true/);
});

test("Community open detaches the legacy browse-list observer without replacing the dialog", () => {
  assert.match(stability, /const replacement = host\.cloneNode\(true\)/);
  assert.match(stability, /host\.replaceWith\(replacement\)/);
  assert.match(stability, /legacyBrowseObserverDetachedOnOpen: true/);
  assert.doesNotMatch(stability, /dialog\.cloneNode/);
  assert.doesNotMatch(stability, /library\.api\("browse"/);
});

test("Community repair observer only watches for replacement of the launch button", () => {
  assert.match(stability, /node\.id === BUTTON_ID/);
  assert.match(stability, /node\.querySelector\?\.\(`#\$\{BUTTON_ID\}`\)/);
  assert.match(stability, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(stability, /observer\.observe\([^\n]*communityBrowseList/);
});
