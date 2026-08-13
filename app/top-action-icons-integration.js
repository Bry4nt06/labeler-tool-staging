"use strict";

(function installServoForgeTopActionIcons(global) {
  if (global.LabelerTopActionIcons?.installed) return;

  const BUILD_MARKER = "top-action-icon-cluster-v101-20260813-1603";
  const icons = Object.freeze({
    community: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    feedback: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.38.5.7.9.9.35.18.75.28 1.15.28H21v4h-.1a1.7 1.7 0 0 0-1.5.82z"></path></svg>'
  });

  function ensureStyles() {
    if (document.getElementById("servoforgeTopActionIconStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeTopActionIconStyles";
    style.textContent = `
      .sf-top-action-cluster{margin-left:auto;display:flex;align-items:flex-start;justify-content:flex-end;gap:8px;align-self:flex-start;flex:0 0 auto}
      .sf-top-action-cluster>.sf-top-icon-button,.sf-top-action-cluster>.top-settings-menu>summary{position:relative;width:40px;height:40px;min-width:40px;min-height:40px;margin:0!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,var(--btn-a),var(--btn-b));color:#ecfff6;box-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 8px 18px rgba(0,0,0,.16);cursor:pointer}
      .sf-top-action-cluster>.sf-top-icon-button:hover,.sf-top-action-cluster>.top-settings-menu>summary:hover{border-color:rgba(120,255,190,.75);color:#fff;background:linear-gradient(180deg,var(--btn-hover-a),var(--btn-hover-b))}
      .sf-top-action-cluster svg{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
      .sf-top-action-cluster>.top-settings-menu{margin:0;align-self:flex-start}
      .sf-top-action-cluster>.top-settings-menu>summary{list-style:none;text-align:center;font-size:0}
      .sf-top-action-cluster>.top-settings-menu>summary::-webkit-details-marker{display:none}
      .sf-top-action-cluster .sf-feedback-count{position:absolute;top:-5px;right:-5px;margin:0;z-index:2;box-shadow:0 0 0 2px var(--bg)}
      .topbar:has(.sf-top-action-cluster){align-items:flex-start}
      @media(max-width:700px){.topbar:has(.sf-top-action-cluster){flex-wrap:wrap}.sf-top-action-cluster{margin-left:auto}}
    `;
    document.head.appendChild(style);
  }

  function setIconButton(button, icon, label) {
    if (!button) return;
    const unread = button.querySelector("#feedbackUnreadCount");
    button.classList.add("sf-top-icon-button");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    if (unread) button.appendChild(unread);
  }

  function apply() {
    const topbar = document.querySelector(".topbar");
    const community = document.getElementById("communityLibraryButton");
    const feedback = document.getElementById("feedbackCenterButton");
    const settings = document.querySelector(".top-settings-menu");
    if (!topbar || !community || !feedback || !settings) return false;

    ensureStyles();
    let cluster = document.getElementById("servoforgeTopActionCluster");
    if (!cluster) {
      cluster = document.createElement("div");
      cluster.id = "servoforgeTopActionCluster";
      cluster.className = "sf-top-action-cluster";
      cluster.setAttribute("aria-label", "Community, Feedback, and Settings");
      topbar.appendChild(cluster);
    }

    setIconButton(community, icons.community, "Community");
    setIconButton(feedback, icons.feedback, "Feedback");

    const summary = settings.querySelector(":scope > summary");
    if (summary) {
      summary.innerHTML = icons.settings;
      summary.title = "Settings";
      summary.setAttribute("aria-label", "Settings");
    }

    // Keep these three controls together in the requested visual order.
    cluster.append(community, feedback, settings);
    return true;
  }

  let attempts = 0;
  function settle() {
    attempts += 1;
    if (apply() || attempts >= 200) return;
    global.setTimeout(settle, 50);
  }

  global.LabelerTopActionIcons = Object.freeze({
    installed: true,
    build: BUILD_MARKER,
    apply,
    order: Object.freeze(["community", "feedback", "settings"])
  });

  settle();
})(window);
