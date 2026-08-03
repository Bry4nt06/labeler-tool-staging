"use strict";

(function installSpecificationTableUiController(global) {
  if (global.LabelerSpecificationTableUiController?.installed) return;

  const STYLE_ID = "specificationTableUiStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #specs .spec-section table {
        border-collapse: separate;
        border-spacing: 0;
      }

      #specs .spec-section table thead th {
        position: sticky;
        top: 0;
        z-index: 12;
        background: var(--panel-hi);
        background-clip: padding-box;
        box-shadow: inset 0 -1px 0 var(--line), 0 7px 14px rgba(0, 0, 0, 0.24);
      }

      #specs .spec-section table thead th:first-child {
        box-shadow: inset 1px 0 0 var(--line), inset 0 -1px 0 var(--line), 0 7px 14px rgba(0, 0, 0, 0.24);
      }

      #specs tr.selected-brand-spec > td {
        position: relative;
        background:
          linear-gradient(
            90deg,
            color-mix(in srgb, var(--accent, var(--green)) 22%, var(--panel)) 0%,
            color-mix(in srgb, var(--accent, var(--green)) 12%, var(--panel)) 58%,
            color-mix(in srgb, var(--accent, var(--green)) 7%, var(--panel)) 100%
          );
        background-clip: padding-box;
        border-top: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
        border-bottom: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
      }

      #specs tr.selected-brand-spec > td:first-child {
        border-left: 4px solid var(--accent, var(--green));
        box-shadow: inset 7px 0 14px color-mix(in srgb, var(--accent, var(--green)) 18%, transparent);
      }

      #specs tr.selected-brand-spec > td:last-child {
        border-right: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
      }

      #specs tr.selected-brand-spec input,
      #specs tr.selected-brand-spec select {
        border-color: var(--line);
        background: color-mix(in srgb, var(--input) 88%, transparent);
        box-shadow: none;
      }

      #specs tr.selected-brand-spec input:focus,
      #specs tr.selected-brand-spec select:focus {
        border-color: var(--accent, var(--green));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, var(--green)) 24%, transparent);
      }

      #specs .spec-row-actions {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center;
        justify-content: flex-start;
        gap: 5px;
        width: auto;
        max-width: 100%;
        min-width: 0;
        white-space: nowrap;
      }

      #specs tr.selected-brand-spec > td:last-child::before {
        content: "Selected";
        display: inline-flex;
        flex: 0 1 auto;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 0;
        max-width: 58px;
        padding: 3px 5px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--accent, var(--green)) 62%, var(--line));
        border-radius: 5px;
        background: color-mix(in srgb, var(--accent, var(--green)) 16%, var(--panel-hi));
        color: var(--accent, var(--green));
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.06em;
        line-height: 1;
        text-overflow: ellipsis;
        text-transform: uppercase;
        white-space: nowrap;
        pointer-events: none;
      }

      #specs .spec-row-actions > .spec-icon-button {
        display: inline-flex;
        flex: 0 0 32px;
        align-items: center;
        justify-content: center;
        width: 32px;
        max-width: 32px;
        min-width: 32px;
        height: 30px;
        min-height: 30px;
        margin: 0;
        padding: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();

  global.LabelerSpecificationTableUiController = Object.freeze({
    installed: true,
    installStyles
  });
})(window);
