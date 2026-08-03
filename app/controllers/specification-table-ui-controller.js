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

      #specs tr.selected-brand-spec > td:last-child {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-content: center;
        gap: 5px;
        min-width: 150px;
        white-space: normal;
      }

      #specs tr.selected-brand-spec > td:last-child::before {
        content: "Selected";
        grid-column: 1 / -1;
        display: block;
        width: 100%;
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
      }

      #specs tr.selected-brand-spec > td:last-child > button {
        width: 100%;
        min-width: 0;
      }

      @media (max-width: 760px) {
        #specs tr.selected-brand-spec > td:last-child {
          grid-template-columns: minmax(0, 1fr);
          min-width: 110px;
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
