from pathlib import Path
import json,re
BUILD='top-view-only-orientation-v84-20260811-1918'
UPDATED='Aug 11, 2026 7:18 PM ET'
p=Path('app/bottle-orientation-panel-integration.js')
s=p.read_text().replace('  const VERSION = 8;','  const VERSION = 9;',1)
s,n=re.subn(r'\n  function sideViewSvg\(context\) \{.*?\n  function panelMarkup\(source\) \{','\n  function panelMarkup(source) {',s,count=1,flags=re.S)
assert n==1
s=s.replace('<span><strong>Bottle Orientation &amp; Wipe Visual</strong><small>Full servo cycle • synchronized side + top views</small></span>','<span><strong>Bottle Orientation</strong><small>Full servo cycle • synchronized to labeler animation</small></span>',1)
s=s.replace('''        <div class="bottle-orientation-visual-grid">\n          <div class="bottle-orientation-view" data-orientation-side></div>\n          <div class="bottle-orientation-view" data-orientation-top></div>\n        </div>''','''        <div class="bottle-orientation-visual-grid">\n          <div class="bottle-orientation-view" data-orientation-top></div>\n        </div>''',1)
s,n=re.subn(r'\n        <div class="bottle-orientation-controls">.*?</div>\n        <label class="bottle-orientation-scrubber">.*?</label>','',s,count=1,flags=re.S)
assert n==1
s=s.replace('The circumferential label scale and wipe coverage come from the selected bottle/label geometry and the full generated servo program and active map geometry used by ServoForge. The side-view band height is presentation-only where the label specification does not provide a physical height.','Top View follows the same table-frame and servo-angle transforms as the live Mechanical Map and stays synchronized to the main labeler animation.',1)
s=s.replace('.bottle-orientation-visual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}','.bottle-orientation-visual-grid{display:grid;grid-template-columns:minmax(0,560px);justify-content:center;gap:7px;}',1)
s=s.replace('.bottle-orientation-view{min-width:0;min-height:228px;','.bottle-orientation-view{min-width:0;min-height:310px;',1)
s=s.replace('.bottle-orientation-svg{display:block;width:100%;height:235px;}','.bottle-orientation-svg{display:block;width:100%;height:315px;}',1)
for pat in [r'\n      \.bottle-orientation-controls\{[^\n]*\}',r'\n      \.bottle-orientation-controls button\{[^\n]*\}',r'\n      \.bottle-orientation-speed\{[^\n]*\}',r'\n      \.bottle-orientation-speed select\{[^\n]*\}',r'\n      \.bottle-orientation-scrubber\{[^\n]*\}',r'\n      \.bottle-orientation-scrubber input\{[^\n]*\}',r'\n      \.bottle-orientation-scrubber output\{[^\n]*\}']:
 s=re.sub(pat,'',s)
s,n=re.subn(r'\n      <g transform="translate\(86 4\)" opacity="\$\{hardwareActive \? 1 : \.42\}">.*?\n      </g>','',s,count=1,flags=re.S)
assert n==1
s=re.sub(r'\n    const hardwareActive = Boolean\([^\n]+\);','',s,count=1)
s=s.replace('    const side = panel.querySelector("[data-orientation-side]");\n','',1).replace('    if (side) side.innerHTML = sideViewSvg(context);\n','',1)
s=s.replace('    panel.addEventListener("click", onPanelClick);\n','',1).replace('    panel.addEventListener("input", onPanelInput);\n','',1).replace('    panel.addEventListener("change", onPanelChange);\n','',1)
for f in ['pseudo3dBottleSideViewV81','curvedWrappedLabelBandV81','orientationDepthCueV81','selectedMockupBottleV82','sideViewOrientationFloorV82','sideViewDegreeRingV82','liveBaseAngleMarkerV82','elevatedThreeQuarterBottleV83','liveLongitudinalDatumCueV83','visibleTopNeckDiscV83','perspectiveBaseEllipseV83']:
 s=re.sub(rf'\n    {f}: true,?','',s)
s=s.replace('    mechanicalMapTransformParityV80: true','    mechanicalMapTransformParityV80: true,\n    topViewOnlyV84: true,\n    standaloneOrientationControlsRemovedV84: true,\n    topViewWipeGraphicRemovedV84: true,\n    mainAnimationOnlyV84: true',1)
p.write_text(s)
for name in ['app/bootstrap.js','app/update-manager.js','service-worker.js']:
 q=Path(name); t=q.read_text()
 if name.endswith('bootstrap.js'):
  t=re.sub(r'const build = "[^"]+";',f'const build = "{BUILD}";',t,count=1);t=re.sub(r'const buildUpdatedAt = "[^"]+";',f'const buildUpdatedAt = "{UPDATED}";',t,count=1);t=t.replace('// Regression lineage:',f'// Regression lineage: {BUILD} •',1)
 elif name.endswith('update-manager.js'): t=re.sub(r'const BUILD_ID = "[^"]+";',f'const BUILD_ID = "{BUILD}";',t,count=1)
 else: t=re.sub(r'const CACHE_NAME = "[^"]+";',f'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-{BUILD}";',t,count=1)
 q.write_text(t)
m=Path('update-manifest.json');d=json.loads(m.read_text());d['buildId']=BUILD;d['notes']='v84 keeps only the live Top View in Bottle Orientation. Side View/3D perspective, standalone controls, scrubber, speed selector, and the incorrect Top View wipe graphic are removed. The Top View stays synchronized to the main labeler animation.';m.write_text(json.dumps(d,indent=2)+'\n')
