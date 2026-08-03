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
        --bg: #0e1013;
        --bg-a: #08090b;
        --bg-b: #151316;
        --bg-glow: rgba(132, 49, 57, 0.09);
        --panel: #17191d;
        --panel-hi: #1f2227;
        --line: #383b42;
        --input: #0c0e11;
        --ink: #e8e4e5;
        --muted: #9d9295;
        --green: #a5535a;
        --green-dark: #64343a;
        --blue: #9c7377;
        --amber: #a98258;
        --red: #b85f66;
        --fill: #2a1c20;
        --btn-a: #583137;
        --btn-b: #352126;
        --btn-hover-a: #6d3d44;
        --btn-hover-b: #43282e;
        --panel-accent: rgba(165, 83, 90, 0.2);
        --accent: #a5535a;
        --map-shell: #090b0d;
        --map-surface: #131518;
        --map-ring: #514248;
        --map-head-fill: #21191d;
        --map-head-stroke: #a5535a;
        --map-label: #c7babc;
        --map-text: #eee9ea;
        --map-muted: #9f9295;
        --map-readout: #1b171a;
      }

      body[data-theme="red-black"] .panel,
      body[data-theme="red-black"] .map-area,
      body[data-theme="red-black"] .table-wrap {
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(122, 42, 50, 0.045);
      }

      body[data-theme="dark-gold"] {
        --bg: #11120f;
        --bg-a: #090a08;
        --bg-b: #171710;
        --bg-glow: rgba(150, 121, 50, 0.075);
        --panel: #191a17;
        --panel-hi: #22231e;
        --line: #3d3d35;
        --input: #0d0e0c;
        --ink: #e8e5d8;
        --muted: #9e9985;
        --green: #a38a4d;
        --green-dark: #62532f;
        --blue: #978b67;
        --amber: #b69a55;
        --red: #a7665c;
        --fill: #29261a;
        --btn-a: #574a2a;
        --btn-b: #342f20;
        --btn-hover-a: #6a5a32;
        --btn-hover-b: #423a25;
        --panel-accent: rgba(163, 138, 77, 0.18);
        --accent: #a38a4d;
        --map-shell: #0b0c0a;
        --map-surface: #151612;
        --map-ring: #514c3a;
        --map-head-fill: #211f17;
        --map-head-stroke: #a38a4d;
        --map-label: #c7c1aa;
        --map-text: #ece8da;
        --map-muted: #9f9985;
        --map-readout: #1c1b15;
      }

      body[data-theme="burnt-orange"] {
        --bg: #11100f;
        --bg-a: #090908;
        --bg-b: #18140f;
        --bg-glow: rgba(158, 82, 39, 0.08);
        --panel: #1a1917;
        --panel-hi: #24221f;
        --line: #413b36;
        --input: #0e0d0c;
        --ink: #ebe4de;
        --muted: #a0968f;
        --green: #a7653e;
        --green-dark: #694128;
        --blue: #9f7d69;
        --amber: #af8756;
        --red: #ae6257;
        --fill: #2c211a;
        --btn-a: #5d3b28;
        --btn-b: #38271d;
        --btn-hover-a: #714932;
        --btn-hover-b: #463025;
        --panel-accent: rgba(167, 101, 62, 0.19);
        --accent: #a7653e;
        --map-shell: #0b0b0a;
        --map-surface: #171513;
        --map-ring: #55483f;
        --map-head-fill: #251d18;
        --map-head-stroke: #a7653e;
        --map-label: #cbbeb5;
        --map-text: #efe8e2;
        --map-muted: #a29790;
        --map-readout: #1e1916;
      }

      body[data-theme="forge-gradient"] {
        --bg: #101215;
        --bg-a: #0a0b0e;
        --bg-b: #151619;
        --bg-glow: rgba(85, 112, 105, 0.07);
        --panel: #191b1f;
        --panel-hi: #22252a;
        --line: #3a3f45;
        --input: #0d0f12;
        --ink: #e7ebea;
        --muted: #969f9e;
        --green: #6e9a87;
        --green-dark: #456657;
        --blue: #718d9b;
        --amber: #9f8658;
        --red: #9c6269;
        --fill: #1e2b27;
        --btn-a: #3d5d52;
        --btn-b: #354554;
        --btn-hover-a: #496e61;
        --btn-hover-b: #405366;
        --panel-accent: rgba(113, 141, 155, 0.18);
        --accent: #6e9a87;
        --map-shell: #0a0c0e;
        --map-surface: #15191d;
        --map-ring: #46545b;
        --map-head-fill: #182321;
        --map-head-stroke: #718d9b;
        --map-label: #c4cdcc;
        --map-text: #ebefee;
        --map-muted: #98a2a2;
        --map-readout: #192023;
        background:
          radial-gradient(circle at 12% 4%, rgba(91, 67, 116, 0.09), transparent 34%),
          radial-gradient(circle at 88% 11%, rgba(145, 79, 48, 0.075), transparent 36%),
          radial-gradient(circle at 52% 94%, rgba(62, 119, 96, 0.07), transparent 43%),
          linear-gradient(135deg, #0d0d12 0%, #0d1318 43%, #111815 71%, #19120e 100%);
        background-attachment: fixed;
      }

      body[data-theme="forge-gradient"] .panel,
      body[data-theme="forge-gradient"] .map-area,
      body[data-theme="forge-gradient"] .table-wrap {
        background:
          linear-gradient(145deg, rgba(113, 141, 155, 0.045), transparent 34%),
          linear-gradient(225deg, rgba(145, 79, 48, 0.035), transparent 42%),
          linear-gradient(180deg, rgba(34, 37, 42, 0.98), rgba(23, 25, 29, 0.99));
        box-shadow: 0 20px 52px rgba(0, 0, 0, 0.5), 0 0 26px rgba(78, 110, 96, 0.035);
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
