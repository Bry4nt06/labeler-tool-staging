from pathlib import Path
import json
import re

BUILD = "three-quarter-perspective-bottle-v83-20260811-1908"
UPDATED = "Aug 11, 2026 7:08 PM ET"

panel = Path("app/bottle-orientation-panel-integration.js")
text = panel.read_text()
text = text.replace('  const VERSION = 7;', '  const VERSION = 8;', 1)

# Compact the bottle slightly so the perspective floor remains visible below it.
text = text.replace('    const neckTop = 27;\n    const neckBase = 72;\n    const shoulderBottom = 101;\n    const bodyBottom = 226;',
'''    const neckTop = 28;
    const neckBase = 70;
    const shoulderBottom = 96;
    const bodyBottom = 207;''', 1)

# Make the silhouette asymmetrical enough to read as a 3/4 camera view while preserving geometry scale.
old_path = '''    const bodyPath = [
      `M ${cx-neckHalf} ${neckTop}`,
      `L ${cx-neckHalf} ${neckBase-7}`,
      `C ${cx-neckHalf} ${neckBase+3} ${cx-bodyHalf*0.55} ${shoulderBottom-19} ${cx-bodyHalf*0.86} ${shoulderBottom-8}`,
      `C ${cx-bodyHalf*0.96} ${shoulderBottom-4} ${cx-bodyHalf} ${shoulderBottom+1} ${cx-bodyHalf} ${shoulderBottom+9}`,
      `L ${cx-bodyHalf} ${bodyBottom-15}`,
      `C ${cx-bodyHalf} ${bodyBottom-5} ${cx-bodyHalf-8} ${bodyBottom} ${cx-bodyHalf-19} ${bodyBottom}`,
      `L ${cx+bodyHalf-19} ${bodyBottom}`,
      `C ${cx+bodyHalf-8} ${bodyBottom} ${cx+bodyHalf} ${bodyBottom-5} ${cx+bodyHalf} ${bodyBottom-15}`,
      `L ${cx+bodyHalf} ${shoulderBottom+9}`,
      `C ${cx+bodyHalf} ${shoulderBottom+1} ${cx+bodyHalf*0.96} ${shoulderBottom-4} ${cx+bodyHalf*0.86} ${shoulderBottom-8}`,
      `C ${cx+bodyHalf*0.55} ${shoulderBottom-19} ${cx+neckHalf} ${neckBase+3} ${cx+neckHalf} ${neckBase-7}`,
      `L ${cx+neckHalf} ${neckTop}`,
      "Z"
    ].join(" ");'''
new_path = '''    const perspectiveSkew = 5.5;
    const nearBodyHalf = bodyHalf * 1.02;
    const farBodyHalf = bodyHalf * .91;
    const bodyPath = [
      `M ${cx-neckHalf-perspectiveSkew*.28} ${neckTop}`,
      `L ${cx-neckHalf-perspectiveSkew*.20} ${neckBase-7}`,
      `C ${cx-neckHalf-perspectiveSkew*.12} ${neckBase+3} ${cx-nearBodyHalf*0.55-perspectiveSkew*.30} ${shoulderBottom-18} ${cx-nearBodyHalf*0.86-perspectiveSkew*.45} ${shoulderBottom-7}`,
      `C ${cx-nearBodyHalf*0.97-perspectiveSkew*.55} ${shoulderBottom-3} ${cx-nearBodyHalf-perspectiveSkew*.60} ${shoulderBottom+2} ${cx-nearBodyHalf-perspectiveSkew*.60} ${shoulderBottom+10}`,
      `L ${cx-nearBodyHalf-perspectiveSkew*.60} ${bodyBottom-14}`,
      `C ${cx-nearBodyHalf-perspectiveSkew*.60} ${bodyBottom-4} ${cx-nearBodyHalf+5-perspectiveSkew*.35} ${bodyBottom+1} ${cx-18-perspectiveSkew*.12} ${bodyBottom+2}`,
      `Q ${cx+4} ${bodyBottom+7} ${cx+farBodyHalf-14+perspectiveSkew*.45} ${bodyBottom-1}`,
      `C ${cx+farBodyHalf-5+perspectiveSkew*.52} ${bodyBottom-4} ${cx+farBodyHalf+perspectiveSkew*.55} ${bodyBottom-8} ${cx+farBodyHalf+perspectiveSkew*.55} ${bodyBottom-16}`,
      `L ${cx+farBodyHalf+perspectiveSkew*.55} ${shoulderBottom+10}`,
      `C ${cx+farBodyHalf+perspectiveSkew*.55} ${shoulderBottom+2} ${cx+farBodyHalf*.96+perspectiveSkew*.48} ${shoulderBottom-3} ${cx+farBodyHalf*.84+perspectiveSkew*.38} ${shoulderBottom-7}`,
      `C ${cx+farBodyHalf*.53+perspectiveSkew*.22} ${shoulderBottom-18} ${cx+neckHalf+perspectiveSkew*.18} ${neckBase+3} ${cx+neckHalf+perspectiveSkew*.18} ${neckBase-7}`,
      `L ${cx+neckHalf+perspectiveSkew*.20} ${neckTop}`,
      "Z"
    ].join(" ");'''
if old_path not in text:
    raise SystemExit("Could not locate v82 bottle path")
text = text.replace(old_path, new_path, 1)

# Move the label slightly higher on the shorter perspective bottle.
text = text.replace('    const labelY = section === "neck" ? 70 : 128;', '    const labelY = section === "neck" ? 67 : 117;', 1)

# Add explicit perspective/rotation cues after the v82 orientation constants.
anchor = '''    const orientationMarker = orientationRingPoint(visualPlateAngle, 1);
    const orientationNeedle = orientationRingPoint(visualPlateAngle, .82);
    const currentBottleDegrees = normalizeAngle(plateAngle);
'''
insert = '''    const orientationMarker = orientationRingPoint(visualPlateAngle, 1);
    const orientationNeedle = orientationRingPoint(visualPlateAngle, .82);
    const currentBottleDegrees = normalizeAngle(plateAngle);

    // 3/4 elevated camera cue. A longitudinal reflection stripe travels around
    // the cylindrical body with the servo angle. The top-neck pointer uses the
    // same angle so users can see rotation even when no label is visible.
    const perspectiveRad = visualPlateAngle * Math.PI / 180;
    const perspectiveDatumX = cx + Math.sin(perspectiveRad) * bodyHalf * .72;
    const perspectiveDatumDepth = Math.cos(perspectiveRad);
    const perspectiveDatumOpacity = perspectiveDatumDepth >= 0 ? .92 : .20;
    const neckDiscCx = cx + 1.8;
    const neckDiscCy = 27;
    const neckDiscRx = neckHalf + 3.2;
    const neckDiscRy = 4.2;
    const neckPointerX = neckDiscCx + Math.cos(perspectiveRad) * neckDiscRx * .78;
    const neckPointerY = neckDiscCy + Math.sin(perspectiveRad) * neckDiscRy * .78;
'''
if anchor not in text:
    raise SystemExit("Could not locate v82 perspective constants anchor")
text = text.replace(anchor, insert, 1)

# Change title/readout to reflect the new camera.
text = text.replace('<text x="145" y="14" text-anchor="middle" class="view-title">SIDE VIEW</text>', '<text x="145" y="14" text-anchor="middle" class="view-title">3D PERSPECTIVE</text>', 1)
text = text.replace('${centerlineFront ? "DATUM FRONT" : "DATUM REAR"}</text>', '${centerlineFront ? "DATUM FRONT" : "DATUM REAR"} • 3/4 CAMERA</text>', 1)

# Add top opening/neck disc, shoulder depth, a live longitudinal rotation stripe,
# and a stronger base ellipse around the existing bottle glass group.
old_glass_open = '''      <g data-pseudo-3d-glass="true">
        <path d="${bodyPath}" fill="url(#bottleSideGlass-${context.source})" stroke="#b9c8cf" stroke-opacity=".88" stroke-width="2"/>'''
new_glass_open = '''      <g data-pseudo-3d-glass="true" data-three-quarter-camera="true">
        <ellipse cx="${neckDiscCx}" cy="${neckDiscCy}" rx="${neckDiscRx}" ry="${neckDiscRy}" fill="#071017" fill-opacity=".58" stroke="#dcebf1" stroke-opacity=".82" stroke-width="1.25"/>
        <ellipse cx="${neckDiscCx}" cy="${neckDiscCy+.3}" rx="${Math.max(4, neckDiscRx-3.2)}" ry="${Math.max(1.8, neckDiscRy-1.7)}" fill="#02070b" fill-opacity=".76" stroke="#8ca2ae" stroke-opacity=".35" stroke-width=".8"/>
        <line x1="${neckDiscCx}" y1="${neckDiscCy}" x2="${neckPointerX.toFixed(2)}" y2="${neckPointerY.toFixed(2)}" stroke="#ff5b42" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="${neckPointerX.toFixed(2)}" cy="${neckPointerY.toFixed(2)}" r="1.7" fill="#ff6a48"/>
        <path d="${bodyPath}" fill="url(#bottleSideGlass-${context.source})" stroke="#b9c8cf" stroke-opacity=".88" stroke-width="2"/>'''
if old_glass_open not in text:
    raise SystemExit("Could not locate glass group anchor")
text = text.replace(old_glass_open, new_glass_open, 1)

base_old = '''        <ellipse cx="${cx}" cy="${bodyBottom-3}" rx="${Math.max(10, bodyHalf-18)}" ry="5.6" fill="#d9e6eb" fill-opacity=".045" stroke="#d5e4e9" stroke-opacity=".18" stroke-width="1"/>'''
base_new = '''        <ellipse cx="${cx+1.5}" cy="${bodyBottom}" rx="${Math.max(16, bodyHalf-5)}" ry="8.2" fill="#071018" fill-opacity=".28" stroke="#d5e4e9" stroke-opacity=".32" stroke-width="1.15"/>
        <ellipse cx="${cx+1.5}" cy="${bodyBottom-1.4}" rx="${Math.max(11, bodyHalf-12)}" ry="5.2" fill="#d9e6eb" fill-opacity=".035" stroke="#d5e4e9" stroke-opacity=".14" stroke-width=".8"/>'''
if base_old not in text:
    raise SystemExit("Could not locate old bottle base ellipse")
text = text.replace(base_old, base_new, 1)

# Add live rotating longitudinal cue before lip-depth group.
cue_anchor = '''      </g>

      <g data-bottle-lip-depth="true">'''
cue_markup = '''        <line x1="${perspectiveDatumX.toFixed(2)}" y1="${shoulderBottom+5}" x2="${perspectiveDatumX.toFixed(2)}" y2="${bodyBottom-12}" stroke="#ff5b42" stroke-width="2.1" stroke-dasharray="5 5" stroke-opacity="${perspectiveDatumOpacity}" clip-path="url(#bottleClip-${context.source})"/>
        <path d="M ${cx-bodyHalf*.52} ${shoulderBottom-3} Q ${cx+2} ${shoulderBottom-12} ${cx+bodyHalf*.48} ${shoulderBottom-2}" fill="none" stroke="#d8e8ef" stroke-opacity=".16" stroke-width="1.2"/>
      </g>

      <g data-bottle-lip-depth="true">'''
if cue_anchor not in text:
    raise SystemExit("Could not locate cue insertion anchor")
text = text.replace(cue_anchor, cue_markup, 1)

# Adjust lip rectangles into a more elliptical, elevated opening treatment.
text = text.replace('''        <ellipse cx="${cx}" cy="22.8" rx="${neckHalf+2}" ry="2.5" fill="#dce7eb" fill-opacity=".07" stroke="#d8e5ea" stroke-opacity=".45" stroke-width="1"/>
        <rect x="${cx-neckHalf-2}" y="20" width="${neckHalf*2+4}" height="7" rx="2.5" fill="#d8e3e8" fill-opacity=".10" stroke="#c1cdd3" stroke-opacity=".78" stroke-width="1.2"/>
        <rect x="${cx-neckHalf-3}" y="27" width="${neckHalf*2+6}" height="6" rx="2" fill="#cbd8de" fill-opacity=".08" stroke="#b3c2ca" stroke-opacity=".68" stroke-width="1"/>
        <rect x="${cx-neckHalf-2}" y="33" width="${neckHalf*2+4}" height="6" rx="2" fill="#c2d0d7" fill-opacity=".07" stroke="#aabac3" stroke-opacity=".60" stroke-width="1"/>''',
'''        <ellipse cx="${cx+1.8}" cy="22.5" rx="${neckHalf+3.2}" ry="4.4" fill="#dce7eb" fill-opacity=".055" stroke="#d8e5ea" stroke-opacity=".54" stroke-width="1"/>
        <path d="M ${cx-neckHalf-2} 22.5 L ${cx-neckHalf-1.2} 31 Q ${cx+1.8} 35 ${cx+neckHalf+2.8} 30.6 L ${cx+neckHalf+3.2} 22.5" fill="#cbd8de" fill-opacity=".065" stroke="#c1cdd3" stroke-opacity=".46" stroke-width=".8"/>''', 1)

# Update aria label.
text = text.replace('aria-label="Pseudo-3D clear glass bottle side view with ${section} label wrapped to live bottle rotation"', 'aria-label="Elevated three-quarter clear glass bottle perspective with ${section} label wrapped to live bottle rotation"', 1)

# Add v83 flags.
flag_anchor = '''    selectedMockupBottleV82: true,
    sideViewOrientationFloorV82: true,
    sideViewDegreeRingV82: true,
    liveBaseAngleMarkerV82: true
'''
flag_replace = '''    selectedMockupBottleV82: true,
    sideViewOrientationFloorV82: true,
    sideViewDegreeRingV82: true,
    liveBaseAngleMarkerV82: true,
    elevatedThreeQuarterBottleV83: true,
    liveLongitudinalDatumCueV83: true,
    visibleTopNeckDiscV83: true,
    perspectiveBaseEllipseV83: true
'''
if flag_anchor not in text:
    raise SystemExit("Could not locate v82 feature flag anchor")
text = text.replace(flag_anchor, flag_replace, 1)
panel.write_text(text)

# Update build identifiers.
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
    "Staging v83 changes the Bottle Orientation left visual to an elevated three-quarter bottle perspective. "
    "The bottle now exposes its neck opening and base ellipse, keeps the v82 grid/degree ring, and adds a live "
    "longitudinal datum/reflection cue that moves around the cylinder with servo rotation for clearer motion depth."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

# Update regression pins and assert the new perspective features.
test = Path("tests/bottle-orientation-panel.test.js")
text = test.read_text()
old_build = "side-view-grid-degree-reference-v82-20260811-1852"
text = text.replace(old_build.replace("-", "\\-"), BUILD.replace("-", "\\-"))
text = text.replace(f'assert.equal(manifest.buildId, "{old_build}");', f'assert.equal(manifest.buildId, "{BUILD}");')
text = text.replace('console.log("Side-view grid and degree reference v82 regression passed.");', 'console.log("Three-quarter perspective bottle v83 regression passed.");')
needle = 'assert.match(source, /liveBaseAngleMarkerV82: true/);'
addition = needle + '''\nassert.match(source, /elevatedThreeQuarterBottleV83: true/);\nassert.match(source, /liveLongitudinalDatumCueV83: true/);\nassert.match(source, /visibleTopNeckDiscV83: true/);\nassert.match(source, /perspectiveBaseEllipseV83: true/);\nassert.match(source, /data-three-quarter-camera=\\"true\\"/);\nassert.match(source, /3D PERSPECTIVE/);\nassert.match(source, /perspectiveDatumX/);\nassert.match(source, /neckPointerX/);'''
if needle not in text:
    raise SystemExit("Could not locate v82 test flag anchor")
text = text.replace(needle, addition, 1)
# v82 still retains grid/ring tests and v81 legacy feature assertions.
test.write_text(text)
