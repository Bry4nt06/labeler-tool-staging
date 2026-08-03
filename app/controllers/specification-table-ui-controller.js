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
        position: relative;
        display: table-cell !important;
        width: 1%;
        max-width: 145px;
        min-width: 0;
        padding-top: 31px;
        border-right: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
        white-space: nowrap;
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

      #specs tr.selected-brand-spec > td:last-child::before {
        content: "Selected";
        position: absolute;
        z-index: 2;
        top: 4px;
        right: 4px;
        left: 4px;
        display: block;
        box-sizing: border-box;
        width: auto;
        max-width: calc(100% - 8px);
        padding: 4px 7px;
        border: 1px solid color-mix(in srgb, var(--accent, var(--green)) 62%, var(--line));
        border-radius: 5px;
        background: color-mix(in srgb, var(--accent, var(--green)) 16%, var(--panel-hi));
        color: var(--accent, var(--green));
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        line-height: 1.1;
        text-align: left;
        text-transform: uppercase;
        pointer-events: none;
      }

      #specs tr.selected-brand-spec > td:last-child > button {
        display: inline-block;
        box-sizing: border-box;
        width: calc(50% - 3px);
        max-width: calc(50% - 3px);
        min-width: 0;
        padding: 6px 5px;
        font-size: 10px;
        white-space: nowrap;
      }

      #specs tr.selected-brand-spec > td:last-child > button + button {
        margin-left: 3px;
      }

      @media (max-width: 760px) {
        #specs tr.selected-brand-spec > td:last-child {
          max-width: 112px;
          white-space: normal;
        }

        #specs tr.selected-brand-spec > td:last-child > button {
          display: block;
          width: 100%;
          max-width: 100%;
        }

        #specs tr.selected-brand-spec > td:last-child > button + button {
          margin-top: 4px;
          margin-left: 0;
        }
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
