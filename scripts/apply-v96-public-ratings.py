from pathlib import Path
import json

OLD = "anonymous-feedback-center-v95-20260812-1755"
NEW = "public-ratings-v96-20260812-1821"
OLD_TIME = "Aug 12, 2026 5:55 PM ET"
NEW_TIME = "Aug 12, 2026 6:21 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


path = "app/feedback-center-integration.js"
text = read(path)
text = text.replace(
    '  const API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-feedback";\n',
    '  const API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-feedback";\n'
    '  const RATINGS_API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-ratings";\n',
    1
)
if f'  const BUILD_MARKER = "{OLD}";' not in text:
    raise SystemExit("feedback build marker missing")
text = text.replace(f'  const BUILD_MARKER = "{OLD}";', f'  const BUILD_MARKER = "{NEW}";', 1)

anchor = '  function esc(value) {\n'
ratings_api = '''  async function ratingsApi(action, payload = {}) {
    const response = await fetch(RATINGS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token(), ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error || `Ratings request failed (${response.status}).`));
    return data;
  }

'''
if anchor not in text:
    raise SystemExit("ratings API insertion anchor missing")
text = text.replace(anchor, ratings_api + anchor, 1)

css_anchor = '      .sf-feedback-count{display:none;margin-left:6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--red);color:white;font-size:11px;align-items:center;justify-content:center}.sf-feedback-count.visible{display:inline-flex}\n'
css = '''      .sf-ratings-summary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;margin-bottom:14px;border:1px solid var(--line);border-radius:9px;background:var(--bg-soft)}
      .sf-ratings-summary .sf-feedback-stars{gap:0}.sf-ratings-summary .sf-star{font-size:21px}.sf-ratings-summary strong{font-size:20px}
      .sf-public-rating-form{padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg-soft);margin-bottom:16px}.sf-public-rating-form textarea{min-height:78px}
      .sf-rating-comment-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sf-rating-counter{font-size:11px;color:var(--muted);white-space:nowrap}
      .sf-rating-list{display:grid;gap:10px}.sf-rating-card{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg-soft)}
      .sf-rating-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sf-rating-card-head .sf-feedback-stars{margin-right:4px}.sf-rating-card-head .sf-star{font-size:18px}.sf-rating-name{font-weight:700}.sf-rating-date{font-size:11px;color:var(--muted)}.sf-rating-mine{font-size:10px;border:1px solid var(--green);border-radius:999px;padding:2px 6px;color:var(--green)}.sf-rating-comment{margin:8px 0 0;white-space:pre-wrap;line-height:1.4}
'''
if css_anchor not in text:
    raise SystemExit("ratings CSS anchor missing")
text = text.replace(css_anchor, css_anchor + css, 1)

old_nav = '<nav class="sf-feedback-tabs" aria-label="Feedback sections"><button type="button" class="active" data-feedback-tab="new">New Request</button><button type="button" data-feedback-tab="history">My Requests</button><button type="button" data-feedback-tab="admin">Support Admin</button></nav>'
new_nav = '<nav class="sf-feedback-tabs" aria-label="Feedback sections"><button type="button" class="active" data-feedback-tab="new">New Request</button><button type="button" data-feedback-tab="history">My Requests</button><button type="button" data-feedback-tab="ratings">Ratings</button><button type="button" data-feedback-tab="admin">Support Admin</button></nav>'
if old_nav not in text:
    raise SystemExit("feedback tabs markup missing")
text = text.replace(old_nav, new_nav, 1)

history_anchor = '            <section class="sf-feedback-pane" data-feedback-pane="history" hidden><div id="servoforgeFeedbackHistory" class="sf-ticket-list"><div class="sf-empty">Loading your requests…</div></div></section>\n'
ratings_pane = '''            <section class="sf-feedback-pane" data-feedback-pane="ratings" hidden>
              <div id="servoforgeRatingsSummary" class="sf-ratings-summary"><span>Loading ratings…</span></div>
              <form id="servoforgePublicRatingForm" class="sf-public-rating-form">
                <div class="sf-feedback-grid">
                  <label class="sf-feedback-field"><span>Your rating</span><input name="publicRating" type="hidden" value="5" /><span data-public-rating>${ratingStars(5, "", true)}</span></label>
                  <label class="sf-feedback-field"><span>Display name <small>(optional)</small></span><input name="displayName" maxlength="60" placeholder="Anonymous" /></label>
                  <label class="sf-feedback-field full"><span class="sf-rating-comment-row"><span>Public comment <small>(optional)</small></span><span id="servoforgeRatingCounter" class="sf-rating-counter">0 / 200</span></span><textarea name="comment" maxlength="200" placeholder="Share your experience with ServoForge in 200 characters or fewer."></textarea></label>
                </div>
                <div class="sf-feedback-submit-row"><button type="submit">Save Rating</button><span id="servoforgeRatingStatus" class="sf-feedback-status" aria-live="polite"></span></div>
              </form>
              <div id="servoforgeRatingsList" class="sf-rating-list"><div class="sf-empty">Loading ratings…</div></div>
            </section>
'''
if history_anchor not in text:
    raise SystemExit("history pane anchor missing")
text = text.replace(history_anchor, history_anchor + ratings_pane, 1)

switch_anchor = '    if (name === "history") loadHistory(true);\n'
if switch_anchor not in text:
    raise SystemExit("switchPane history anchor missing")
text = text.replace(switch_anchor, switch_anchor + '    if (name === "ratings") loadRatings();\n', 1)

unlock_anchor = '  async function unlockAdmin(key, silent = false) {\n'
ratings_functions = '''  function publicRatingHtml(item) {
    const comment = String(item?.comment || "").trim();
    const when = item?.updatedAt || item?.createdAt;
    return `<article class="sf-rating-card">
      <div class="sf-rating-card-head">${ratingStars(item?.rating || 0)}<span class="sf-rating-name">${esc(item?.displayName || "Anonymous")}</span>${item?.isMine ? '<span class="sf-rating-mine">Your rating</span>' : ""}<span class="sf-rating-date">${esc(when ? new Date(when).toLocaleDateString() : "")}</span></div>
      ${comment ? `<p class="sf-rating-comment">${esc(comment)}</p>` : ""}
    </article>`;
  }

  function setPublicRatingStars(rating) {
    const form = document.getElementById("servoforgePublicRatingForm");
    if (form) form.elements.publicRating.value = String(rating);
    document.querySelectorAll("[data-public-rating] .sf-star").forEach((node) => node.classList.toggle("active", Number(node.dataset.rating) <= Number(rating)));
  }

  function updateRatingCounter() {
    const form = document.getElementById("servoforgePublicRatingForm");
    const count = String(form?.elements?.comment?.value || "").length;
    const counter = document.getElementById("servoforgeRatingCounter");
    if (counter) counter.textContent = `${count} / 200`;
  }

  async function loadRatings() {
    const summary = document.getElementById("servoforgeRatingsSummary");
    const list = document.getElementById("servoforgeRatingsList");
    if (!summary || !list) return;
    summary.innerHTML = `<span>Loading ratings…</span>`;
    list.innerHTML = `<div class="sf-empty">Loading ratings…</div>`;
    try {
      const data = await ratingsApi("list");
      const ratings = Array.isArray(data.ratings) ? data.ratings : [];
      const average = Number(data.average || 0);
      const count = Number(data.count || ratings.length || 0);
      summary.innerHTML = count
        ? `${ratingStars(Math.round(average))}<strong>${esc(average.toFixed(1))}</strong><span>out of 5 · ${esc(count)} rating${count === 1 ? "" : "s"}</span>`
        : `<strong>No ratings yet</strong><span>Be the first to rate ServoForge.</span>`;
      list.innerHTML = ratings.length ? ratings.map(publicRatingHtml).join("") : `<div class="sf-empty">No public ratings yet.</div>`;

      const mine = ratings.find((item) => item?.isMine);
      const form = document.getElementById("servoforgePublicRatingForm");
      if (form && mine) {
        form.elements.displayName.value = String(mine.displayName === "Anonymous" ? "" : mine.displayName || "");
        form.elements.comment.value = String(mine.comment || "").slice(0, 200);
        setPublicRatingStars(Number(mine.rating || 5));
        const submit = form.querySelector('button[type="submit"]');
        if (submit) submit.textContent = "Update Rating";
      } else if (form) {
        const submit = form.querySelector('button[type="submit"]');
        if (submit) submit.textContent = "Save Rating";
      }
      updateRatingCounter();
    } catch (error) {
      summary.innerHTML = `<span>${esc(error.message)}</span>`;
      list.innerHTML = `<div class="sf-empty">Unable to load ratings.</div>`;
    }
  }

  async function submitPublicRating(form) {
    const status = document.getElementById("servoforgeRatingStatus");
    const data = new FormData(form);
    const comment = String(data.get("comment") || "").trim();
    if (comment.length > 200) {
      if (status) status.textContent = "Comment must be 200 characters or fewer.";
      return;
    }
    if (status) status.textContent = "Saving…";
    try {
      await ratingsApi("upsert", {
        rating: Number(data.get("publicRating")),
        displayName: data.get("displayName"),
        comment
      });
      if (status) status.textContent = "Rating saved.";
      await loadRatings();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

'''
if unlock_anchor not in text:
    raise SystemExit("ratings functions insertion anchor missing")
text = text.replace(unlock_anchor, ratings_functions + unlock_anchor, 1)

old_star = '''      if (star) {
        const group = star.closest(".sf-feedback-stars");
        const rating = Number(star.dataset.rating);
        if (group?.dataset.ticketRating) rateTicket(group.dataset.ticketRating, rating);
        else {
          const form = document.getElementById("servoforgeFeedbackForm");
          if (form) form.elements.rating.value = String(rating);
          group?.querySelectorAll(".sf-star").forEach((node) => node.classList.toggle("active", Number(node.dataset.rating) <= rating));
        }
      }
'''
new_star = '''      if (star) {
        const group = star.closest(".sf-feedback-stars");
        const rating = Number(star.dataset.rating);
        if (star.closest("[data-public-rating]")) setPublicRatingStars(rating);
        else if (group?.dataset.ticketRating) rateTicket(group.dataset.ticketRating, rating);
        else {
          const form = document.getElementById("servoforgeFeedbackForm");
          if (form) form.elements.rating.value = String(rating);
          group?.querySelectorAll(".sf-star").forEach((node) => node.classList.toggle("active", Number(node.dataset.rating) <= rating));
        }
      }
'''
if old_star not in text:
    raise SystemExit("star event block missing")
text = text.replace(old_star, new_star, 1)

form_anchor = '    document.getElementById("servoforgeFeedbackForm")?.addEventListener("submit", (event) => { event.preventDefault(); submitFeedback(event.currentTarget); });\n'
form_insert = '''    document.getElementById("servoforgePublicRatingForm")?.addEventListener("submit", (event) => { event.preventDefault(); submitPublicRating(event.currentTarget); });
    document.querySelector('#servoforgePublicRatingForm textarea[name="comment"]')?.addEventListener("input", updateRatingCounter);
'''
if form_anchor not in text:
    raise SystemExit("feedback form listener anchor missing")
text = text.replace(form_anchor, form_anchor + form_insert, 1)

old_export = '  global.LabelerFeedbackCenter = Object.freeze({ installed: true, version: 1, build: BUILD_MARKER, api, token, appContext, loadHistory, refreshAdmin });'
new_export = '  global.LabelerFeedbackCenter = Object.freeze({ installed: true, version: 2, build: BUILD_MARKER, api, ratingsApi, token, appContext, loadHistory, loadRatings, refreshAdmin });'
if old_export not in text:
    raise SystemExit("feedback API export anchor missing")
text = text.replace(old_export, new_export, 1)
write(path, text)

# Build identity v96.
path = "app/bootstrap.js"
text = read(path)
if f'const build = "{OLD}";' not in text:
    raise SystemExit("bootstrap v95 marker missing")
text = text.replace(f'const build = "{OLD}";', f'const build = "{NEW}";', 1)
text = text.replace(f'const buildUpdatedAt = "{OLD_TIME}";', f'const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "index.html", "app/update-manager.js", "service-worker.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"v95 marker missing from {path}")
    text = text.replace(OLD, NEW)
    text = text.replace(OLD_TIME, NEW_TIME)
    write(path, text)

# Keep build-pinned regressions current without changing functional assertions.
for test_path in Path("tests").glob("*.test.js"):
    text = test_path.read_text(encoding="utf-8")
    if OLD in text:
        test_path.write_text(text.replace(OLD, NEW), encoding="utf-8")

write("tests/public-ratings-v96.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "public-ratings-v96-20260812-1821";
const source = fs.readFileSync(path.join(root, "app/feedback-center-integration.js"), "utf8");
assert.match(source, /servoforge-ratings/);
assert.match(source, /data-feedback-tab="ratings">Ratings</);
assert.match(source, /data-feedback-pane="ratings"/);
assert.match(source, /maxlength="200"/);
assert.match(source, /servoforgeRatingCounter/);
assert.match(source, /loadRatings/);
assert.match(source, /submitPublicRating/);
assert.match(source, /Update Rating/);
assert.match(source, /Your rating/);
assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const delivery of [bootstrap, sw, updater, app, index]) assert.match(delivery, new RegExp(BUILD));
console.log("Public Ratings v96 regression passed.");
''')

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v96 adds a public Ratings tab to Feedback & Support between My Requests and Support Admin. Ratings are intentionally stored separately from private support tickets. Users can leave or update a 1–5 star rating, an optional display name, and an optional public comment limited to 200 characters. The Ratings tab shows the aggregate average, rating count, and up to 200 recent ratings. No end-user login is required. v95 support tickets and v94 Brand selection authority remain unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
