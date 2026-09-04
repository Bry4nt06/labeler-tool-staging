"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "app", "troubleshooting", "index.html");
const html = fs.readFileSync(indexPath, "utf8");

test("v357 troubleshooting shell advertises the recovery build", () => {
  assert.match(html, /data-troubleshooting-version="v357"/);
  assert.match(html, /TROUBLESHOOTING v357/);
  assert.match(html, /troubleshooting-shell-v357-20260904/);
});

test("early recovery monitor is installed before external troubleshooting scripts", () => {
  const monitor = html.indexOf("window.ServoForgeTroubleshootingBoot = state");
  const firstExternalScript = html.indexOf("<script defer src=");
  assert.ok(monitor >= 0, "early boot monitor missing");
  assert.ok(firstExternalScript > monitor, "boot monitor must run before external scripts");
  assert.match(html, /Startup stalled on this browser/);
  assert.match(html, /troubleshootingCacheRepair/);
  assert.match(html, /registration\.unregister\(\)/);
  assert.match(html, /caches\.delete\(name\)/);
});

test("troubleshooting assets use v357 cache keys and defer parser blocking", () => {
  const externalScripts = [...html.matchAll(/<script\s+defer\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(externalScripts.length >= 40, `expected the full troubleshooting script chain, found ${externalScripts.length}`);
  externalScripts.forEach((src) => assert.match(src, /shell=v357/, `missing v357 shell key: ${src}`));
  assert.doesNotMatch(html, /<script\s+src="/);
});

test("startup guard still precedes the troubleshooting controller", () => {
  const guard = html.indexOf("troubleshooting-startup-guard.js");
  const controller = html.indexOf("troubleshooting-app.js");
  assert.ok(guard >= 0 && controller > guard, "v356 compact-context guard must remain before the controller");
});

test("cache repair stays scoped to runtime cache and service workers", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  assert.doesNotMatch(head, /localStorage\.clear|indexedDB\.deleteDatabase/);
  assert.match(head, /CACHE_PREFIX = "servoforge-labeler-"/);
});
