"use strict";

(function installCommunitySpecFilter(global) {
  if (global.ServoForgeCommunitySpecFilter?.installed) return;

  const BUILD = "community-spec-filter-v112-20260813-2008";
  const specById = new Map();
  let observer = null;

  const clean = (value) => String(value ?? "").trim().slice(0, 80);
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function infoFor(item) {
    const summary = item?.validationSummary || {};
    const bottle = clean(item?.bottleSpecNumber || item?.bottle_spec_number || summary.communityBottleSpecNumber);
    const label = clean(item?.brandSpecNumber || item?.brand_spec_number || summary.communityBrandSpecNumber);
    return {
      type: String(item?.type || ""),
      bottle,
      label,
      values: [...new Set([bottle, label].filter(Boolean))]
    };
  }

  function suffix(info) {
    if (!info || info.type === "map") return "";
    if (info.type === "bottle" && info.bottle) return ` • Spec # ${info.bottle}`;
    if (info.type === "brand" && info.label) return ` • Spec # ${info.label}`;
    if (info.type === "bundle") {
      if (info.bottle && info.label && info.bottle !== info.label) return ` • Bottle Spec # ${info.bottle} • Label Spec # ${info.label}`;
      const only = info.bottle || info.label;
      if (only) return ` • Spec # ${only}`;
    }
    return "";
  }

  function ensureFilter() {
    const toolbar = document.querySelector('[data-community-pane="browse"] .sf-community-toolbar');
    const typeFilter = document.getElementById("communityTypeFilter");
    if (!toolbar || !typeFilter) return null;

    let select = document.getElementById("communitySpecFilter");
    if (!select) {
      select = document.createElement("select");
      select.id = "communitySpecFilter";
      select.setAttribute("aria-label", "Filter by Spec number");
      select.innerHTML = '<option value="">Spec #: All</option>';
      select.addEventListener("change", apply);
      toolbar.insertBefore(select, typeFilter);
    }

    const site = document.getElementById("communitySiteFilter");
    if (site && select.previousElementSibling !== site) site.after(select);
    return select;
  }

  function decorate() {
    document.querySelectorAll("#communityBrowseList .sf-community-card[data-community-package-id]").forEach((card) => {
      const id = String(card.dataset.communityPackageId || "");
      const title = card.querySelector(".sf-community-card-head h3, h3");
      if (!title) return;
      if (!title.dataset.specBaseTitle) title.dataset.specBaseTitle = String(title.textContent || "").trim();
      title.textContent = `${title.dataset.specBaseTitle}${suffix(specById.get(id))}`;
    });
  }

  function apply() {
    const selected = clean(document.getElementById("communitySpecFilter")?.value);
    document.querySelectorAll("#communityBrowseList .sf-community-card[data-community-package-id]").forEach((card) => {
      const info = specById.get(String(card.dataset.communityPackageId || ""));
      const matches = !selected || Boolean(info?.values?.includes(selected));
      card.dataset.communitySpecHidden = matches ? "false" : "true";
    });
    decorate();
  }

  async function refresh() {
    const select = ensureFilter();
    const library = global.LabelerCommunityLibrary;
    if (!select || !library?.api) return false;
    const current = clean(select.value);
    try {
      const data = await library.api("browse", { type: "", search: "" });
      const values = new Set();
      specById.clear();
      for (const item of Array.isArray(data?.packages) ? data.packages : []) {
        const info = infoFor(item);
        specById.set(String(item?.id || ""), info);
        info.values.forEach((value) => values.add(value));
      }
      const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      select.innerHTML = `<option value="">Spec #: All</option>${sorted.map((value) => `<option value="${escapeHtml(value)}">Spec # ${escapeHtml(value)}</option>`).join("")}`;
      if (current && values.has(current)) select.value = current;
      apply();
      return true;
    } catch (error) {
      console.warn("[ServoForge Community] Spec filter refresh failed", error);
      return false;
    }
  }

  function bind() {
    if (!document.getElementById("servoforgeCommunitySpecFilterStyles")) {
      const style = document.createElement("style");
      style.id = "servoforgeCommunitySpecFilterStyles";
      style.textContent = '.sf-community-card[data-community-spec-hidden="true"]{display:none!important}';
      document.head.appendChild(style);
    }

    let attempts = 0;
    const settle = () => {
      attempts += 1;
      const list = document.getElementById("communityBrowseList");
      if (!list || !ensureFilter()) {
        if (attempts < 240) setTimeout(settle, 50);
        return;
      }
      if (!observer) {
        observer = new MutationObserver(() => apply());
        observer.observe(list, { childList: true, subtree: true });
      }
      void refresh();
    };
    settle();

    document.addEventListener("click", (event) => {
      if (event.target?.closest?.('[data-community-tab="browse"], #communityRefresh')) setTimeout(() => void refresh(), 100);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCommunitySpecFilter = Object.freeze({ installed: true, build: BUILD, refresh, apply });
})(typeof window !== "undefined" ? window : globalThis);
