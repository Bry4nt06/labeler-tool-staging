"use strict";

(function installServoForgeCommunityCart(global) {
  if (global.LabelerCommunityCartIntegration?.installed) return;

  const BUILD_MARKER = "community-cart-v127-20260820-0940";
  const cart = new Map();
  let cartOpen = false;
  let busy = false;
  let statusMessage = "";
  let dialogObserver = null;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function communityApi() {
    const community = global.LabelerCommunityLibrary;
    if (!community?.installed || typeof community.api !== "function" || typeof community.importPackage !== "function") {
      throw new Error("Community Library is unavailable.");
    }
    return community;
  }

  function ensureStyles() {
    if (document.getElementById("servoforgeCommunityCartStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeCommunityCartStyles";
    style.textContent = `
      .sf-community-dialog{overflow:visible}
      .sf-community-shell{overflow:hidden;border-radius:inherit}
      .sf-community-dialog .sf-community-close{margin-left:0}
      .sf-community-cart-toggle{display:inline-flex;align-items:center;gap:7px;margin-left:auto;white-space:nowrap}
      .sf-community-cart-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border:1px solid var(--line);border-radius:999px;background:var(--input);font-size:11px;font-weight:700}
      .sf-community-cart{position:fixed;top:76px;right:18px;z-index:8;width:min(330px,calc(100vw - 36px));max-height:calc(100vh - 96px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);box-shadow:0 22px 60px rgba(0,0,0,.52)}
      .sf-community-cart[hidden]{display:none!important}
      .sf-community-cart-head{display:flex;align-items:center;gap:8px;padding:12px 13px;border-bottom:1px solid var(--line);background:var(--panel-hi)}
      .sf-community-cart-head h3{margin:0;font-size:15px}.sf-community-cart-head .sf-community-cart-count{margin-left:2px}
      .sf-community-cart-dismiss{margin-left:auto;padding:4px 8px;background:transparent;box-shadow:none}
      .sf-community-cart-list{display:grid;gap:8px;min-height:0;padding:10px;overflow:auto}
      .sf-community-cart-empty{padding:18px 10px;text-align:center;color:var(--muted);font-size:12px}
      .sf-community-cart-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--bg-soft)}
      .sf-community-cart-item strong{display:block;font-size:12px;line-height:1.35}.sf-community-cart-item .sf-community-meta{margin-top:3px;font-size:11px}
      .sf-community-cart-remove{padding:4px 7px;font-size:11px;background:transparent;box-shadow:none}
      .sf-community-cart-footer{display:grid;gap:8px;padding:10px;border-top:1px solid var(--line);background:var(--panel-hi)}
      .sf-community-cart-footer-actions{display:grid;grid-template-columns:auto 1fr;gap:8px}.sf-community-cart-footer-actions button{padding:8px}
      .sf-community-cart-import-all{font-weight:700}.sf-community-cart-status{min-height:16px;font-size:11px;line-height:1.35;color:var(--muted)}
      .sf-community-cart-note{font-size:10px;line-height:1.35;color:var(--muted)}
      @media(min-width:1420px){.sf-community-dialog.sf-community-cart-open{margin-left:auto;margin-right:366px}}
      @media(min-width:900px) and (max-width:1419px){.sf-community-dialog.sf-community-cart-open{width:calc(100vw - 378px);margin-left:12px;margin-right:auto}}
      @media(max-width:720px){.sf-community-cart-toggle{padding:7px}.sf-community-cart{top:64px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 78px)}}
    `;
    document.head.appendChild(style);
  }

  function readCard(card) {
    const heading = String(card?.querySelector("h3")?.textContent || "Community package").trim();
    const split = heading.split(" · ");
    const name = split.length > 1 ? split.slice(1).join(" · ").trim() : heading;
    const meta = String(card?.querySelector(".sf-community-card-head .sf-community-meta")?.textContent || "").trim();
    return {
      id: String(card?.dataset.communityPackageId || ""),
      heading,
      name,
      meta
    };
  }

  function cartItemHtml(item) {
    return `<div class="sf-community-cart-item" data-community-cart-item="${esc(item.id)}"><div><strong>${esc(item.heading)}</strong>${item.meta ? `<div class="sf-community-meta">${esc(item.meta)}</div>` : ""}</div><button type="button" class="sf-community-cart-remove" data-community-cart-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)} from cart">Remove</button></div>`;
  }

  function ensureControls() {
    const dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog) return null;
    ensureStyles();

    const head = dialog.querySelector(".sf-community-head");
    const close = head?.querySelector("[data-community-close]");
    let toggle = document.getElementById("communityCartToggle");
    if (head && !toggle) {
      toggle = document.createElement("button");
      toggle.id = "communityCartToggle";
      toggle.type = "button";
      toggle.className = "sf-community-cart-toggle";
      toggle.setAttribute("aria-controls", "communityImportCart");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = `Cart <span id="communityCartCount" class="sf-community-cart-count">0</span>`;
      head.insertBefore(toggle, close || null);
    }

    let panel = document.getElementById("communityImportCart");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "communityImportCart";
      panel.className = "sf-community-cart";
      panel.hidden = true;
      panel.setAttribute("aria-label", "Community import cart");
      panel.innerHTML = `<div class="sf-community-cart-head"><h3>Import Cart</h3><span class="sf-community-cart-count" data-community-cart-count>0</span><button type="button" class="sf-community-cart-dismiss" data-community-cart-dismiss aria-label="Hide import cart">×</button></div><div id="communityCartList" class="sf-community-cart-list"></div><div class="sf-community-cart-footer"><div class="sf-community-cart-note">Batch import uses Add as New. Existing local records are preserved; matching names receive a unique Community name.</div><div id="communityCartStatus" class="sf-community-cart-status" aria-live="polite"></div><div class="sf-community-cart-footer-actions"><button type="button" class="secondary-button" data-community-cart-clear>Clear</button><button type="button" class="sf-community-cart-import-all" data-community-cart-import-all>Import All (0)</button></div></div>`;
      dialog.appendChild(panel);
    }

    decorateCards();
    return { dialog, toggle, panel };
  }

  function decorateCards() {
    document.querySelectorAll("#communityBrowseList .sf-community-card[data-community-package-id]").forEach((card) => {
      const actions = card.querySelector(".sf-community-card-actions");
      if (!actions || actions.querySelector("[data-community-cart-add]")) return;
      const item = readCard(card);
      if (!item.id) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sf-community-cart-add";
      button.dataset.communityCartAdd = item.id;
      actions.appendChild(button);
    });
    syncAddButtons();
  }

  function syncAddButtons() {
    document.querySelectorAll("[data-community-cart-add]").forEach((button) => {
      const selected = cart.has(String(button.dataset.communityCartAdd || ""));
      button.disabled = selected || busy;
      button.textContent = selected ? "✓ In Cart" : "Add to Cart";
      button.classList.toggle("secondary-button", selected);
    });
  }

  function renderCart() {
    const controls = ensureControls();
    if (!controls) return;
    const { dialog, toggle, panel } = controls;
    const list = document.getElementById("communityCartList");
    const headerCount = document.getElementById("communityCartCount");
    const panelCount = panel.querySelector("[data-community-cart-count]");
    const importAll = panel.querySelector("[data-community-cart-import-all]");
    const clear = panel.querySelector("[data-community-cart-clear]");
    const status = document.getElementById("communityCartStatus");
    const count = cart.size;

    panel.hidden = !cartOpen;
    dialog.classList.toggle("sf-community-cart-open", cartOpen);
    toggle.setAttribute("aria-expanded", cartOpen ? "true" : "false");
    if (headerCount) headerCount.textContent = String(count);
    if (panelCount) panelCount.textContent = String(count);
    if (list) list.innerHTML = count ? [...cart.values()].map(cartItemHtml).join("") : `<div class="sf-community-cart-empty">Your cart is empty. Add Community packages while you browse.</div>`;
    if (importAll) {
      importAll.textContent = busy ? "Importing…" : `Import All (${count})`;
      importAll.disabled = busy || count === 0;
    }
    if (clear) clear.disabled = busy || count === 0;
    if (status) status.textContent = statusMessage;
    syncAddButtons();
  }

  function addToCart(button) {
    if (busy) return;
    const card = button?.closest?.(".sf-community-card[data-community-package-id]");
    const item = readCard(card);
    if (!item.id) return;
    cart.set(item.id, item);
    cartOpen = true;
    statusMessage = `${item.name} added to the import cart.`;
    renderCart();
  }

  function removeFromCart(id) {
    if (busy) return;
    cart.delete(String(id || ""));
    statusMessage = cart.size ? `${cart.size} package${cart.size === 1 ? "" : "s"} ready to import.` : "Cart cleared.";
    renderCart();
  }

  function clearCart() {
    if (busy) return;
    cart.clear();
    statusMessage = "Cart cleared.";
    renderCart();
  }

  async function importAll() {
    if (busy || !cart.size) return;
    let community;
    try { community = communityApi(); }
    catch (error) { alert(error.message); return; }

    busy = true;
    cartOpen = true;
    statusMessage = "Preparing batch import…";
    renderCart();

    const pending = [...cart.entries()];
    const imported = [];
    const failures = [];
    for (let index = 0; index < pending.length; index += 1) {
      const [id, item] = pending[index];
      statusMessage = `Importing ${index + 1} of ${pending.length}: ${item.name}`;
      renderCart();
      try {
        const data = await community.api("download", { packageId: id });
        if (!data?.package?.configPayload) throw new Error("Package configuration is unavailable.");
        community.importPackage(data.package, "add");
        imported.push({ id, name: item.name });
      } catch (error) {
        failures.push({ id, name: item.name, message: String(error?.message || error) });
      }
    }

    imported.forEach((item) => cart.delete(String(item.id)));
    busy = false;
    statusMessage = `${imported.length} imported${failures.length ? ` • ${failures.length} failed and kept in cart` : ""}.`;
    renderCart();
    try { await community.loadBrowse?.(); } catch { }

    if (failures.length) {
      alert(`Community batch import finished. ${imported.length} imported; ${failures.length} failed. Failed packages remain in the cart.\n\n${failures.map((item) => `${item.name}: ${item.message}`).join("\n")}`);
    } else {
      alert(`Community batch import complete. ${imported.length} package${imported.length === 1 ? "" : "s"} imported as new local configuration.`);
    }
  }

  function handleClick(event) {
    const dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog || !dialog.contains(event.target)) return;

    if (event.target.closest?.("#communityCartToggle")) {
      cartOpen = !cartOpen;
      renderCart();
      return;
    }
    if (event.target.closest?.("[data-community-cart-dismiss]")) {
      cartOpen = false;
      renderCart();
      return;
    }
    const add = event.target.closest?.("[data-community-cart-add]");
    if (add) {
      addToCart(add);
      return;
    }
    const remove = event.target.closest?.("[data-community-cart-remove]");
    if (remove) {
      removeFromCart(remove.dataset.communityCartRemove);
      return;
    }
    if (event.target.closest?.("[data-community-cart-clear]")) {
      clearCart();
      return;
    }
    if (event.target.closest?.("[data-community-cart-import-all]")) {
      importAll();
    }
  }

  function install() {
    const controls = ensureControls();
    if (!controls) return false;
    document.addEventListener("click", handleClick);
    dialogObserver = new MutationObserver(() => {
      decorateCards();
      if (!document.getElementById("communityImportCart")) ensureControls();
    });
    dialogObserver.observe(controls.dialog, { childList: true, subtree: true });
    renderCart();
    return true;
  }

  function start() {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (!document.getElementById("servoforgeCommunityDialog")) return;
      observer.disconnect();
      install();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  global.LabelerCommunityCartIntegration = Object.freeze({
    installed: true,
    build: BUILD_MARKER,
    get count() { return cart.size; },
    render: renderCart,
    clear: clearCart,
    importAll
  });
})(typeof window !== "undefined" ? window : globalThis);
