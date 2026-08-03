"use strict";

(function installHealthStatusUiController(global) {
  if (global.LabelerHealthStatusUiController?.installed) return;

  const STYLE_ID = "servoforgeHealthStatusStyles";
  const GOOD_WORDS = new Set(["pass", "passed", "ok", "good", "ready", "healthy", "success", "valid"]);
  const WARN_WORDS = new Set(["review", "warn", "warning", "caution", "attention", "advisory"]);
  const BAD_WORDS = new Set(["fail", "failed", "bad", "error", "fault", "critical", "action", "invalid"]);
  const INFO_WORDS = new Set(["running", "info", "informational", "pending", "checking"]);
  let refreshQueued = false;

  function normalizedWord(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  }

  function healthFromValue(value) {
    const word = normalizedWord(value);
    if (!word) return "";
    if (GOOD_WORDS.has(word)) return "good";
    if (WARN_WORDS.has(word)) return "warn";
    if (BAD_WORDS.has(word)) return "bad";
    if (INFO_WORDS.has(word)) return "info";
    return "";
  }

  function setHealth(element, health) {
    if (!(element instanceof Element) || !health) return false;
    if (element.dataset.health === health) return false;
    element.dataset.health = health;
    return true;
  }

  function numericValue(text) {
    const match = String(text ?? "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function healthForCount(text, kind) {
    const count = numericValue(text);
    if (!Number.isFinite(count)) return kind === "info" ? "info" : "";
    if (kind === "bad") return count > 0 ? "bad" : "good";
    if (kind === "warn") return count > 0 ? "warn" : "good";
    if (kind === "good") return count > 0 ? "good" : "info";
    return "info";
  }

  function annotateStatusAttributes(root) {
    root.querySelectorAll?.("[data-status],[data-level]").forEach((element) => {
      const health = healthFromValue(element.dataset.status) || healthFromValue(element.dataset.level);
      if (health) setHealth(element, health);
    });
  }

  function annotateNotices(root) {
    root.querySelectorAll?.(".notice").forEach((notice) => {
      setHealth(notice, notice.classList.contains("bad") ? "bad" : notice.classList.contains("warn") ? "warn" : "good");
    });
    root.querySelectorAll?.(".sensor-status-pass").forEach((element) => setHealth(element, "good"));
    root.querySelectorAll?.(".sensor-status-fail").forEach((element) => setHealth(element, "bad"));
    root.querySelectorAll?.(".map-fault-notice,.startup-error").forEach((element) => setHealth(element, "bad"));
  }

  function annotatePipelineCounts(root) {
    root.querySelectorAll?.(".pipeline-validation-summary span").forEach((chip) => {
      const text = chip.textContent || "";
      if (/fault/i.test(text)) setHealth(chip, healthForCount(text, "bad"));
      else if (/warn/i.test(text)) setHealth(chip, healthForCount(text, "warn"));
      else setHealth(chip, "info");
    });
  }

  function annotateReleaseCounts(root) {
    root.querySelectorAll?.(".release-readiness-status span").forEach((chip) => {
      const text = chip.textContent || "";
      if (/fail/i.test(text)) setHealth(chip, healthForCount(text, "bad"));
      else if (/review|warn/i.test(text)) setHealth(chip, healthForCount(text, "warn"));
      else if (/pass/i.test(text)) setHealth(chip, healthForCount(text, "good"));
      else setHealth(chip, "info");
    });
  }

  function annotateDiagnosticsOverview(root) {
    root.querySelectorAll?.(".diagnostics-overview > div").forEach((card) => {
      const label = card.querySelector("span")?.textContent || "";
      const value = card.querySelector("strong")?.textContent || "";
      const direct = healthFromValue(value);
      if (direct) {
        setHealth(card, direct);
        return;
      }
      if (/faults?\s*\/\s*warnings?/i.test(label)) {
        const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        setHealth(card, numbers[0] > 0 ? "bad" : numbers[1] > 0 ? "warn" : "good");
      }
    });

    const workspaceStatus = document.querySelector(".diagnostics-workspace-status")?.dataset.health || "";
    document.querySelectorAll(".diagnostics-tab-count").forEach((count) => {
      if (!count.hidden) setHealth(count, workspaceStatus === "bad" ? "bad" : workspaceStatus === "warn" ? "warn" : "info");
    });
  }

  function annotateOptimizerMetrics(root) {
    root.querySelectorAll?.(".program-optimizer-metrics > div").forEach((card) => {
      const label = card.querySelector("span")?.textContent || "";
      const value = card.querySelector("strong")?.textContent || "";
      if (/speed faults?/i.test(label)) setHealth(card, healthForCount(value, "bad"));
      else if (/findings?/i.test(label)) {
        const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        setHealth(card, numbers[0] > 0 ? "bad" : numbers[1] > 0 ? "warn" : "good");
      }
    });
  }

  function annotate(root = document) {
    annotateStatusAttributes(root);
    annotateNotices(root);
    annotatePipelineCounts(root);
    annotateReleaseCounts(root);
    annotateDiagnosticsOverview(root);
    annotateOptimizerMetrics(root);
  }

  function scheduleAnnotate() {
    if (refreshQueued) return;
    refreshQueued = true;
    global.requestAnimationFrame(() => {
      refreshQueued = false;
      annotate(document);
    });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --health-good: #39d77d;
        --health-good-text: #6df0a5;
        --health-good-bg: rgba(34, 184, 99, 0.16);
        --health-good-glow: rgba(57, 215, 125, 0.22);
        --health-warn: #e7b93f;
        --health-warn-text: #ffd86d;
        --health-warn-bg: rgba(218, 165, 35, 0.17);
        --health-warn-glow: rgba(231, 185, 63, 0.22);
        --health-bad: #ed5965;
        --health-bad-text: #ff8991;
        --health-bad-bg: rgba(215, 53, 67, 0.18);
        --health-bad-glow: rgba(237, 89, 101, 0.25);
        --health-info: #59aee9;
        --health-info-text: #88caff;
        --health-info-bg: rgba(58, 139, 201, 0.16);
        --health-info-glow: rgba(89, 174, 233, 0.2);
      }

      body[data-theme="light"] {
        --health-good: #16834d;
        --health-good-text: #11683d;
        --health-good-bg: rgba(22, 131, 77, 0.13);
        --health-good-glow: rgba(22, 131, 77, 0.18);
        --health-warn: #a76c00;
        --health-warn-text: #845600;
        --health-warn-bg: rgba(190, 126, 0, 0.14);
        --health-warn-glow: rgba(167, 108, 0, 0.16);
        --health-bad: #c53742;
        --health-bad-text: #a8202c;
        --health-bad-bg: rgba(197, 55, 66, 0.13);
        --health-bad-glow: rgba(197, 55, 66, 0.17);
        --health-info: #2178b3;
        --health-info-text: #165f91;
        --health-info-bg: rgba(33, 120, 179, 0.12);
        --health-info-glow: rgba(33, 120, 179, 0.15);
      }

      [data-health="good"] {
        --health-current: var(--health-good);
        --health-current-text: var(--health-good-text);
        --health-current-bg: var(--health-good-bg);
        --health-current-glow: var(--health-good-glow);
      }
      [data-health="warn"] {
        --health-current: var(--health-warn);
        --health-current-text: var(--health-warn-text);
        --health-current-bg: var(--health-warn-bg);
        --health-current-glow: var(--health-warn-glow);
      }
      [data-health="bad"] {
        --health-current: var(--health-bad);
        --health-current-text: var(--health-bad-text);
        --health-current-bg: var(--health-bad-bg);
        --health-current-glow: var(--health-bad-glow);
      }
      [data-health="info"] {
        --health-current: var(--health-info);
        --health-current-text: var(--health-info-text);
        --health-current-bg: var(--health-info-bg);
        --health-current-glow: var(--health-info-glow);
      }

      .notice[data-health] {
        border-left-color: var(--health-current) !important;
        background: var(--health-current-bg) !important;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--health-current) 22%, transparent), 0 0 16px var(--health-current-glow) !important;
      }
      .notice[data-health] strong,
      .notice[data-health] a { color: var(--health-current-text) !important; }

      :is(.pipeline-validation-summary,.pipeline-validation-banner,.diagnostics-workspace-status,.servo-program-health-strip,.release-readiness-status,.program-optimizer-panel)[data-health] {
        border-color: var(--health-current) !important;
        background: linear-gradient(180deg, var(--health-current-bg), color-mix(in srgb, var(--panel) 94%, transparent)) !important;
        box-shadow: inset 3px 0 0 var(--health-current), 0 0 18px var(--health-current-glow) !important;
      }

      :is(.pipeline-validation-summary,.pipeline-validation-banner,.diagnostics-workspace-status,.servo-program-health-strip,.release-readiness-status,.program-optimizer-panel)[data-health] > strong,
      :is(.pipeline-validation-summary,.pipeline-validation-banner,.release-readiness-status)[data-health] strong,
      .servo-program-health-strip[data-health] strong,
      .program-optimizer-panel[data-health] .program-optimizer-badge {
        color: var(--health-current-text) !important;
      }

      .diagnostics-workspace-status[data-health],
      .program-optimizer-panel[data-health] .program-optimizer-badge {
        border-color: var(--health-current) !important;
        background: var(--health-current-bg) !important;
        box-shadow: 0 0 12px var(--health-current-glow) !important;
      }

      :is(.release-readiness-result,.optimizer-finding,.sensor-inline-status)[data-health] {
        border-left-color: var(--health-current) !important;
        background: linear-gradient(90deg, var(--health-current-bg), var(--input) 42%) !important;
        box-shadow: inset 3px 0 0 var(--health-current) !important;
      }
      :is(.release-readiness-result,.optimizer-finding,.sensor-inline-status)[data-health] strong,
      :is(.release-readiness-result,.optimizer-finding)[data-health] .optimizer-finding-head span,
      .release-readiness-result[data-health] .release-readiness-result-head span {
        color: var(--health-current-text) !important;
      }

      :is(.pipeline-validation-summary,.release-readiness-status) span[data-health],
      .diagnostics-overview > div[data-health],
      .program-optimizer-metrics > div[data-health] {
        border: 1px solid var(--health-current) !important;
        background: var(--health-current-bg) !important;
        box-shadow: 0 0 11px var(--health-current-glow) !important;
      }
      :is(.pipeline-validation-summary,.release-readiness-status) span[data-health],
      .diagnostics-overview > div[data-health] strong,
      .program-optimizer-metrics > div[data-health] strong {
        color: var(--health-current-text) !important;
      }

      .diagnostics-tab-count[data-health] {
        border: 1px solid var(--health-current) !important;
        background: var(--health-current) !important;
        color: #08100c !important;
        box-shadow: 0 0 12px var(--health-current-glow) !important;
      }

      .map-fault-notice[data-health],
      .startup-error[data-health] {
        border: 1px solid var(--health-current) !important;
        border-left: 5px solid var(--health-current) !important;
        background: color-mix(in srgb, var(--health-current-bg) 82%, var(--panel)) !important;
        color: var(--ink) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 18px var(--health-current-glow) !important;
      }
      .map-fault-notice[data-health] strong,
      .startup-error[data-health] strong { color: var(--health-current-text) !important; }

      .sensor-status-pass { border-left-color: var(--health-good) !important; }
      .sensor-status-fail { border-left-color: var(--health-bad) !important; }
    `;
    document.head.appendChild(style);
    return true;
  }

  function installObserver() {
    if (!document.documentElement || document.documentElement.dataset.healthStatusObserver === "true") return false;
    document.documentElement.dataset.healthStatusObserver = "true";
    const observer = new MutationObserver(scheduleAnnotate);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "data-status", "data-level", "hidden"]
    });
    return true;
  }

  installStyles();
  annotate(document);
  installObserver();

  global.LabelerHealthStatusUiController = Object.freeze({
    installed: true,
    annotate,
    refresh: scheduleAnnotate,
    healthFromValue,
    healthForCount,
    installStyles
  });
})(window);
