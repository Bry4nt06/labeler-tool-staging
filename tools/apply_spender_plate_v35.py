from pathlib import Path
import json
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')

def sub1(path, pattern, replacement, flags=re.S):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match for {pattern!r}, found {count}')
    write(path, updated)

def replace1(path, old, new):
    text = read(path)
    if old not in text:
        raise RuntimeError(f'{path}: missing expected text {old[:100]!r}')
    write(path, text.replace(old, new, 1))

# Wipe pad: authoritative reverse bevel.
path = 'app/assembly-map-renderer.js'
text = read(path)
text, count = re.subn(r'function machineForwardPadPath\(startAngle, endAngle, centerRadius, widthMapUnits\) \{.*?\n\}\n\nfunction drawSpongeWipeDownPad', '''function machineTrailingPadPath(startAngle, endAngle, centerRadius, widthMapUnits) {
  const start = num(startAngle, 0);
  let end = num(endAngle, start);
  while (end < start) end += 360;
  const width = Math.max(1, num(widthMapUnits, wipeDownPadWidthMapUnits()));
  const innerRadius = Math.max(1, centerRadius - width / 2);
  const outerRadius = Math.max(innerRadius + 0.5, centerRadius + width / 2);
  const span = Math.max(0.1, end - start);
  const physicalBevelDeg = (width / Math.max(1, centerRadius)) * 180 / Math.PI * 0.8;
  const bevelDeg = Math.min(span * 0.38, Math.max(0.75, Math.min(5, physicalBevelDeg)));
  // Logical map angles increase in machine travel direction. Chamfer the
  // trailing/start side so the bevel faces against machine travel.
  const innerTrailingStart = start + bevelDeg;
  const startOuter = angleToXY(start, outerRadius);
  const endOuter = angleToXY(end, outerRadius);
  const startInner = angleToXY(innerTrailingStart, innerRadius);
  const endInner = angleToXY(end, innerRadius);
  const largeOuter = span > 180 ? 1 : 0;
  const innerSpan = Math.max(0.1, end - innerTrailingStart);
  const largeInner = innerSpan > 180 ? 1 : 0;
  const sweepOuter = state.direction === "cw" ? 0 : 1;
  const sweepInner = sweepOuter ? 0 : 1;
  return [`M ${startOuter.x} ${startOuter.y}`, `A ${outerRadius} ${outerRadius} 0 ${largeOuter} ${sweepOuter} ${endOuter.x} ${endOuter.y}`, `L ${endInner.x} ${endInner.y}`, `A ${innerRadius} ${innerRadius} 0 ${largeInner} ${sweepInner} ${startInner.x} ${startInner.y}`, "Z"].join(" ");
}

function drawSpongeWipeDownPad''', text, count=1, flags=re.S)
if count != 1: raise RuntimeError('assembly renderer: machineForwardPadPath block not found')
text = text.replace('const d = machineForwardPadPath(item.start, item.end, centerRadius, widthMapUnits);', 'const d = machineTrailingPadPath(item.start, item.end, centerRadius, widthMapUnits);', 1)
text = text.replace('"data-bevel-facing": "machine-forward"', '"data-bevel-facing": "against-machine-direction"', 1)
text = text.replace('  machineForwardPadPath,\n', '  machineTrailingPadPath,\n', 1)
text = text.replace('  spongeWipePadsV1: true,\n  spongeRollersV1: true', '  spongeWipePadsV1: true,\n  spongeWipePadsV2: true,\n  bevelAgainstMachineDirectionV1: true,\n  spongeRollersV1: true', 1)

# Physical APL spender assembly and per-spender angle.
text, count = re.subn(r'function activeAggregateDefinitions\(\) \{.*?\n\}\n\nconst AGGREGATE_CENTERLINE_MIN_GAP_DEG', '''function activeAggregateDefinitions() {
  const machineMap = activeMachineMap();
  if (!machineMap) return [];
  const enabled = normalizeEnabledSlots(machineMap.enabledAggregates, machineMap.aggregateCount);
  const angles = normalizeAggregateAngles(machineMap.aggregateAngles, machineMap.applicationMode, machineMap.objects);
  const spenderAngles = typeof normalizeSpenderPlateAngles === "function" ? normalizeSpenderPlateAngles(machineMap.spenderPlateAngles) : Object.fromEntries(Array.from({ length: 6 }, (_, index) => [String(index + 1), 75]));
  return enabled.map((isEnabled, index) => isEnabled ? { number: index + 1, angle: num(angles[String(index + 1)], 0), spenderPlateAngleDeg: Math.max(0, Math.min(180, num(spenderAngles[String(index + 1)], 75))) } : null).filter(Boolean);
}

const AGGREGATE_CENTERLINE_MIN_GAP_DEG''', text, count=1, flags=re.S)
if count != 1: raise RuntimeError('assembly renderer: activeAggregateDefinitions block not found')
text, count = re.subn(r'function drawIndependentAggregates\(add, layer\) \{.*?\n\}\n\nfunction labelSensorMapStatus', '''function drawAplSpenderAssembly(add, layer, aggregate) {
  const machineSign = state.direction === "cw" ? 1 : -1;
  const plateAngleDeg = Math.max(0, Math.min(180, num(aggregate.spenderPlateAngleDeg, 75)));
  const xy = angleToXY(aggregate.angle, state.radius + state.depths.spender);
  const rotation = angleToSvgRotation(aggregate.angle) + machineSign * plateAngleDeg;
  const group = add("g", { transform: `translate(${xy.x} ${xy.y}) rotate(${rotation})`, "data-aggregate-marker": aggregate.number, "data-application-arm": aggregate.number, "data-spender-plate-angle": plateAngleDeg }, layer);
  add("polygon", { points: "-4,-2.6 20,-3.2 25,-1.5 25,1.5 20,3.2 -4,2.6", fill: "#c5ccd2", stroke: "#69737c", "stroke-width": 1, "stroke-linejoin": "round", "data-spender-plate": aggregate.number }, group);
  add("line", { x1: -2, y1: -1.4, x2: 21, y2: -1.8, stroke: "#f1f4f6", "stroke-width": 0.7, "stroke-opacity": 0.72, "pointer-events": "none" }, group);
  add("line", { x1: 21, y1: 0, x2: 47, y2: 0, stroke: "#59636c", "stroke-width": 6, "stroke-linecap": "round", "data-application-arm-member": aggregate.number }, group);
  add("line", { x1: 23, y1: -1.1, x2: 44, y2: -1.1, stroke: "#aab3bb", "stroke-width": 0.85, "stroke-opacity": 0.65, "pointer-events": "none" }, group);
  add("circle", { cx: 47, cy: 0, r: 5.2, fill: "#7a848d", stroke: "#c8ced3", "stroke-width": 1.1, "data-application-arm-pivot": aggregate.number }, group);
  add("circle", { cx: 47, cy: 0, r: 2.1, fill: "#20262b", stroke: "#111519", "stroke-width": 0.7 }, group);
  add("line", { x1: -4, y1: -2.8, x2: -4, y2: 2.8, stroke: "#ff8a00", "stroke-width": 1.4, "stroke-linecap": "round", "data-spender-contact-edge": aggregate.number }, group);
  return group;
}

function drawIndependentAggregates(add, layer) {
  activeAggregateDefinitions().forEach((aggregate) => {
    if (state.applicationMode !== "cold-glue") { drawAplSpenderAssembly(add, layer, aggregate); return; }
    const xy = angleToXY(aggregate.angle, state.radius + state.depths.spender);
    const rotation = angleToSvgRotation(aggregate.angle) + 90;
    const group = add("g", { transform: `translate(${xy.x} ${xy.y}) rotate(${rotation})`, "data-aggregate-marker": aggregate.number }, layer);
    add("line", { x1: -9, y1: 0, x2: 9, y2: 0, stroke: "#d71920", "stroke-width": 3, "stroke-linecap": "round" }, group);
  });
}

function labelSensorMapStatus''', text, count=1, flags=re.S)
if count != 1: raise RuntimeError('assembly renderer: drawIndependentAggregates block not found')
write(path, text)

# Map schema and persistence.
path = 'drivers/map/map-schema-driver.js'; text = read(path)
text = text.replace('  const BLANK_MAP_SEED_VERSION = 1;\n', '  const BLANK_MAP_SEED_VERSION = 1;\n  const DEFAULT_SPENDER_PLATE_ANGLE_DEG = 75;\n', 1)
text, count = re.subn(r'(  function normalizeStationAngles\(value, \{ defaults = \{\} \} = \{\}\) \{\n    return normalizeAngleRecord\(value, defaults\);\n  \}\n)', r'''\1
  function normalizeSpenderPlateAngles(value, defaultAngle = DEFAULT_SPENDER_PLATE_ANGLE_DEG) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    for (let slot = 1; slot <= 6; slot += 1) result[String(slot)] = Math.max(0, Math.min(180, finite(source[String(slot)], defaultAngle)));
    return result;
  }
''', text, count=1)
if count != 1: raise RuntimeError('map schema: normalizeStationAngles anchor not found')
text, count = re.subn(r'(      aggregateAngles: normalizeAggregateAngles\(\n.*?      \),\n)(      stationAngles:)', r'\1      spenderPlateAngles: normalizeSpenderPlateAngles(input.spenderPlateAngles),\n\2', text, count=1, flags=re.S)
if count != 1: raise RuntimeError('map schema: aggregateAngles field not found')
text = text.replace('    BLANK_MAP_SEED_VERSION,\n    VALID_OBJECT_KINDS,', '    BLANK_MAP_SEED_VERSION,\n    DEFAULT_SPENDER_PLATE_ANGLE_DEG,\n    VALID_OBJECT_KINDS,', 1)
text = text.replace('    normalizeAggregateAngles,\n    normalizeStationAngles,\n    sortAplMapObjects,', '    normalizeAggregateAngles,\n    normalizeStationAngles,\n    normalizeSpenderPlateAngles,\n    sortAplMapObjects,', 1)
write(path, text)

path = 'drivers/map/map-migration-driver.js'; text = read(path); old = '      map.aggregateAngles = normalizeAggregateAngles(map.aggregateAngles, applicationMode, map.objects);\n      Object.assign(map, mapLocationFor(map));'
if old not in text: raise RuntimeError('migration anchor missing')
write(path, text.replace(old, '      map.aggregateAngles = normalizeAggregateAngles(map.aggregateAngles, applicationMode, map.objects);\n      map.spenderPlateAngles = schema.normalizeSpenderPlateAngles(map.spenderPlateAngles);\n      Object.assign(map, mapLocationFor(map));', 1))

path = 'app/map-schema-adapter-integration.js'; text = read(path); needle = '    normalizeStationAngles(value) {\n      return driver.normalizeStationAngles(value, { defaults: aplStationDefaults() });\n    },\n'
if needle not in text: raise RuntimeError('adapter anchor missing')
write(path, text.replace(needle, needle + '    normalizeSpenderPlateAngles(value) {\n      return driver.normalizeSpenderPlateAngles(value);\n    },\n', 1))

# Map Builder controls.
path='app/map-builder-controls.js'; text=read(path)
text,count=re.subn(r'function renderAggregateAngleEditor\(machineMap\) \{.*?\n\}\n\nfunction renderMachineLayoutControls','''function renderAggregateAngleEditor(machineMap) {
  if (!els.aggregateAngleEditor) return;
  if (els.aggregateAnglesSection) els.aggregateAnglesSection.hidden = false;
  machineMap.aggregateAngles = normalizeAggregateAngles(machineMap.aggregateAngles, machineMap.applicationMode, machineMap.objects);
  machineMap.spenderPlateAngles = normalizeSpenderPlateAngles(machineMap.spenderPlateAngles);
  machineMap.stationAngles = normalizeStationAngles({ ...machineMap.stationAngles, ...machineMap.aggregateAngles });
  const activeAggregates = activeSlotNumbers(machineMap.enabledAggregates);
  if (els.aggregateAnglesSummary) els.aggregateAnglesSummary.textContent = `${activeAggregates.length} active aggregate${activeAggregates.length === 1 ? "" : "s"} • click to expand`;
  els.aggregateAngleEditor.innerHTML = `<div class="builder-row-grid">${activeAggregates.map((aggregate) => `<label>Aggregate ${aggregate} table angle<input data-aggregate-angle="${aggregate}" type="number" step="0.1" value="${fmt(machineMap.aggregateAngles[String(aggregate)], 1)}"></label><label>Spender ${aggregate} plate angle<input data-spender-plate-angle="${aggregate}" type="number" min="0" max="180" step="0.1" value="${fmt(machineMap.spenderPlateAngles[String(aggregate)], 1)}" title="Application arm / spender plate angle. Default 75°."></label>`).join("")}</div>`;
}

function renderMachineLayoutControls''',text,count=1,flags=re.S)
if count!=1: raise RuntimeError('aggregate editor block missing')
write(path,text)

path='app/controllers/map-builder-layout-controller.js'; text=read(path)
text=text.replace('  function machineSlotControl(target) {','  function spenderPlateAngleControl(target) {\n    if (!target?.matches?.("[data-spender-plate-angle]")) return false;\n    return Boolean(typeof els !== "undefined" && els.aggregateAngleEditor?.contains(target));\n  }\n\n  function machineSlotControl(target) {',1)
text=text.replace('  function updateMachineSlot(control) {','  function updateSpenderPlateAngle(control) {\n    if (!spenderPlateAngleControl(control)) return false;\n    if (["", "-", ".", "-."].includes(String(control.value))) return true;\n    const aggregate = String(control.dataset.spenderPlateAngle || "");\n    const editable = typeof editableMachineMap === "function" ? editableMachineMap() : null;\n    if (!aggregate || !editable) return false;\n    editable.spenderPlateAngles = normalizeSpenderPlateAngles(editable.spenderPlateAngles);\n    editable.spenderPlateAngles[aggregate] = Math.max(0, Math.min(180, num(control.value, editable.spenderPlateAngles[aggregate])));\n    refreshAfterBuilderEdit({ persist: true });\n    return true;\n  }\n\n  function updateMachineSlot(control) {',1)
text=text.replace('    if (!(target instanceof Element) || !updateAggregateAngle(target)) return;\n    consume(event);','    if (!(target instanceof Element)) return;\n    if (updateAggregateAngle(target) || updateSpenderPlateAngle(target)) consume(event);',1)
text=text.replace('    if (updateMachineSlot(target) || updateAggregateAngle(target)) consume(event);','    if (updateMachineSlot(target) || updateAggregateAngle(target) || updateSpenderPlateAngle(target)) consume(event);',1)
text=text.replace('    aggregateAngleControl,\n    machineSlotControl,\n    updateAggregateAngle,\n    updateMachineSlot','    aggregateAngleControl,\n    spenderPlateAngleControl,\n    machineSlotControl,\n    updateAggregateAngle,\n    updateSpenderPlateAngle,\n    updateMachineSlot',1)
if 'function updateSpenderPlateAngle' not in text: raise RuntimeError('spender event handler missing')
write(path,text)

path='app/map-builder-controller.js'; text=read(path)
text=text.replace('  map.aggregateAngles = normalizeAggregateAngles(map.aggregateAngles, map.applicationMode, map.objects);\n  map.stationAngles = normalizeStationAngles({ ...map.stationAngles, ...map.aggregateAngles });','  map.aggregateAngles = normalizeAggregateAngles(map.aggregateAngles, map.applicationMode, map.objects);\n  map.spenderPlateAngles = normalizeSpenderPlateAngles(map.spenderPlateAngles);\n  map.stationAngles = normalizeStationAngles({ ...map.stationAngles, ...map.aggregateAngles });',1)
text=text.replace('  map.aggregateCount = stations;\n  map.stationCount = stations;\n  map.stationSections = {};','  map.aggregateCount = stations;\n  map.stationCount = stations;\n  map.spenderPlateAngles = normalizeSpenderPlateAngles(map.spenderPlateAngles);\n  map.stationSections = {};',1)
write(path,text)

# Defaults, caches and build stamp.
path='app/defaults.js'; text=read(path).replace('localStorage.getItem("labelerThemePreset") || "dark-green"','localStorage.getItem("labelerThemePreset") || "servoforge"',1).replace('return "dark-green";','return "servoforge";',1)
if 'workspaceView: "direct"' not in text: raise RuntimeError('Direct default missing')
write(path,text)
p=ROOT/'config/company-default-settings.json'; cfg=json.loads(p.read_text()); cfg['settings']['themePreset']='servoforge'; cfg['settings']['workspaceView']='direct'; p.write_text(json.dumps(cfg,indent=2)+'\n')
path='app/wipe-down-builder.js'; write(path,re.sub(r'const releaseVersion = "[^"]+";','const releaseVersion = "0.9.10-spender-v35";',read(path),count=1))
path='app/simulation-collapsible-integration.js'; write(path,read(path).replace('app/assembly-map-renderer.js?v=0.9.7-assembly-ui-split-v1','app/assembly-map-renderer.js?v=0.9.10-spender-v35',1))
path='index.html'; text=read(path)
for old,new in [('app/defaults.js?v=0.9.10','app/defaults.js?v=0.9.10-spender-v35'),('app/wipe-down-builder.js?v=0.9.10','app/wipe-down-builder.js?v=0.9.10-spender-v35'),('app/bootstrap.js?v=0.9.10','app/bootstrap.js?v=0.9.10-spender-v35')]: text=text.replace(old,new,1)
write(path,text)
path='app/bootstrap.js'; text=read(path); text=re.sub(r'const build = "[^"]+";','const build = "spender-plate-visual-controls-v35-20260807-1402";',text,count=1); text=re.sub(r'const buildUpdatedAt = "[^"]+";','const buildUpdatedAt = "Aug 7, 2026 2:02 PM ET";',text,count=1); text=text.replace('    "app/wipe-pad-bevel-direction-integration.js",\n',''); write(path,text)
(ROOT/'app/wipe-pad-bevel-direction-integration.js').unlink(missing_ok=True)

# Tests and workflow.
write('tests/wipe-component-visuals.test.js','''"use strict";\nconst assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");\nconst root=path.resolve(__dirname,".."),read=r=>fs.readFileSync(path.join(root,r),"utf8");\nconst a=read("app/assembly-map-renderer.js"),m=read("app/mechanical-map-scene-renderer.js"),s=read("app/simulation-map-scene-renderer.js");\nassert.doesNotThrow(()=>new vm.Script(a)); assert.match(a,/WIPE_DOWN_PAD_WIDTH_MM = 22/); assert.match(a,/servoforge-wipe-sponge-pattern/); assert.match(a,/function machineTrailingPadPath/); assert.match(a,/innerTrailingStart = start \\+ bevelDeg/); assert.match(a,/const d = machineTrailingPadPath/); assert.match(a,/against-machine-direction/); assert.doesNotMatch(a,/function machineForwardPadPath/); assert.doesNotMatch(a,/"data-bevel-facing": "machine-forward"/); assert.match(a,/servoforge-roller-sponge-pattern/); assert.match(a,/data-roller-hub/); assert.match(m,/drawSpongeRoller\\(add, equipmentLayer/); assert.match(s,/drawConfiguredAssemblies\\(add, configuredAssemblyLayer\\)/);\nconsole.log("Authoritative reverse-bevel sponge wipe and roller visual regression passed.");\n''')
write('tests/spender-plate-visual-controls.test.js','''"use strict";\nconst assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");\nconst root=path.resolve(__dirname,".."),read=r=>fs.readFileSync(path.join(root,r),"utf8"),schema=require(path.join(root,"drivers/map/map-schema-driver.js"));\nassert.equal(schema.DEFAULT_SPENDER_PLATE_ANGLE_DEG,75); assert.deepEqual(schema.normalizeSpenderPlateAngles({"2":92.5,"3":-10,"4":220}),{"1":75,"2":92.5,"3":0,"4":180,"5":75,"6":75}); const map=schema.createMachineMap({id:"test-map",applicationMode:"apl",aggregateCount:3,stationCount:3,objects:[],restoreDefaultObjects:false}); assert.equal(map.spenderPlateAngles["1"],75); assert.equal(map.spenderPlateAngles["6"],75);\nconst renderer=read("app/assembly-map-renderer.js"),controls=read("app/map-builder-controls.js"),layout=read("app/controllers/map-builder-layout-controller.js"),adapter=read("app/map-schema-adapter-integration.js"),migration=read("drivers/map/map-migration-driver.js"); [renderer,controls,layout,adapter,migration].forEach(x=>assert.doesNotThrow(()=>new vm.Script(x))); assert.match(renderer,/function drawAplSpenderAssembly/); assert.match(renderer,/data-application-arm/); assert.match(renderer,/data-spender-plate/); assert.match(renderer,/data-application-arm-pivot/); assert.match(renderer,/machineSign \\* plateAngleDeg/); assert.match(controls,/data-spender-plate-angle/); assert.match(controls,/Default 75°/); assert.match(layout,/function updateSpenderPlateAngle/); assert.match(adapter,/normalizeSpenderPlateAngles/); assert.match(migration,/schema\\.normalizeSpenderPlateAngles/); console.log("Per-spender application arm and 75-degree plate-angle regression passed.");\n''')
write('.github/workflows/validate-spender-plate-visual-controls.yml','''name: Validate spender plate visual controls\non:\n  push:\n    branches: [main]\n    paths: ["app/assembly-map-renderer.js", "app/map-builder-controls.js", "app/map-builder-controller.js", "app/controllers/map-builder-layout-controller.js", "app/map-schema-adapter-integration.js", "drivers/map/map-schema-driver.js", "drivers/map/map-migration-driver.js", "tests/spender-plate-visual-controls.test.js", ".github/workflows/validate-spender-plate-visual-controls.yml"]\n  pull_request:\n    paths: ["app/assembly-map-renderer.js", "app/map-builder-controls.js", "app/map-builder-controller.js", "app/controllers/map-builder-layout-controller.js", "app/map-schema-adapter-integration.js", "drivers/map/map-schema-driver.js", "drivers/map/map-migration-driver.js", "tests/spender-plate-visual-controls.test.js", ".github/workflows/validate-spender-plate-visual-controls.yml"]\npermissions: { contents: read }\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: 22 }\n      - run: node --check app/assembly-map-renderer.js && node --check app/map-builder-controls.js && node --check app/map-builder-controller.js && node --check app/controllers/map-builder-layout-controller.js && node --check app/map-schema-adapter-integration.js && node --check drivers/map/map-schema-driver.js && node --check drivers/map/map-migration-driver.js && node tests/spender-plate-visual-controls.test.js\n''')
path='.github/workflows/validate-wipe-component-visuals.yml'; text=read(path).replace('      - "app/wipe-pad-bevel-direction-integration.js"\n','').replace('          node --check app/wipe-pad-bevel-direction-integration.js\n',''); write(path,text)
path='tests/servoforge-brand-theme.test.js'; text=read(path); text=re.sub(r'assert\.match\(bootstrap, /servoforge-brand-polish-[^/]+/\);','assert.match(bootstrap, /spender-plate-visual-controls-v35-20260807-1402/);',text); text=re.sub(r'assert\.match\(bootstrap, /Aug 7, 2026 [^/]+/\);','assert.match(bootstrap, /Aug 7, 2026 2:02 PM ET/);',text); text=text.replace('console.log("ServoForge brand mark and selectable theme regression passed.");','const defaults=read("app/defaults.js"),companyDefaults=JSON.parse(read("config/company-default-settings.json"));\nassert.match(defaults,/labelerThemePreset"\\) \\|\\| "servoforge"/);\nassert.match(defaults,/workspaceView: "direct"/);\nassert.equal(companyDefaults.settings.themePreset,"servoforge");\nassert.equal(companyDefaults.settings.workspaceView,"direct");\nconsole.log("ServoForge brand mark, default theme, and Direct view regression passed.");'); write(path,text)
path='.github/workflows/validate-servoforge-brand-theme.yml'; text=read(path)
if '      - "app/defaults.js"\n' not in text: text=text.replace('      - "app/bootstrap.js"\n','      - "app/bootstrap.js"\n      - "app/defaults.js"\n      - "config/company-default-settings.json"\n')
write(path,text)
(ROOT/'.github/workflows/apply-spender-plate-visual-v35.yml').unlink(missing_ok=True); (ROOT/'.github/workflows/apply-spender-plate-visual-v35b.yml').unlink(missing_ok=True); (ROOT/'tools/apply_spender_plate_v35.py').unlink(missing_ok=True)
