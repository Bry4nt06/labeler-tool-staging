"use strict";

(function installThemePresetsController(global) {
  if (global.LabelerThemePresetsController?.installed) return;

  const STYLE_ID = "servoforgeExpandedThemeStyles";
  const presets = Object.freeze([
    { value: "red-black", label: "Red & black" },
    { value: "dark-gold", label: "Dark gold" },
    { value: "burnt-orange", label: "Burnt orange" },
    { value: "forge-gradient", label: "Forge gradient" }
  ]);

  function installOptions() {
    const select = document.querySelector("#themePreset");
    if (!select) return false;
    const lightOption = [...select.options].find((option) => option.value === "light") || null;
    presets.forEach(({ value, label }) => {
      if ([...select.options].some((option) => option.value === value)) return;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.insertBefore(option, lightOption);
    });
    return true;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body[data-theme="red-black"] {
        --bg: #09090b;
        --bg-a: #030304;
        --bg-b: #1b080b;
        --bg-glow: rgba(222, 52, 62, 0.2);
        --panel: #151113;
        --panel-hi: #211619;
        --line: #4b272d;
        --input: #090708;
        --ink: #f6eded;
        --muted: #b89da1;
        --green: #ef4f59;
        --green-dark: #8e1f28;
        --blue: #e77b82;
        --amber: #f2ad65;
        --fill: #351116;
        --btn-a: #b52d38;
        --btn-b: #67161e;
        --btn-hover-a: #da3e49;
        --btn-hover-b: #8b202a;
        --panel-accent: rgba(239, 79, 89, 0.45);
        --accent: #ef4f59;
        --map-shell: #070607;
        --map-surface: #130d0f;
        --map-ring: #793039;
        --map-head-fill: #251015;
        --map-head-stroke: #ef4f59;
        --map-label: #e6c6ca;
        --map-text: #fff4f5;
        --map-muted: #bd9ba0;
        --map-readout: #1f1013;
      }

      body[data-theme="red-black"] .panel,
      body[data-theme="red-black"] .map-area,
      body[data-theme="red-black"] .table-wrap {
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.58), 0 0 28px rgba(166, 29, 40, 0.12);
      }

      body[data-theme="dark-gold"] {
        --bg: #171407;
        --bg-a: #090803;
        --bg-b: #282008;
        --bg-glow: rgba(222, 177, 52, 0.18);
        --panel: #24200f;
        --panel-hi: #312a12;
        --line: #594b1e;
        --input: #121004;
        --ink: #fff6cf;
        --muted: #c1b27c;
        --green: #ddb43c;
        --green-dark: #8e6c11;
        --blue: #e6c86a;
        --amber: #ffd45b;
        --red: #e36e56;
        --fill: #3a3110;
        --btn-a: #a77c13;
        --btn-b: #6e4f08;
        --btn-hover-a: #c99a22;
        --btn-hover-b: #85620e;
        --panel-accent: rgba(221, 180, 60, 0.4);
        --accent: #ddb43c;
        --map-shell: #100e04;
        --map-surface: #201b0a;
        --map-ring: #746126;
        --map-head-fill: #32280c;
        --map-head-stroke: #e6bd43;
        --map-label: #e8ddb0;
        --map-text: #fff9dc;
        --map-muted: #c4b780;
        --map-readout: #2b240d;
      }

      body[data-theme="burnt-orange"] {
        --bg: #17100b;
        --bg-a: #090604;
        --bg-b: #2d1609;
        --bg-glow: rgba(230, 105, 35, 0.2);
        --panel: #25170f;
        --panel-hi: #342016;
        --line: #60402d;
        --input: #100b08;
        --ink: #fff0e4;
        --muted: #c4a08a;
        --green: #e97632;
        --green-dark: #9c3f13;
        --blue: #f0a16c;
        --amber: #f4bd5c;
        --red: #e75f50;
        --fill: #45200e;
        --btn-a: #bd541c;
        --btn-b: #7d3010;
        --btn-hover-a: #df6a29;
        --btn-hover-b: #9b4117;
        --panel-accent: rgba(233, 118, 50, 0.42);
        --accent: #e97632;
        --map-shell: #0d0907;
        --map-surface: #20130d;
        --map-ring: #7d4930;
        --map-head-fill: #39190c;
        --map-head-stroke: #f08a4f;
        --map-label: #edd0bd;
        --map-text: #fff5ee;
        --map-muted: #c9a28c;
        --map-readout: #2b170d;
      }

      body[data-theme="forge-gradient"] {
        --bg: #101526;
        --bg-a: #160b28;
        --bg-b: #321407;
        --bg-glow: rgba(53, 212, 172, 0.19);
        --panel: #171a29;
        --panel-hi: #22283a;
        --line: #3c4d5c;
        --input: #0c101b;
        --ink: #f0f8f5;
        --muted: #a7b9b9;
        --green: #4ee0a0;
        --green-dark: #1d8c63;
        --blue: #68c7ef;
        --amber: #f0b84f;
        --red: #ee6f78;
        --fill: #17392e;
        --btn-a: #308d74;
        --btn-b: #285285;
        --btn-hover-a: #42b88d;
        --btn-hover-b: #396ba6;
        --panel-accent: rgba(104, 199, 239, 0.4);
        --accent: #4ee0a0;
        --map-shell: #0a0f1a;
        --map-surface: #141e2b;
        --map-ring: #4f7283;
        --map-head-fill: #152f35;
        --map-head-stroke: #68c7ef;
        --map-label: #d5e5e7;
        --map-text: #f5fffc;
        --map-muted: #a8bdc2;
        --map-readout: #172735;
        background:
          radial-gradient(circle at 10% 5%, rgba(138, 72, 214, 0.3), transparent 34%),
          radial-gradient(circle at 88% 13%, rgba(238, 113, 44, 0.25), transparent 35%),
          radial-gradient(circle at 52% 92%, rgba(55, 211, 156, 0.2), transparent 42%),
          linear-gradient(135deg, #130a22 0%, #081c2b 42%, #123326 70%, #321407 100%);
        background-attachment: fixed;
      }

      body[data-theme="forge-gradient"] .panel,
      body[data-theme="forge-gradient"] .map-area,
      body[data-theme="forge-gradient"] .table-wrap {
        background:
          linear-gradient(145deg, rgba(104, 199, 239, 0.12), transparent 34%),
          linear-gradient(225deg, rgba(238, 113, 44, 0.1), transparent 42%),
          linear-gradient(180deg, rgba(34, 40, 58, 0.96), rgba(17, 21, 34, 0.98));
        box-shadow: 0 20px 52px rgba(2, 5, 15, 0.52), 0 0 30px rgba(78, 224, 160, 0.08);
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  installOptions();
  installStyles();

  global.LabelerThemePresetsController = Object.freeze({
    installed: true,
    presets,
    installOptions,
    installStyles
  });
})(window);
