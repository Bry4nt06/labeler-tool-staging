from __future__ import annotations

import json
import re
from pathlib import Path

FINAL_BUILD = "bootstrap-independent-navigation-v69-20260811-1305"
FINAL_QUERY = "0.9.10-bootstrap-independent-navigation-v69-20260811-1305"

root = Path(__file__).resolve().parents[1]

# Load the navigation controller directly from the page before any application
# driver or bootstrap module. This makes tab switching available even when a
# later startup dependency fails against an existing saved workspace.
index_path = root / "index.html"
index = index_path.read_text(encoding="utf-8")
for old in (
    "0.9.10-direct-workspace-tabs-v68-20260811-1241",
    "0.9.10-bootstrap-independent-navigation-v69-20260811-1256",
    "0.9.10-bootstrap-independent-navigation-v69-20260811-1300",
):
    index = index.replace(old, FINAL_QUERY)
index = re.sub(
    r'\s*<script src="app/controllers/tabs-controller\.js\?v=[^"]+"></script>\n?',
    "\n",
    index,
)
first_driver = '    <script src="drivers/geometry/label-geometry-driver.js?v=0.9.10"></script>\n'
if first_driver not in index:
    raise RuntimeError("Unable to locate first application driver in index.html")
direct_nav = f'    <script src="app/controllers/tabs-controller.js?v={FINAL_QUERY}"></script>\n'
index = index.replace(first_driver, direct_nav + first_driver, 1)
index_path.write_text(index, encoding="utf-8")

bootstrap_path = root / "app" / "bootstrap.js"
bootstrap = bootstrap_path.read_text(encoding="utf-8")
bootstrap = re.sub(
    r'const build = "(?:direct-workspace-tabs-v68-20260811-1241|bootstrap-independent-navigation-v69-20260811-(?:1256|1300|1305))";',
    f'const build = "{FINAL_BUILD}";',
    bootstrap,
    count=1,
)
bootstrap = re.sub(
    r'const buildUpdatedAt = "Aug 11, 2026 (?:12:41 PM|12:56 PM|1:00 PM|1:05 PM) ET";',
    'const buildUpdatedAt = "Aug 11, 2026 1:05 PM ET";',
    bootstrap,
    count=1,
)
bootstrap = bootstrap.replace('    "app/controllers/tabs-controller.js",\n', "")
lineage_prefix = "// Regression lineage: "
lineage_line = next((line for line in bootstrap.splitlines() if line.startswith(lineage_prefix)), "")
if FINAL_BUILD not in lineage_line:
    bootstrap = bootstrap.replace(lineage_prefix, lineage_prefix + FINAL_BUILD + " • ", 1)
bootstrap_path.write_text(bootstrap, encoding="utf-8")

worker_path = root / "service-worker.js"
worker = worker_path.read_text(encoding="utf-8")
worker = re.sub(
    r'const CACHE_NAME = "servoforge-labeler-staging-v0\.9\.10-(?:direct-workspace-tabs-v68|bootstrap-independent-navigation-v69)";',
    'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-bootstrap-independent-navigation-v69";',
    worker,
    count=1,
)
worker_path.write_text(worker, encoding="utf-8")

manifest_path = root / "update-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = FINAL_BUILD
manifest["notes"] = (
    "Staging v69 loads workspace navigation directly from index.html before all application "
    "drivers and outside the bootstrap chain. Specs, Build Inputs, Servo Program, Diagnostics, "
    "and Servo Simulation remain selectable even if a later startup module fails."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

test_path = root / "tests" / "top-navigation-recovery.test.js"
test_path.write_text(
    r'''"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "controllers", "tabs-controller.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /navigationCaptureV3:\s*true/);
assert.match(source, /setDirectTabState/);
assert.match(source, /stopImmediatePropagation/);
assert.match(index, /app\/controllers\/tabs-controller\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\/bootstrap\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\/update-manager\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(bootstrap, /bootstrap-independent-navigation-v69-20260811-1305/);
assert.doesNotMatch(bootstrap, /"app\/controllers\/tabs-controller\.js"/);
assert.match(serviceWorker, /servoforge-labeler-staging-v0\.9\.10-bootstrap-independent-navigation-v69/);

const navIndex = index.indexOf("app/controllers/tabs-controller.js");
const driverIndex = index.indexOf("drivers/geometry/label-geometry-driver.js");
const bootstrapIndex = index.indexOf("app/bootstrap.js");
assert.ok(navIndex >= 0, "Direct navigation script must exist.");
assert.ok(navIndex < driverIndex, "Navigation controller must load before application drivers.");
assert.ok(navIndex < bootstrapIndex, "Navigation controller must load before bootstrap.");

console.log("Bootstrap-independent top navigation regression passed.");
''',
    encoding="utf-8",
)

print(FINAL_BUILD)
