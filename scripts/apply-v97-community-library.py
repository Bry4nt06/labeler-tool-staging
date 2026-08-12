from pathlib import Path
import json

OLD = "public-ratings-v96-20260812-1821"
NEW = "community-library-v97-20260812-1918"
OLD_TIME = "Aug 12, 2026 6:21 PM ET"
NEW_TIME = "Aug 12, 2026 7:18 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

# Remove the legacy transfer buttons directly from the staging Settings panel.
path = "index.html"
text = read(path)
legacy_fragments = [
    '            <button id="exportSettings" type="button">Export Settings</button>\n',
    '            <label class="file-action">Import Settings<input id="importSettings" type="file" accept="application/json,.json" /></label>\n',
    '            <button id="exportJson" type="button">Export JSON</button>\n',
    '            <label class="file-action">Import Fault JSON<input id="importFaultConfig" type="file" accept="application/json,.json" /></label>\n',
    '            <button id="exportCsv" type="button">Export CSV</button>\n',
]
for fragment in legacy_fragments:
    text = text.replace(fragment, "")
text = text.replace(OLD, NEW)
write(path, text)

# Load Community immediately after Feedback and publish v97 build identity.
path = "app/bootstrap.js"
text = read(path)
if '"app/community-library-integration.js"' not in text:
    text = text.replace('    "app/feedback-center-integration.js",\n', '    "app/feedback-center-integration.js",\n    "app/community-library-integration.js",\n', 1)
text = text.replace(f'const build = "{OLD}";', f'const build = "{NEW}";', 1)
text = text.replace(f'const buildUpdatedAt = "{OLD_TIME}";', f'const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "app/update-manager.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"Expected v96 build identity missing from {path}")
    write(path, text.replace(OLD, NEW))

path = "service-worker.js"
text = read(path)
if OLD not in text:
    raise SystemExit("Expected v96 service-worker cache identity missing")
text = text.replace(OLD, NEW)
if '"./app/community-library-integration.js"' not in text:
    marker = '  "./app/feedback-center-integration.js",\n'
    if marker in text:
        text = text.replace(marker, marker + '  "./app/community-library-integration.js",\n', 1)
write(path, text)

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v97 adds the login-free ServoForge Community Library with Browse, Upload, My Uploads, and Community Admin. "
    "Users can submit the current Machine Map, Bottle, Brand/Label, or complete Map+Bottle+Brand setup as validated JSON for admin review. "
    "Only published packages appear publicly; packages have ratings, optional 200-character reviews, download counts, conflict-aware Add as New / Replace Existing import, and JSON sanitization before local import. "
    "The staging Settings menu removes Export Settings, Import Settings, Download Brands, Import Map JSON, Export JSON, Import Fault Limits/JSON, and Export CSV. "
    "Feedback/Support v95-v96, Brand selection v94, APL geometry/validation, Bottle Orientation, and wipe behavior remain unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

# Tests that intentionally pin the currently delivered staging build move forward.
for test_path in Path("tests").glob("*.test.js"):
    source = test_path.read_text(encoding="utf-8")
    if OLD in source:
        test_path.write_text(source.replace(OLD, NEW), encoding="utf-8")

Path("tests/community-library-v97.test.js").write_text(r'''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "community-library-v97-20260812-1918";
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));

assert.match(community, /servoforge-community/);
assert.match(community, /Browse/);
assert.match(community, /Upload/);
assert.match(community, /My Uploads/);
assert.match(community, /Community Admin/);
assert.match(community, /Complete Setup/);
assert.match(community, /maxlength="200"/);
assert.match(community, /Submit for Review/);
assert.match(community, /data-community-import="add"/);
assert.match(community, /data-community-import="replace"/);
assert.match(community, /__proto__/);
assert.match(community, /prototype/);
assert.match(community, /constructor/);
assert.match(community, /community_package|Community package|Community Package/i);
assert.doesNotMatch(community, /\beval\s*\(/);
assert.doesNotMatch(community, /new Function\s*\(/);

const feedbackIndex = bootstrap.indexOf('"app/feedback-center-integration.js"');
const communityIndex = bootstrap.indexOf('"app/community-library-integration.js"');
assert.ok(feedbackIndex >= 0 && communityIndex > feedbackIndex, "Community Library must load after Feedback identity is installed.");

for (const label of ["Export Settings", "Import Settings", "Export JSON", "Import Fault JSON", "Export CSV"]) {
  assert.ok(!index.includes(`>${label}<`) && !index.includes(`${label}<input`), `${label} must be removed from staging Settings HTML.`);
}
for (const label of ["Download Brands", "Import Map JSON", "Import Fault Limits"]) assert.ok(community.includes(`"${label}"`));

for (const source of [bootstrap, index, sw, updater, app]) assert.match(source, new RegExp(BUILD));
assert.equal(manifest.buildId, BUILD);
console.log("Community Library v97 and staging Settings cleanup regression passed.");
''', encoding="utf-8")
