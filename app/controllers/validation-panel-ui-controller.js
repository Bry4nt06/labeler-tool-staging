"use strict";

(function installValidationPanelUiController(global) {
  if (global.LabelerValidationPanelUiController?.installed) return;

  const STYLE_ID = "servoforgeValidationPanelUiStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .panel.validation {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: clip !important;
        overflow-y: auto !important;
        contain: inline-size;
      }

      .panel.validation > *,
      .validation-details,
      #validationList {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: clip;
      }

      .validation-details,
      #validationList {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
      }

      .validation-details > *,
      #validationList > *,
      .panel.validation .pipeline-validation-summary,
      .panel.validation .pipeline-validation-banner,
      .panel.validation .notice {
        box-sizing: border-box;
        justify-self: stretch;
        width: auto !important;
        max-width: 100%;
        min-width: 0;
        margin-right: 0 !important;
        margin-left: 0 !important;
      }

      .validation-head {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        align-items: stretch !important;
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }

      .validation-head-actions {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        max-width: 100%;
        min-width: 0;
        white-space: normal !important;
      }

      .validation-head-actions .compact-builder-button {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .pipeline-validation-summary {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        align-items: stretch !important;
        overflow: hidden;
      }

      .pipeline-validation-summary > strong,
      .pipeline-validation-summary > span {
        box-sizing: border-box;
        display: block;
        width: auto !important;
        max-width: 100%;
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .pipeline-validation-summary > strong {
        padding-bottom: 3px;
      }

      .pipeline-validation-summary > span {
        padding: 6px 8px !important;
        text-align: left !important;
        white-space: normal !important;
        line-height: 1.2;
      }

      .pipeline-validation-banner,
      .panel.validation .notice,
      .panel.validation strong,
      .panel.validation span,
      .panel.validation small {
        max-width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      @media (max-width: 430px) {
        .validation-head-actions {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  installStyles();

  global.LabelerValidationPanelUiController = Object.freeze({
    installed: true,
    installStyles
  });
})(window);
