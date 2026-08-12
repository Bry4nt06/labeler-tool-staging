"use strict";

(function installServoForgeFeedbackCenter(global) {
  if (global.LabelerFeedbackCenter?.installed) return;

  const API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-feedback";
  const RATINGS_API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-ratings";
  const TOKEN_KEY = "servoforge-feedback-access-token-v1";
  const ADMIN_KEY = "servoforge-feedback-admin-session-v1";
  const LAST_VIEWED_KEY = "servoforge-feedback-last-viewed-v1";
  const BUILD_MARKER = "public-ratings-v96-20260812-1821";

  function token() {
    let value = "";
    try { value = String(global.localStorage?.getItem(TOKEN_KEY) || ""); } catch { }
    if (value.length >= 20) return value;
    const random = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    value = `sf-${random}-${global.crypto?.getRandomValues ? Array.from(global.crypto.getRandomValues(new Uint32Array(4))).join("-") : Math.random()}`;
    try { global.localStorage?.setItem(TOKEN_KEY, value); } catch { }
    return value;
  }

  function adminKey() {
    try { return String(global.sessionStorage?.getItem(ADMIN_KEY) || ""); } catch { return ""; }
  }

  function setAdminKey(value) {
    try {
      if (value) global.sessionStorage?.setItem(ADMIN_KEY, value);
      else global.sessionStorage?.removeItem(ADMIN_KEY);
    } catch { }
  }

  async function api(action, payload = {}) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token(), ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error || `Feedback request failed (${response.status}).`));
    return data;
  }

  async function ratingsApi(action, payload = {}) {
    const response = await fetch(RATINGS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token(), ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error || `Ratings request failed (${response.status}).`));
    return data;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function appContext() {
    const state = global.state || {};
    const selectedMap = typeof global.selectedMachineMap === "function" ? global.selectedMachineMap() : null;
    return {
      version: String(global.SERVOFORGE_RELEASE_VERSION || document.querySelector('meta[name="application-version"]')?.content || ""),
      build: String(global.ServoForgeBootstrapBuild || global.SERVOFORGE_BUILD_ID || BUILD_MARKER),
      map: String(selectedMap?.name || state.selectedMapName || state.selectedMap || ""),
      machineType: String(selectedMap?.machineType || state.machineType || ""),
      application: String(selectedMap?.application || state.application || state.applicationMode || ""),
      brand: String(state.selectedBrand || ""),
      bottle: String(state.selectedBottle || ""),
      activeTab: String(state.activeTab || ""),
      userAgent: String(global.navigator?.userAgent || "").slice(0, 300),
      capturedAt: new Date().toISOString()
    };
  }

  function statusLabel(status) {
    return ({ open: "Open", in_review: "In Review", resolved: "Resolved", closed: "Closed" })[status] || status;
  }

  function typeLabel(type) {
    return ({ bug: "Bug", feature: "Feature Request", question: "Question", other: "Other" })[type] || type;
  }

  function ratingStars(value, ticketId = "", editable = false) {
    const rating = Number(value || 0);
    return `<div class="sf-feedback-stars" ${ticketId ? `data-ticket-rating="${esc(ticketId)}"` : ""}>${[1,2,3,4,5].map((star) => editable
      ? `<button type="button" class="sf-star ${star <= rating ? "active" : ""}" data-rating="${star}" aria-label="Rate ${star} out of 5">★</button>`
      : `<span class="sf-star ${star <= rating ? "active" : ""}">★</span>`).join("")}</div>`;
  }

  function ensureStyles() {
    if (document.getElementById("servoforgeFeedbackStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeFeedbackStyles";
    style.textContent = `
      .sf-feedback-top-button{margin-left:auto;margin-right:8px;white-space:nowrap}
      .topbar:has(.sf-feedback-top-button){align-items:flex-start}
      .sf-feedback-dialog{width:min(860px,calc(100vw - 24px));max-height:min(820px,calc(100vh - 30px));padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);box-shadow:0 30px 80px rgba(0,0,0,.55)}
      .sf-feedback-dialog::backdrop{background:rgba(3,8,12,.78);backdrop-filter:blur(3px)}
      .sf-feedback-shell{display:flex;flex-direction:column;max-height:inherit}
      .sf-feedback-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--panel-hi)}
      .sf-feedback-head h2{margin:0;font-size:20px}.sf-feedback-head p{margin:3px 0 0;color:var(--muted);font-size:13px}.sf-feedback-close{margin-left:auto;background:transparent;box-shadow:none}
      .sf-feedback-tabs{display:flex;gap:8px;padding:12px 18px 0}.sf-feedback-tabs button{background:var(--input);box-shadow:none}.sf-feedback-tabs button.active{background:linear-gradient(180deg,var(--btn-hover-a),var(--btn-hover-b))}
      .sf-feedback-body{overflow:auto;padding:18px}.sf-feedback-pane[hidden]{display:none!important}
      .sf-feedback-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.sf-feedback-field{display:flex;flex-direction:column;gap:6px}.sf-feedback-field.full{grid-column:1/-1}
      .sf-feedback-field input,.sf-feedback-field select,.sf-feedback-field textarea,.sf-admin-status{width:100%;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:10px}.sf-feedback-field textarea{min-height:140px;resize:vertical}
      .sf-feedback-note{font-size:12px;color:var(--muted)}.sf-feedback-submit-row{display:flex;align-items:center;gap:12px;margin-top:14px}.sf-feedback-status{color:var(--muted);font-size:13px}
      .sf-feedback-stars{display:flex;gap:2px}.sf-star{border:0;background:none!important;box-shadow:none!important;padding:2px;font-size:25px;color:#607078;line-height:1}.sf-star.active,.sf-star:hover{color:#f4bd42}
      .sf-ticket-list{display:grid;gap:12px}.sf-ticket-card{border:1px solid var(--line);border-radius:10px;background:var(--bg-soft);padding:14px}.sf-ticket-title{display:flex;align-items:flex-start;gap:10px}.sf-ticket-title strong{font-size:15px}.sf-ticket-meta{color:var(--muted);font-size:12px;margin-top:3px}.sf-ticket-badge{margin-left:auto;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:11px;white-space:nowrap}.sf-ticket-message{white-space:pre-wrap;margin:12px 0;line-height:1.45}.sf-ticket-context{font-size:11px;color:var(--muted)}
      .sf-replies{display:grid;gap:8px;margin-top:12px}.sf-reply{border-radius:8px;padding:9px 10px;background:var(--panel-hi);border-left:3px solid var(--blue)}.sf-reply.admin{border-left-color:var(--green)}.sf-reply-label{font-weight:700;font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}.sf-reply-message{white-space:pre-wrap}
      .sf-reply-compose{display:flex;gap:8px;margin-top:10px}.sf-reply-compose textarea{flex:1;min-height:58px;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:8px;resize:vertical}.sf-reply-compose button{align-self:flex-end}
      .sf-empty{padding:24px;border:1px dashed var(--line);border-radius:9px;color:var(--muted);text-align:center}.sf-admin-unlock{max-width:520px}.sf-admin-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}.sf-admin-ticket-actions{display:grid;grid-template-columns:170px 1fr auto;gap:8px;margin-top:10px}.sf-admin-ticket-actions textarea{min-height:62px;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:8px;resize:vertical}
      .sf-feedback-count{display:none;margin-left:6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--red);color:white;font-size:11px;align-items:center;justify-content:center}.sf-feedback-count.visible{display:inline-flex}
      .sf-ratings-summary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;margin-bottom:14px;border:1px solid var(--line);border-radius:9px;background:var(--bg-soft)}
      .sf-ratings-summary .sf-feedback-stars{gap:0}.sf-ratings-summary .sf-star{font-size:21px}.sf-ratings-summary strong{font-size:20px}
      .sf-public-rating-form{padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg-soft);margin-bottom:16px}.sf-public-rating-form textarea{min-height:78px}
      .sf-rating-comment-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sf-rating-counter{font-size:11px;color:var(--muted);white-space:nowrap}
      .sf-rating-list{display:grid;gap:10px}.sf-rating-card{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg-soft)}
      .sf-rating-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sf-rating-card-head .sf-feedback-stars{margin-right:4px}.sf-rating-card-head .sf-star{font-size:18px}.sf-rating-name{font-weight:700}.sf-rating-date{font-size:11px;color:var(--muted)}.sf-rating-mine{font-size:10px;border:1px solid var(--green);border-radius:999px;padding:2px 6px;color:var(--green)}.sf-rating-comment{margin:8px 0 0;white-space:pre-wrap;line-height:1.4}
      @media(max-width:700px){.sf-feedback-grid{grid-template-columns:1fr}.sf-feedback-field.full{grid-column:auto}.sf-admin-ticket-actions{grid-template-columns:1fr}.sf-feedback-top-button{margin-left:auto}.topbar{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    ensureStyles();
    let button = document.getElementById("feedbackCenterButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "feedbackCenterButton";
      button.type = "button";
      button.className = "sf-feedback-top-button";
      button.innerHTML = `Feedback <span id="feedbackUnreadCount" class="sf-feedback-count" aria-label="Unread replies"></span>`;
      const settings = document.querySelector(".top-settings-menu");
      settings?.parentElement?.insertBefore(button, settings);
    }

    let dialog = document.getElementById("servoforgeFeedbackDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "servoforgeFeedbackDialog";
      dialog.className = "sf-feedback-dialog";
      dialog.innerHTML = `
        <div class="sf-feedback-shell">
          <header class="sf-feedback-head"><div><h2>Feedback & Support</h2><p>No account required. Requests stay linked to this browser.</p></div><button type="button" class="sf-feedback-close" data-feedback-close>Close</button></header>
          <nav class="sf-feedback-tabs" aria-label="Feedback sections"><button type="button" class="active" data-feedback-tab="new">New Request</button><button type="button" data-feedback-tab="history">My Requests</button><button type="button" data-feedback-tab="ratings">Ratings</button><button type="button" data-feedback-tab="admin">Support Admin</button></nav>
          <div class="sf-feedback-body">
            <section class="sf-feedback-pane" data-feedback-pane="new">
              <form id="servoforgeFeedbackForm">
                <div class="sf-feedback-grid">
                  <label class="sf-feedback-field"><span>Request type</span><select name="type" required><option value="bug">Bug / Issue</option><option value="feature">Feature Request</option><option value="question">Question</option><option value="other">Other</option></select></label>
                  <label class="sf-feedback-field"><span>Rating</span><input name="rating" type="hidden" value="5" /><span data-new-rating>${ratingStars(5, "", true)}</span></label>
                  <label class="sf-feedback-field full"><span>Subject</span><input name="subject" maxlength="160" required placeholder="Short description of the request or issue" /></label>
                  <label class="sf-feedback-field full"><span>Message</span><textarea name="message" maxlength="5000" required placeholder="Tell us what happened, what you expected, or what you would like added."></textarea></label>
                  <label class="sf-feedback-field"><span>Name <small>(optional)</small></span><input name="requesterName" maxlength="120" autocomplete="name" /></label>
                  <label class="sf-feedback-field"><span>Email <small>(optional)</small></span><input name="requesterEmail" maxlength="180" type="email" autocomplete="email" /></label>
                  <label class="sf-feedback-field full"><span><input name="attachContext" type="checkbox" checked /> Attach current ServoForge build/map/brand diagnostics</span><small class="sf-feedback-note">This helps identify the exact machine setup and build involved.</small></label>
                </div>
                <div class="sf-feedback-submit-row"><button type="submit">Submit Request</button><span id="feedbackSubmitStatus" class="sf-feedback-status" aria-live="polite"></span></div>
              </form>
            </section>
            <section class="sf-feedback-pane" data-feedback-pane="history" hidden><div id="servoforgeFeedbackHistory" class="sf-ticket-list"><div class="sf-empty">Loading your requests…</div></div></section>
            <section class="sf-feedback-pane" data-feedback-pane="ratings" hidden>
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
            <section class="sf-feedback-pane" data-feedback-pane="admin" hidden>
              <div id="feedbackAdminUnlock" class="sf-admin-unlock"><div class="sf-feedback-field"><span>Support admin key</span><input id="feedbackAdminKey" type="password" autocomplete="off" placeholder="Enter admin key" /></div><div class="sf-feedback-submit-row"><button id="feedbackAdminUnlockButton" type="button">Unlock Support Inbox</button><span id="feedbackAdminStatus" class="sf-feedback-status"></span></div></div>
              <div id="feedbackAdminPanel" hidden><div class="sf-admin-toolbar"><button id="feedbackAdminRefresh" type="button">Refresh Inbox</button><button id="feedbackAdminLock" type="button">Lock Admin</button><span id="feedbackAdminCount" class="sf-feedback-status"></span></div><div id="servoforgeFeedbackAdminList" class="sf-ticket-list"></div></div>
            </section>
          </div>
        </div>`;
      document.body.appendChild(dialog);
    }
    return { button, dialog };
  }

  function switchPane(name) {
    document.querySelectorAll("[data-feedback-tab]").forEach((button) => button.classList.toggle("active", button.dataset.feedbackTab === name));
    document.querySelectorAll("[data-feedback-pane]").forEach((pane) => { pane.hidden = pane.dataset.feedbackPane !== name; });
    if (name === "history") loadHistory(true);
    if (name === "ratings") loadRatings();
    if (name === "admin" && adminKey()) unlockAdmin(adminKey(), true);
  }

  function contextSummary(context) {
    const entries = [["Build", context?.build], ["Map", context?.map], ["Brand", context?.brand], ["Bottle", context?.bottle], ["Application", context?.application]].filter(([,v]) => v);
    return entries.map(([k,v]) => `${k}: ${v}`).join(" • ");
  }

  function ticketHtml(ticket, admin = false) {
    const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
    return `<article class="sf-ticket-card" data-ticket-id="${esc(ticket.id)}">
      <div class="sf-ticket-title"><div><strong>#SF-${esc(ticket.ticketNumber)} · ${esc(ticket.subject)}</strong><div class="sf-ticket-meta">${esc(typeLabel(ticket.type))} · ${esc(new Date(ticket.createdAt).toLocaleString())}</div></div><span class="sf-ticket-badge">${esc(statusLabel(ticket.status))}</span></div>
      <div class="sf-ticket-message">${esc(ticket.message)}</div>
      ${ticket.rating ? `<div class="sf-ticket-meta">Rating ${ratingStars(ticket.rating, ticket.id, !admin)}</div>` : (!admin ? `<div class="sf-ticket-meta">Rate this request ${ratingStars(0, ticket.id, true)}</div>` : "")}
      ${contextSummary(ticket.appContext) ? `<div class="sf-ticket-context">${esc(contextSummary(ticket.appContext))}</div>` : ""}
      <div class="sf-replies">${replies.map((reply) => `<div class="sf-reply ${reply.sender === "admin" ? "admin" : ""}"><div class="sf-reply-label">${reply.sender === "admin" ? "ServoForge Support" : "You"} · ${esc(new Date(reply.createdAt).toLocaleString())}</div><div class="sf-reply-message">${esc(reply.message)}</div></div>`).join("")}</div>
      ${admin ? `<div class="sf-admin-ticket-actions"><select class="sf-admin-status"><option value="open" ${ticket.status === "open" ? "selected" : ""}>Open</option><option value="in_review" ${ticket.status === "in_review" ? "selected" : ""}>In Review</option><option value="resolved" ${ticket.status === "resolved" ? "selected" : ""}>Resolved</option><option value="closed" ${ticket.status === "closed" ? "selected" : ""}>Closed</option></select><textarea class="sf-admin-reply" placeholder="Reply to this user…"></textarea><button type="button" class="sf-admin-send">Send Reply</button></div>` : `<div class="sf-reply-compose"><textarea class="sf-user-reply" placeholder="Add more information or reply to support…"></textarea><button type="button" class="sf-user-send">Reply</button></div>`}
    </article>`;
  }

  let lastTickets = [];

  async function loadHistory(markViewed = false) {
    const host = document.getElementById("servoforgeFeedbackHistory");
    if (!host) return;
    host.innerHTML = `<div class="sf-empty">Loading your requests…</div>`;
    try {
      const data = await api("list");
      lastTickets = Array.isArray(data.tickets) ? data.tickets : [];
      host.innerHTML = lastTickets.length ? lastTickets.map((ticket) => ticketHtml(ticket)).join("") : `<div class="sf-empty">No requests yet. Submit one from New Request.</div>`;
      if (markViewed) {
        try { global.localStorage?.setItem(LAST_VIEWED_KEY, new Date().toISOString()); } catch { }
        updateUnreadBadge(lastTickets);
      }
    } catch (error) {
      host.innerHTML = `<div class="sf-empty">${esc(error.message)}</div>`;
    }
  }

  function updateUnreadBadge(tickets = lastTickets) {
    const badge = document.getElementById("feedbackUnreadCount");
    if (!badge) return;
    let lastViewed = 0;
    try { lastViewed = Date.parse(global.localStorage?.getItem(LAST_VIEWED_KEY) || "") || 0; } catch { }
    const unread = tickets.reduce((count, ticket) => count + (ticket.replies || []).filter((reply) => reply.sender === "admin" && Date.parse(reply.createdAt) > lastViewed).length, 0);
    badge.textContent = unread > 9 ? "9+" : String(unread || "");
    badge.classList.toggle("visible", unread > 0);
  }

  async function loadUnread() {
    try {
      const data = await api("list");
      lastTickets = Array.isArray(data.tickets) ? data.tickets : [];
      updateUnreadBadge(lastTickets);
    } catch { }
  }

  async function submitFeedback(form) {
    const status = document.getElementById("feedbackSubmitStatus");
    const data = new FormData(form);
    status.textContent = "Submitting…";
    try {
      const response = await api("create", {
        type: data.get("type"), subject: data.get("subject"), message: data.get("message"), rating: Number(data.get("rating")),
        requesterName: data.get("requesterName"), requesterEmail: data.get("requesterEmail"),
        appContext: data.get("attachContext") ? appContext() : {}
      });
      form.reset();
      form.elements.rating.value = "5";
      document.querySelectorAll("[data-new-rating] .sf-star").forEach((star) => star.classList.toggle("active", Number(star.dataset.rating) <= 5));
      status.textContent = `Submitted as #SF-${response.ticket.ticketNumber}.`;
      await loadHistory(false);
      setTimeout(() => switchPane("history"), 450);
    } catch (error) { status.textContent = error.message; }
  }

  async function userReply(card) {
    const textarea = card.querySelector(".sf-user-reply");
    const message = String(textarea?.value || "").trim();
    if (!message) return;
    const button = card.querySelector(".sf-user-send");
    button.disabled = true;
    try { await api("reply", { ticketId: card.dataset.ticketId, message }); await loadHistory(true); }
    catch (error) { alert(error.message); }
    finally { button.disabled = false; }
  }

  async function rateTicket(ticketId, rating) {
    try { await api("rate", { ticketId, rating }); await loadHistory(false); }
    catch (error) { alert(error.message); }
  }

  function publicRatingHtml(item) {
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

  async function unlockAdmin(key, silent = false) {
    const status = document.getElementById("feedbackAdminStatus");
    if (!silent) status.textContent = "Checking key…";
    try {
      const data = await api("adminList", { adminKey: key });
      setAdminKey(key);
      document.getElementById("feedbackAdminUnlock").hidden = true;
      document.getElementById("feedbackAdminPanel").hidden = false;
      status.textContent = "";
      renderAdmin(data.tickets || []);
    } catch (error) {
      setAdminKey("");
      document.getElementById("feedbackAdminUnlock").hidden = false;
      document.getElementById("feedbackAdminPanel").hidden = true;
      if (!silent) status.textContent = error.message;
    }
  }

  function renderAdmin(tickets) {
    const host = document.getElementById("servoforgeFeedbackAdminList");
    const count = document.getElementById("feedbackAdminCount");
    if (count) count.textContent = `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`;
    if (host) host.innerHTML = tickets.length ? tickets.map((ticket) => ticketHtml(ticket, true)).join("") : `<div class="sf-empty">No feedback tickets.</div>`;
  }

  async function refreshAdmin() {
    const key = adminKey();
    if (!key) return;
    try { const data = await api("adminList", { adminKey: key }); renderAdmin(data.tickets || []); }
    catch (error) { alert(error.message); }
  }

  async function adminReply(card) {
    const key = adminKey();
    const textarea = card.querySelector(".sf-admin-reply");
    const status = card.querySelector(".sf-admin-status")?.value || "in_review";
    const message = String(textarea?.value || "").trim();
    if (!message) return;
    const button = card.querySelector(".sf-admin-send");
    button.disabled = true;
    try { await api("adminReply", { adminKey: key, ticketId: card.dataset.ticketId, message, status }); await api("adminStatus", { adminKey: key, ticketId: card.dataset.ticketId, status }); await refreshAdmin(); }
    catch (error) { alert(error.message); }
    finally { button.disabled = false; }
  }

  function bind() {
    const { button, dialog } = ensureUi();
    button?.addEventListener("click", () => { dialog.showModal(); switchPane("new"); loadUnread(); });
    dialog.addEventListener("click", (event) => {
      const tab = event.target.closest?.("[data-feedback-tab]");
      if (tab) switchPane(tab.dataset.feedbackTab);
      if (event.target.closest?.("[data-feedback-close]")) dialog.close();
      const star = event.target.closest?.(".sf-star[data-rating]");
      if (star) {
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
      const userSend = event.target.closest?.(".sf-user-send");
      if (userSend) userReply(userSend.closest(".sf-ticket-card"));
      const adminSend = event.target.closest?.(".sf-admin-send");
      if (adminSend) adminReply(adminSend.closest(".sf-ticket-card"));
    });
    document.getElementById("servoforgeFeedbackForm")?.addEventListener("submit", (event) => { event.preventDefault(); submitFeedback(event.currentTarget); });
    document.getElementById("servoforgePublicRatingForm")?.addEventListener("submit", (event) => { event.preventDefault(); submitPublicRating(event.currentTarget); });
    document.querySelector('#servoforgePublicRatingForm textarea[name="comment"]')?.addEventListener("input", updateRatingCounter);
    document.getElementById("feedbackAdminUnlockButton")?.addEventListener("click", () => unlockAdmin(document.getElementById("feedbackAdminKey")?.value || ""));
    document.getElementById("feedbackAdminRefresh")?.addEventListener("click", refreshAdmin);
    document.getElementById("feedbackAdminLock")?.addEventListener("click", () => { setAdminKey(""); document.getElementById("feedbackAdminPanel").hidden = true; document.getElementById("feedbackAdminUnlock").hidden = false; });
    dialog.addEventListener("close", () => loadUnread());
    loadUnread();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.LabelerFeedbackCenter = Object.freeze({ installed: true, version: 2, build: BUILD_MARKER, api, ratingsApi, token, appContext, loadHistory, loadRatings, refreshAdmin });
})(typeof window !== "undefined" ? window : globalThis);
