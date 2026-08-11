"use strict";

(function installCompactBuildParametersIntegration(global) {
  const STYLE_ID = "servoforge-compact-build-parameters-v70";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .build-grid {
        grid-template-columns: minmax(500px, 570px) minmax(560px, 1fr);
        gap: 12px;
        padding: 12px;
      }

      .build-grid > .build-card:first-child {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-content: start;
        column-gap: 10px;
        row-gap: 5px;
      }

      .build-grid > .build-card:first-child > h2,
      .build-grid > .build-card:first-child > h3,
      .build-grid > .build-card:first-child > h4,
      .build-grid > .build-card:first-child > .application-filter-note,
      .build-grid > .build-card:first-child > .zone-site-selection {
        grid-column: 1 / -1;
      }

      .build-grid > .build-card:first-child > h2 {
        margin: 0 0 2px;
      }

      .build-grid > .build-card:first-child > h3 {
        margin: 7px 0 1px;
        padding-top: 5px;
        border-top: 1px solid var(--line);
        font-size: 12px;
      }

      .build-grid > .build-card:first-child > h4 {
        margin: 5px 0 0;
        font-size: 11px;
      }

      .build-grid > .build-card:first-child > .application-filter-note {
        margin: 0 0 2px;
        padding: 5px 7px;
        font-size: 10px;
        line-height: 1.25;
      }

      .build-grid > .build-card:first-child .zone-site-selection {
        gap: 7px;
      }

      .build-grid > .build-card:first-child label {
        min-width: 0;
        gap: 2px;
        margin-bottom: 0;
        font-size: 10.5px;
        line-height: 1.15;
      }

      .build-grid > .build-card:first-child input,
      .build-grid > .build-card:first-child select {
        width: 100%;
        min-width: 0;
        height: 30px;
        min-height: 30px;
        padding: 3px 7px;
        font-size: 12px;
      }

      @media (max-width: 1180px) {
        .build-grid {
          grid-template-columns: minmax(440px, 520px) minmax(500px, 1fr);
        }
      }

      @media (max-width: 1050px) {
        .build-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 680px) {
        .build-grid > .build-card:first-child {
          grid-template-columns: 1fr;
        }

        .build-grid > .build-card:first-child > * {
          grid-column: 1 / -1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();

  global.LabelerCompactBuildParameters = Object.freeze({
    version: 1,
    installStyles
  });
})(window);
