from pathlib import Path
import json
import re

BUILD = "side-view-grid-degree-reference-v82-20260811-1852"
UPDATED = "Aug 11, 2026 6:52 PM ET"

panel = Path("app/bottle-orientation-panel-integration.js")
text = panel.read_text()
text = text.replace('  const VERSION = 6;', '  const VERSION = 7;', 1)

anchor = '''    const stationText = context.station ? `S${context.station}` : "--";
    const labelOpacity = context.applicationStarted ? .42 : .12;
'''
insert = '''    const stationText = context.station ? `S${context.station}` : "--";
    const labelOpacity = context.applicationStarted ? .42 : .12;

    // Perspective floor/orientation reference selected for the v82 Side View.
    // The ring uses the same bottle-local visual sign as the animated bottle:
    // 0° begins at the right, and degree placement follows machine direction.
    const orientationRingY = 226;
    const orientationRingRx = 62;
    const orientationRingRy = 14;
    function orientationRingPoint(angleDeg, scale = 1) {
      const radians = Number(angleDeg) * Math.PI / 180;
      return {
        x: cx + Math.cos(radians) * orientationRingRx * scale,
        y: orientationRingY + Math.sin(radians) * orientationRingRy * scale
      };
    }
    const orientationMarker = orientationRingPoint(visualPlateAngle, 1);
    const orientationNeedle = orientationRingPoint(visualPlateAngle, .82);
    const currentBottleDegrees = normalizeAngle(plateAngle);
'''
if anchor not in text:
    raise SystemExit("Could not locate side-view orientation constants anchor")
text = text.replace(anchor, insert, 1)

# Make the bottle closer to the selected dark-clear 3D mockup while retaining translucency.
old_gradient = '''        <linearGradient id="bottleSideGlass-${context.source}" x1="0" x2="1">
          <stop offset="0" stop-color="#61717b" stop-opacity=".24"/>
          <stop offset=".08" stop-color="#dbe7ec" stop-opacity=".34"/>
          <stop offset=".22" stop-color="#80919b" stop-opacity=".10"/>
          <stop offset=".47" stop-color="#eef7fb" stop-opacity=".055"/>
          <stop offset=".66" stop-color="#768791" stop-opacity=".09"/>
          <stop offset=".88" stop-color="#e5f0f4" stop-opacity=".26"/>
          <stop offset="1" stop-color="#54636d" stop-opacity=".26"/>
        </linearGradient>'''
new_gradient = '''        <linearGradient id="bottleSideGlass-${context.source}" x1="0" x2="1">
          <stop offset="0" stop-color="#13202a" stop-opacity=".42"/>
          <stop offset=".08" stop-color="#e8f4f8" stop-opacity=".46"/>
          <stop offset=".22" stop-color="#4c6070" stop-opacity=".18"/>
          <stop offset=".50" stop-color="#07121a" stop-opacity=".32"/>
          <stop offset=".78" stop-color="#455968" stop-opacity=".16"/>
          <stop offset=".92" stop-color="#e8f4f8" stop-opacity=".38"/>
          <stop offset="1" stop-color="#111b24" stop-opacity=".40"/>
        </linearGradient>'''
if old_gradient not in text:
    raise SystemExit("Could not locate bottle glass gradient")
text = text.replace(old_gradient, new_gradient, 1)

floor_anchor = '''      <text x="145" y="14" text-anchor="middle" class="view-title">SIDE VIEW</text>
      <text x="277" y="14" text-anchor="end" class="view-readout" opacity=".72">${centerlineFront ? "DATUM FRONT" : "DATUM REAR"}</text>

      <g data-pseudo-3d-glass="true">'''
floor_markup = '''      <text x="145" y="14" text-anchor="middle" class="view-title">SIDE VIEW</text>
      <text x="277" y="14" text-anchor="end" class="view-readout" opacity=".72">${centerlineFront ? "DATUM FRONT" : "DATUM REAR"}</text>

      <g data-side-orientation-floor="true" aria-label="Bottle orientation floor grid and degree reference" opacity=".92">
        <g stroke="#2e5d78" stroke-opacity=".28" stroke-width=".7">
          <line x1="28" y1="244" x2="108" y2="204"/><line x1="54" y1="244" x2="119" y2="204"/>
          <line x1="82" y1="244" x2="129" y2="204"/><line x1="112" y1="244" x2="138" y2="204"/>
          <line x1="145" y1="244" x2="145" y2="204"/>
          <line x1="178" y1="244" x2="152" y2="204"/><line x1="208" y1="244" x2="161" y2="204"/>
          <line x1="236" y1="244" x2="171" y2="204"/><line x1="262" y1="244" x2="182" y2="204"/>
          <line x1="38" y1="241" x2="252" y2="241"/><line x1="55" y1="234" x2="235" y2="234"/>
          <line x1="72" y1="228" x2="218" y2="228"/><line x1="88" y1="222" x2="202" y2="222"/>
          <line x1="101" y1="216" x2="189" y2="216"/><line x1="112" y1="210" x2="178" y2="210"/>
        </g>
        <ellipse cx="${cx}" cy="${orientationRingY}" rx="${orientationRingRx}" ry="${orientationRingRy}" fill="#0c3150" fill-opacity=".08" stroke="#4c9bd0" stroke-opacity=".78" stroke-width="1.2"/>
        <ellipse cx="${cx}" cy="${orientationRingY}" rx="${orientationRingRx-5}" ry="${orientationRingRy-2}" fill="none" stroke="#8bc9ef" stroke-opacity=".15" stroke-width=".8"/>
        ${[0,90,180,270].map((degree) => {
          const angle = machineVisualAngle(degree);
          const tick0 = orientationRingPoint(angle, .94);
          const tick1 = orientationRingPoint(angle, 1.08);
          const label = orientationRingPoint(angle, 1.28);
          return `<line x1="${tick0.x.toFixed(2)}" y1="${tick0.y.toFixed(2)}" x2="${tick1.x.toFixed(2)}" y2="${tick1.y.toFixed(2)}" stroke="#78bde8" stroke-width="1.1"/><text x="${label.x.toFixed(2)}" y="${(label.y + 3).toFixed(2)}" text-anchor="middle" class="degree-label" fill="#8ec9ed">${degree}°</text>`;
        }).join("")}
        <line x1="${cx}" y1="${orientationRingY}" x2="${orientationNeedle.x.toFixed(2)}" y2="${orientationNeedle.y.toFixed(2)}" stroke="#4ca8ff" stroke-opacity=".78" stroke-width="1.2"/>
        <circle cx="${orientationMarker.x.toFixed(2)}" cy="${orientationMarker.y.toFixed(2)}" r="3.2" fill="#4ca8ff" stroke="#d9f2ff" stroke-width="1"/>
        <text x="${orientationMarker.x.toFixed(2)}" y="${(orientationMarker.y - 7).toFixed(2)}" text-anchor="middle" class="view-mini" fill="#9ed8ff">${format(currentBottleDegrees, 0)}°</text>
      </g>

      <g data-pseudo-3d-glass="true">'''
if floor_anchor not in text:
    raise SystemExit("Could not locate Side View title/glass anchor")
text = text.replace(floor_anchor, floor_markup, 1)

flag_anchor = '''    pseudo3dBottleSideViewV81: true,
    curvedWrappedLabelBandV81: true,
    orientationDepthCueV81: true
'''
flag_replace = '''    pseudo3dBottleSideViewV81: true,
    curvedWrappedLabelBandV81: true,
    orientationDepthCueV81: true,
    selectedMockupBottleV82: true,
    sideViewOrientationFloorV82: true,
    sideViewDegreeRingV82: true,
    liveBaseAngleMarkerV82: true
'''
if flag_anchor not in text:
    raise SystemExit("Could not locate v81 feature flags")
text = text.replace(flag_anchor, flag_replace, 1)
panel.write_text(text)

bootstrap = Path("app/bootstrap.js")
text = bootstrap.read_text()
text = re.sub(r'const build = "[^"]+";', f'const build = "{BUILD}";', text, count=1)
text = re.sub(r'const buildUpdatedAt = "[^"]+";', f'const buildUpdatedAt = "{UPDATED}";', text, count=1)
text = text.replace("// Regression lineage:", f"// Regression lineage: {BUILD} •", 1)
bootstrap.write_text(text)

sw = Path("service-worker.js")
text = sw.read_text()
text = re.sub(r'const CACHE_NAME = "[^"]+";', f'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-{BUILD}";', text, count=1)
sw.write_text(text)

update = Path("app/update-manager.js")
text = update.read_text()
text = re.sub(r'const BUILD_ID = "[^"]+";', f'const BUILD_ID = "{BUILD}";', text, count=1)
update.write_text(text)

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text())
manifest["buildId"] = BUILD
manifest["notes"] = (
    "Staging v82 adopts the selected 3D Side View bottle direction and adds a perspective floor grid, "
    "elliptical orientation ring, machine-direction-aware 0/90/180/270 degree references, and a live "
    "bottle-angle marker while preserving v80 Top View world-frame behavior and all servo/wipe geometry."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

test = Path("tests/bottle-orientation-panel.test.js")
text = test.read_text()
old_build = "pseudo-3d-bottle-side-view-v81-20260811-1838"
text = text.replace(old_build.replace("-", "\\-"), BUILD.replace("-", "\\-"))
text = text.replace(f'assert.equal(manifest.buildId, "{old_build}");', f'assert.equal(manifest.buildId, "{BUILD}");')
text = text.replace('console.log("Pseudo-3D bottle side-view v81 regression passed.");', 'console.log("Side-view grid and degree reference v82 regression passed.");')
needle = 'assert.match(source, /orientationDepthCueV81: true/);'
addition = needle + '''\nassert.match(source, /selectedMockupBottleV82: true/);\nassert.match(source, /sideViewOrientationFloorV82: true/);\nassert.match(source, /sideViewDegreeRingV82: true/);\nassert.match(source, /liveBaseAngleMarkerV82: true/);\nassert.match(source, /data-side-orientation-floor=\\"true\\"/);\nassert.match(source, /orientationRingPoint/);\nassert.match(source, /orientationMarker/);\nassert.match(source, /\[0,90,180,270\]\.map/);'''
if needle not in text:
    raise SystemExit("Could not locate v81 test assertion anchor")
text = text.replace(needle, addition, 1)
test.write_text(text)
