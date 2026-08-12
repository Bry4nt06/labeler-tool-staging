from pathlib import Path
import json

OLD = "brand-selection-event-authority-v94-20260811-2150"
NEW = "anonymous-feedback-center-v95-20260812-1755"
OLD_TIME = "Aug 11, 2026 9:50 PM ET"
NEW_TIME = "Aug 12, 2026 5:55 PM ET"


def read(path): return Path(path).read_text(encoding="utf-8")
def write(path, text): Path(path).write_text(text, encoding="utf-8")

# Bootstrap: publish v95 and load feedback UI after settings controller.
path = "app/bootstrap.js"
text = read(path)
if f'const build = "{OLD}";' not in text:
    raise SystemExit("current bootstrap build marker not found")
text = text.replace(f'const build = "{OLD}";', f'const build = "{NEW}";', 1)
text = text.replace(f'const buildUpdatedAt = "{OLD_TIME}";', f'const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
anchor = '    "app/controllers/settings-controller.js",\n'
if anchor not in text:
    raise SystemExit("settings controller module anchor missing")
text = text.replace(anchor, anchor + '    "app/feedback-center-integration.js",\n', 1)
write(path, text)

# Client-visible delivery markers.
for path in ["app.js", "index.html", "app/update-manager.js", "service-worker.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"v94 marker missing from {path}")
    text = text.replace(OLD, NEW)
    text = text.replace(OLD_TIME, NEW_TIME)
    write(path, text)

# Cache the new integration for PWA/offline shell.
path = "service-worker.js"
text = read(path)
asset = '  "./app/feedback-center-integration.js",\n'
if asset not in text:
    anchor = '  "./app/update-manager.js",\n'
    if anchor not in text:
        anchor = '  "./app/controllers/settings-controller.js",\n'
    if anchor not in text:
        raise SystemExit("service worker asset anchor missing")
    text = text.replace(anchor, anchor + asset, 1)
write(path, text)

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v95 adds a login-free Feedback & Support Center beside Settings. Users receive a private browser identity automatically, can submit bugs, requests, questions and ratings, review their ticket history, receive ServoForge Support replies, continue conversations, and update 1–5 star ratings. Current build/map/brand diagnostics can be attached automatically. A protected Support Admin inbox allows replies and status changes without exposing database credentials. v94 Brand event ownership and all validated APL/servo behavior remain unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

# Move only delivery/build-pin assertions forward. Functional assertions stay unchanged.
for test_path in Path("tests").glob("*.test.js"):
    text = test_path.read_text(encoding="utf-8")
    if OLD in text:
        test_path.write_text(text.replace(OLD, NEW), encoding="utf-8")

# Focused regression.
write("tests/feedback-center-v95.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "anonymous-feedback-center-v95-20260812-1755";
const feedback = fs.readFileSync(path.join(root, "app/feedback-center-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
assert.match(feedback, /servoforge-feedback-access-token-v1/);
assert.match(feedback, /feedbackCenterButton/);
assert.match(feedback, /New Request/);
assert.match(feedback, /My Requests/);
assert.match(feedback, /Support Admin/);
assert.match(feedback, /ratingStars/);
assert.match(feedback, /appContext/);
assert.match(feedback, /adminReply/);
assert.match(bootstrap, /app\/feedback-center-integration\.js/);
assert.match(sw, /app\/feedback-center-integration\.js/);
for (const source of [bootstrap, sw, updater, index, app]) assert.match(source, new RegExp(BUILD));
assert.equal(manifest.buildId, BUILD);
assert.doesNotMatch(feedback, /SUPABASE_SERVICE_ROLE_KEY|service_role/i, "Privileged Supabase credentials must never be shipped to the browser.");
console.log("Anonymous Feedback Center v95 regression passed.");
''')
