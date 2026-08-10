from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def require_replace(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}: {old!r}")
    return text.replace(old, new, 1)


def require_sub(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: regex did not match exactly once: {pattern}")
    return updated


def remove_lines_containing(text: str, markers: list[str]) -> str:
    lines = text.splitlines(keepends=True)
    return "".join(line for line in lines if not any(marker in line for marker in markers))


# ---------------------------------------------------------------------------
# Startup/load graph
# ---------------------------------------------------------------------------
bootstrap = read("app/bootstrap.js")
bootstrap = require_replace(
    bootstrap,
    'const build = "coder-prehold-allowed-corrections-v48-20260809-1836";',
    'const build = "coding-disabled-aggregate6-terminal-v49-20260809-2103";',
    "app/bootstrap.js build",
)
bootstrap = require_replace(
    bootstrap,
    'const buildUpdatedAt = "Aug 9, 2026 6:36 PM ET";',
    'const buildUpdatedAt = "Aug 9, 2026 9:03 PM ET";',
    "app/bootstrap.js timestamp",
)
bootstrap = bootstrap.replace(
    "// Regression lineage: coder-prehold-allowed-corrections-v48-20260809-1836",
    "// Regression lineage: coding-disabled-aggregate6-terminal-v49-20260809-2103 • coder-prehold-allowed-corrections-v48-20260809-1836",
    1,
)
bootstrap = remove_lines_containing(
    bootstrap,
    [
        "app/controllers/coding-cycle-normalization-controller.js",
        "app/topmodul-coder-prehold-finalizer-integration.js",
    ],
)
anchor = '    "app/topmodul-allowed-correction-diagnostics-integration.js",\n'
if anchor not in bootstrap:
    raise RuntimeError("app/bootstrap.js: terminal integration anchor missing")
bootstrap = bootstrap.replace(
    anchor,
    '    "app/apl-final-aggregate-terminal-integration.js",\n' + anchor,
    1,
)
write("app/bootstrap.js", bootstrap)

appjs = read("app.js")
appjs = remove_lines_containing(appjs, ["app/coder-window-reference-handoff-integration.js"])
write("app.js", appjs)

feature = read("app/simulation-collapsible-integration.js")
feature = remove_lines_containing(
    feature,
    [
        "drivers/profile/coder-orientation-driver.js",
        "drivers/profile/coder-handoff-driver.js",
        "app/map-object-servo-orientation-integration.js",
        "app/map-object-coder-after-wipe-integration.js",
        "app/map-object-orientation-controls-integration.js",
        "app/clockwise-code-box-orientation-integration.js",
        "app/coder-rest-grammar-repair-integration.js",
    ],
)
write("app/simulation-collapsible-integration.js", feature)


# ---------------------------------------------------------------------------
# APL generation: physical coding object remains on the map but is inert.
# ---------------------------------------------------------------------------
apl = read("app/apl-map-profile-generation.js")
apl = require_replace(
    apl,
    '.filter((item) => item.kind === "coding" || ((item.kind === "roller" || item.kind === "pad" || item.kind === "sensor") && isStationEnabled(machineMap, Number(item.station))))',
    '.filter((item) => (item.kind === "roller" || item.kind === "pad" || item.kind === "sensor") && isStationEnabled(machineMap, Number(item.station)))',
    "app/apl-map-profile-generation.js object filter",
)
apl = require_sub(
    apl,
    r'\n  const codingObject = objects\.find\(\(item\) => item\.kind === "coding"\);[\s\S]*?\n  const finalized =',
    '''
  const finalRow = rows[rows.length - 1];
  if (finalRow) {
    rows[rows.length - 1] = {
      ...finalRow,
      cmd: 3,
      baseCmd: 3,
      terminalRest: true,
      activeHold: false,
      aggregateTerminal: true,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3
    };
  }
  const finalized =''',
    "app/apl-map-profile-generation.js coding block",
    re.M,
)
apl = require_replace(
    apl,
    'termination: { section: codingObject ? "coding" : stationPlans[stationPlans.length - 1]?.section || "none", hmi: finalized.length, tableAngle: finalized[finalized.length - 1]?.tableAngle, command: "Rest" },',
    'termination: { section: stationPlans[stationPlans.length - 1]?.section || "none", station: stationPlans[stationPlans.length - 1]?.station, hmi: finalized.length, tableAngle: finalized[finalized.length - 1]?.tableAngle, command: "Rest" },',
    "app/apl-map-profile-generation.js termination",
)
if re.search(r"Direct Turn for Coding|Hold for Coding|codingWindow|codingObject|codingReady", apl):
    raise RuntimeError("app/apl-map-profile-generation.js still contains coding servo generation")
write("app/apl-map-profile-generation.js", apl)


# ---------------------------------------------------------------------------
# Reference/legacy APL profile: remove its final coding turn and hold.
# ---------------------------------------------------------------------------
seed = read("app/apl-seed-profile.js")
seed = require_sub(
    seed,
    r'\n  const codeBox = degFromMm\(label\?\.codeBoxCenterMm, bottleCirc\);[\s\S]*?\n  const scale =',
    "\n  const scale =",
    "app/apl-seed-profile.js code-box calculation",
)
seed = require_sub(
    seed,
    r'\n  const codingObject = \(map\?\.objects \|\| \[\]\)\.find\(\(item\) => item\.kind === "coding"\);',
    "",
    "app/apl-seed-profile.js coding object",
)
seed = require_sub(
    seed,
    r'\n  const codingStart = [\s\S]*?\n  const codingStop = [\s\S]*?;',
    "",
    "app/apl-seed-profile.js coding window",
)
seed = require_sub(
    seed,
    r'\n  // Workbook timing completes the turn[\s\S]*?while \(codingReady <= codingTurnStart\) codingReady \+= 360;\n',
    "\n",
    "app/apl-seed-profile.js coding timing",
)
seed = require_replace(
    seed,
    "    scale(pad4[0]), scale(pad4[1]), scale(pad4[2]), scale(pad4[3]),\n    scale(codingTurnStart),\n    scale(codingReady)\n",
    "    scale(pad4[0]), scale(pad4[1]), scale(pad4[2]), scale(pad4[3])\n",
    "app/apl-seed-profile.js reference table tail",
)
seed = require_replace(
    seed,
    "    seed[17]?.plateAngle,\n    seed[18]?.plateAngle,\n    seed[19]?.plateAngle,\n    seed[19]?.plateAngle,\n    codingTarget\n",
    "    seed[17]?.plateAngle,\n    seed[18]?.plateAngle,\n    seed[19]?.plateAngle\n",
    "app/apl-seed-profile.js plate tail",
)
seed = require_replace(
    seed,
    "  const commands = [3, 3, 7, 3, 7, 3, 7, 3, 7, 3, 7, 7, 3, 7, 3, 7, 7, 3, 7, 3];",
    "  const commands = [3, 3, 7, 3, 7, 3, 7, 3, 7, 3, 7, 7, 3, 7, 3, 7, 7, 3];",
    "app/apl-seed-profile.js commands",
)
seed = require_replace(
    seed,
    '    "Wipe Turn 2 Body - Agg 4",\n    "Wipe Hold Body - Agg 4",\n    "Turn for Coding",\n    "Hold for Coding"\n',
    '    "Wipe Turn 2 Body - Agg 4",\n    "Wipe Hold Body - Agg 4"\n',
    "app/apl-seed-profile.js actions",
)
seed = require_sub(
    seed,
    r'    terminalRest: index === actions\.length - 1,\n    \.\.\.\(index >= actions\.length - 2 \? \{[\s\S]*?\} : \{\}\),\n    profileSource:',
    '    terminalRest: index === actions.length - 1,\n    profileSource:',
    "app/apl-seed-profile.js coding metadata",
)
if re.search(r"Turn for Coding|Hold for Coding|codingWindow|codingObject|codingReady|codingTarget", seed):
    raise RuntimeError("app/apl-seed-profile.js still contains coding servo generation")
write("app/apl-seed-profile.js", seed)

routing = read("app/profile-routing.js")
routing = re.sub(r'\n  const codingObjectReady = Boolean\([^\n]+\);', "", routing, count=1)
routing = routing.replace("    && compactStationsReady && codingObjectReady;", "    && compactStationsReady;")
routing = routing.replace('        section: "coding",', '        section: "body",')
write("app/profile-routing.js", routing)


# ---------------------------------------------------------------------------
# Sensor orientation pipeline becomes sensor-only.
# ---------------------------------------------------------------------------
orient = read("drivers/profile/map-object-orientation-driver.js")
orient = require_sub(
    orient,
    r'  function nearestEquivalent\(target, reference\) \{[\s\S]*?\n  \}',
    '''  function nearestEquivalent(target, reference) {
    const base = finite(target, 0);
    const current = finite(reference, base);
    return base + FULL_CYCLE_DEG * Math.round((current - base) / FULL_CYCLE_DEG);
  }''',
    "map-object-orientation nearestEquivalent",
)
orient = orient.replace(
    '      // A physical label sensor has no inspection duty when its assigned label\n      // is absent from the selected brand. Ignore it without creating a turn,\n      // hold, or validation issue. Coders still retarget to the active label.\n      if (item?.kind === "coding") return activeFallback(activeApplications);\n      return "none";',
    '      // A physical label sensor has no inspection duty when its assigned label\n      // is absent from the selected brand. Ignore it without creating a turn,\n      // hold, or validation issue.\n      return "none";',
)
orient = require_sub(
    orient,
    r'  function enabled\(item\) \{[\s\S]*?\n  \}',
    '''  function enabled(item) {
    return item?.kind === "sensor" && Boolean(item.orientBottle ?? item.servoAssist);
  }''',
    "map-object-orientation enabled",
)
orient = require_sub(
    orient,
    r'  function orientationTarget\(\{[\s\S]*?\n  function isPhysicalContactTransition',
    '''  function orientationTarget({
    item,
    currentPlate,
    applicationTarget: application,
    labelWidthDeg,
    labelCenter,
    sensorTarget,
    sensorVisibilityPercent = 100
  } = {}) {
    const width = Math.min(FULL_CYCLE_DEG, Math.max(0.1, finite(labelWidthDeg, 0.1)));
    const center = finite(labelCenter, finite(application, 0));
    const required = Math.min(100, Math.max(1, finite(item?.requiredVisibilityPercent, 50)));
    const current = finite(currentPlate, center);
    const rawTarget = nearestEquivalent(finite(sensorTarget, center), current);
    const target = sameCommandAngle(rawTarget, current) ? current : rawTarget;
    return {
      target,
      mode: "label-center",
      required,
      visibility: finite(sensorVisibilityPercent, 100),
      center,
      width,
      satisfiedAtCommandResolution: target === current
    };
  }

  function isPhysicalContactTransition''',
    "map-object-orientation target",
)
orient = orient.replace('dependencies: ["profile.coderOrientation"],', 'dependencies: [],')
if re.search(r"coder|coding|code-box|codeBox", orient, re.I):
    raise RuntimeError("map-object-orientation-driver.js still contains coder logic")
write("drivers/profile/map-object-orientation-driver.js", orient)

planner_driver = read("drivers/profile/orientation-constraint-planner-driver.js")
planner_driver = require_replace(
    planner_driver,
    '''      const fallback = activeFallback(activeApplications);
      return {
        section: item?.kind === "coding" ? fallback : explicit,
        source: item?.kind === "coding" ? "manual-inactive-fallback" : "manual-inactive",
        application: null
      };''',
    '''      return {
        section: "none",
        source: "manual-inactive",
        application: null
      };''',
    "orientation constraint manual inactive",
)
planner_driver = require_sub(
    planner_driver,
    r'  function objectSatisfied\(object, plateAngle, visibilityAt\) \{[\s\S]*?\n  const api =',
    '''  function objectSatisfied(object, plateAngle, visibilityAt) {
    return sensorSatisfied(object, plateAngle, visibilityAt);
  }

  function chooseSharedTarget({ objects = [], currentPlate = 0, visibilityAt } = {}) {
    const source = Array.isArray(objects) ? objects : [];
    const candidates = [
      finite(currentPlate, 0),
      ...source.map((object) => finite(object?.target?.target, NaN)).filter(Number.isFinite)
    ];
    const unique = candidates.filter((candidate, index) =>
      candidates.findIndex((other) => sameCommandAngle(other, candidate)) === index);
    const valid = unique.filter((candidate) => source.every((object) => objectSatisfied(object, candidate, visibilityAt)));
    if (!valid.length) return { compatible: false, reason: "sensor-ranges-do-not-intersect" };
    valid.sort((left, right) => Math.abs(left - currentPlate) - Math.abs(right - currentPlate));
    return {
      compatible: true,
      reason: sameCommandAngle(valid[0], currentPlate) ? "existing-angle-satisfies-group" : "shared-sensor-target",
      target: valid[0]
    };
  }

  const api =''',
    "orientation constraint shared target",
)
planner_driver = planner_driver.replace("    uniqueCoderTargets,\n", "")
if re.search(r"coder|coding", planner_driver, re.I):
    raise RuntimeError("orientation-constraint-planner-driver.js still contains coder logic")
write("drivers/profile/orientation-constraint-planner-driver.js", planner_driver)

target = read("app/orientation-constraint-target-service.js")
target = require_sub(
    target,
    r'  function geometry\(section\) \{[\s\S]*?\n  \}',
    '''  function geometry(section) {
    const wipe = typeof global.sectionWipePlan === "function" ? global.sectionWipePlan(section) : null;
    const width = Math.min(360, Math.max(0.1, num(wipe?.labelDeg, 0.1)));
    return { width };
  }''',
    "orientation target geometry",
)
target = require_replace(
    target,
    '''      sensorTarget: sensorPlan?.target,
      sensorVisibilityPercent: sensorPlan?.visibility?.percent,
      coderCenterlineTarget: global.state?.motionPlan?.coderCenterlineTarget,
      codeBoxOffsetDeg: shape.code,
      inspectionOffsetDeg: shape.inspection
    }) || {
      target: item.kind === "sensor" ? sensorPlan?.target ?? bottleAngleForSensorView(item, center) : currentPlate,
      mode: item.kind === "coding" ? "code-box" : "label-center",''',
    '''      sensorTarget: sensorPlan?.target,
      sensorVisibilityPercent: sensorPlan?.visibility?.percent
    }) || {
      target: sensorPlan?.target ?? bottleAngleForSensorView(item, center),
      mode: "label-center",''',
    "orientation target service coder arguments",
)
target = require_sub(
    target,
    r'  function enabled\(item\) \{[\s\S]*?\n  \}',
    '''  function enabled(item) {
    return item?.kind === "sensor"
      && item.enabled !== false
      && Boolean(item.orientBottle ?? item.servoAssist);
  }''',
    "orientation target service enabled",
)
if re.search(r"coder|coding|codeBox|code-box", target, re.I):
    raise RuntimeError("orientation-constraint-target-service.js still contains coder logic")
write("app/orientation-constraint-target-service.js", target)

row_builder = read("drivers/profile/map-object-row-builder-driver.js")
row_builder = row_builder.replace('      codingObjectId: item?.kind === "coding" ? item?.id : undefined,\n', '')
row_builder = require_sub(
    row_builder,
    r'\n  function coderHandoffPlan\([\s\S]*?\n  \}\n\n  const api',
    "\n\n  const api",
    "row builder coder handoff",
)
row_builder = row_builder.replace("    coderHandoffPlan,\n", "")
row_builder = row_builder.replace(
    'dependencies: ["profile.mapObjectOrientation", "profile.coderHandoff"],',
    'dependencies: ["profile.mapObjectOrientation"],',
)
if re.search(r"coder|coding", row_builder, re.I):
    raise RuntimeError("map-object-row-builder-driver.js still contains coder logic")
write("drivers/profile/map-object-row-builder-driver.js", row_builder)

issue_factory = read("drivers/profile/orientation-issue-factory-driver.js")
issue_factory = issue_factory.replace(
    "The sensor/coder cannot take control of the servo",
    "The sensor cannot take control of the servo",
)
issue_factory = require_sub(
    issue_factory,
    r'\n  function baseIssueExtras\([\s\S]*?\n  const api',
    "\n\n  const api",
    "orientation issue coder functions",
)
for line in [
    "    coderWindowUnavailable,\n",
    "    coderHandoffCapacity,\n",
    "    coderHandoffStatus,\n",
]:
    issue_factory = issue_factory.replace(line, "")
issue_factory = issue_factory.replace(
    'dependencies: ["profile.mapObjectOrientation", "profile.coderHandoff"],',
    'dependencies: ["profile.mapObjectOrientation"],',
)
if re.search(r"coder|coding", issue_factory, re.I):
    raise RuntimeError("orientation-issue-factory-driver.js still contains coder logic")
write("drivers/profile/orientation-issue-factory-driver.js", issue_factory)

for path in ["app/sensor-station-cycle-anchor-integration.js", "app/controllers/sensor-activation-controller.js"]:
    text = read(path).replace('dependencies: ["profile.coderOrientation"],', 'dependencies: [],')
    write(path, text)

program_planner = read("app/orientation-constraint-program-planner.js")
program_planner = require_sub(
    program_planner,
    r'  function stripGeneratedRows\(rows\) \{[\s\S]*?\n  function activePhysicalMotion',
    '''  function stripGeneratedRows(rows) {
    return rows.filter((row) => {
      if (row?.terminalRest) return true;
      if (row?.mapObjectOrientation
        || row?.orientationHold
        || row?.mapObjectOrientationContinuation
        || row?.orientationConstraintContinuation
        || row?.sensorRelease
        || row?.orientationRelease
        || row?.sensorId
        || row?.orientationConstraintMerged) return false;
      return !/(?:orient|hold|continue).*?(?:sensor|label inspection)|return.*(?:bottle|plate|orientation)|release.*(?:sensor|inspection)/i
        .test(String(row?.action || ""));
    });
  }

  function activePhysicalMotion''',
    "orientation program planner strip rows",
)
program_planner = require_sub(
    program_planner,
    r'  function groupLabel\(objects\) \{[\s\S]*?\n  \}',
    '''  function groupLabel(objects) {
    return objects.map((object) => object.item.name || "Label Sensor").join(" + ");
  }''',
    "orientation program planner group label",
)
program_planner = require_sub(
    program_planner,
    r'  function metadata\(objects\) \{[\s\S]*?\n  \}',
    '''  function metadata(objects) {
    const sections = [...new Set(objects.map((object) => object.section))];
    const sources = [...new Set(objects.map((object) => object.sectionResolution.source))];
    const sensorIds = objects.map((object) => object.item.id);
    return {
      section: sections.length === 1 ? sections[0] : "shared",
      orientationSections: sections,
      station: objects[0]?.item?.station,
      mapDriven: true,
      mapObjectOrientation: true,
      orientationConstraintPlanner: true,
      orientationConstraintMerged: objects.length > 1,
      orientationObjectId: objects[0]?.item?.id,
      orientationObjectIds: objects.map((object) => object.item.id),
      sensorId: sensorIds[0],
      sensorIds,
      autoTargetSource: sources.length === 1 ? sources[0] : "mixed"
    };
  }''',
    "orientation program planner metadata",
)
program_planner = program_planner.replace(
    'name: object.item.name || (object.item.kind === "coding" ? "Coder" : "Label Sensor"),',
    'name: object.item.name || "Label Sensor",',
)
program_planner = program_planner.replace(
    '.filter((item) => ["sensor", "coding"].includes(item?.kind) && svc.enabled(item))',
    '.filter((item) => item?.kind === "sensor" && svc.enabled(item))',
)
program_planner = program_planner.replace("            && !/^coder-/.test(code)\n", "")
if re.search(r"coder|coding|code box", program_planner, re.I):
    raise RuntimeError("orientation-constraint-program-planner.js still contains coder logic")
write("app/orientation-constraint-program-planner.js", program_planner)

planner_integration = read("app/orientation-constraint-planner-integration.js")
planner_integration = planner_integration.replace(
    " Its correction is merged with the overlapping coder/sensor orientation.",
    " Its correction is merged with the overlapping sensor orientation.",
)
planner_integration = planner_integration.replace(
    '      || !pipeline?.registerStage\n      || !pipeline.getStage?.(STAGE_ID)) return false;',
    '      || !pipeline?.registerStage) return false;',
)
planner_integration = planner_integration.replace(
    "Resolve the last applied label and merge compatible sensor/coder orientation turns.",
    "Resolve the last applied label and merge compatible sensor orientation turns.",
)
if re.search(r"coder|coding", planner_integration, re.I):
    raise RuntimeError("orientation-constraint-planner-integration.js still contains coder logic")
write("app/orientation-constraint-planner-integration.js", planner_integration)

sensor_fix = read("app/sensor-orientation-default-map-fix-integration.js")
sensor_fix = sensor_fix.replace("    if (!item) return;", '    if (!item || item.kind !== "sensor") return;', 1)
sensor_fix = require_sub(
    sensor_fix,
    r'    if \(field === "orientationLabelSection"\) \{[\s\S]*?\n    \} else if \(field === "orientationTarget"\) \{[\s\S]*?\n    \}',
    '''    if (field === "orientationLabelSection") {
      item.orientationLabelSection = policy()?.normalizeSelection({
        selection: control.value,
        ...policyOptions(item, map)
      }) || control.value;
    }''',
    "sensor orientation save field",
)
sensor_fix = require_sub(
    sensor_fix,
    r'  function orientationControls\(item, map\) \{[\s\S]*?\n  \}',
    '''  function orientationControls(item, map) {
    return `<div class="map-object-orientation-fields corrected-orientation-fields" data-orientation-object-id="${escapeHtml(item.id)}">
      <label>Inspection label<select data-corrected-orientation-field="orientationLabelSection">${sectionOptions(item, map)}</select><small>Only labels applied before this sensor are available. Auto uses the last completed label application.</small></label>
    </div>`;
  }''',
    "sensor orientation controls",
)
sensor_fix = sensor_fix.replace(
    '      if (!["sensor", "coding"].includes(item.kind)) return;',
    '      if (item.kind !== "sensor") return;',
)
if re.search(r"coder|coding|code-box|codeBox", sensor_fix, re.I):
    raise RuntimeError("sensor-orientation-default-map-fix-integration.js still contains coder UI logic")
write("app/sensor-orientation-default-map-fix-integration.js", sensor_fix)


# ---------------------------------------------------------------------------
# Terminal policy no longer has a coding-specific terminal branch.
# ---------------------------------------------------------------------------
terminal_policy = read("app/machine-terminal-policy-integration.js")
terminal_policy = require_sub(
    terminal_policy,
    r'\n  function isCodingHold\(row\) \{[\s\S]*?\n  \}',
    "",
    "machine terminal coding helper",
)
terminal_policy = require_sub(
    terminal_policy,
    r'  function topModulTerminalRows\(rows\) \{[\s\S]*?\n  function syncPlan',
    '''  function topModulTerminalRows(rows) {
    const source = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    if (!source.length) return source;
    const finalRow = source[source.length - 1];
    finalRow.cmd = 3;
    finalRow.baseCmd = 3;
    finalRow.terminalRest = true;
    finalRow.activeHold = false;
    finalRow.plannerIntent = "HOLD";
    finalRow.plannerRequestedCommand = 3;
    finalRow.plannerRecommendedCommand = 3;
    finalRow.translatedCommandName = restCommandName();
    finalRow.commandTranslated = false;
    return source.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
  }

  function syncPlan''',
    "machine terminal TopModul rows",
)
if re.search(r"coder|coding|code box|codingHold|codingWindow", terminal_policy, re.I):
    raise RuntimeError("machine-terminal-policy-integration.js still contains coder terminal logic")
write("app/machine-terminal-policy-integration.js", terminal_policy)

for path in ["app/apl-post-wipe-sensor-hold-integration.js", "drivers/profile/sensor-post-inspection-release-driver.js"]:
    text = read(path)
    text = re.sub(r'^\s*"codingObjectId",\n', "", text, flags=re.M)
    text = re.sub(r'^\s*"codingObjectIds",\n', "", text, flags=re.M)
    write(path, text)


# ---------------------------------------------------------------------------
# Outermost APL invariant: final physical aggregate hold is the final row.
# ---------------------------------------------------------------------------
write(
    "app/apl-final-aggregate-terminal-integration.js",
    r'''"use strict";

(function installAplFinalAggregateTerminal(global) {
  if (global.LabelerAplFinalAggregateTerminal?.installed) return;

  const RETRY_MS = 25;
  let installed = false;

  const number = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function isApl(map = activeMap()) {
    return String(global.state?.applicationMode || map?.applicationMode || "apl").toLowerCase() === "apl";
  }

  function finalAggregateNumber(map, rows = []) {
    const candidates = [];
    const configured = number(map?.aggregateCount, NaN);
    if (Number.isFinite(configured)) candidates.push(configured);
    Object.keys(map?.aggregateAngles || {}).forEach((key) => {
      const station = Number(key);
      if (Number.isFinite(station)) candidates.push(station);
    });
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const station = number(row?.station, NaN);
      if (Number.isFinite(station)) candidates.push(station);
      const match = String(row?.action || "").match(/\bAgg\s*(\d+)\b/i);
      if (match) candidates.push(Number(match[1]));
    });
    return candidates.length ? Math.max(...candidates.filter(Number.isFinite)) : NaN;
  }

  function belongsToAggregate(row, aggregate) {
    if (!row || !Number.isFinite(aggregate)) return false;
    if (number(row.station, NaN) === aggregate) return true;
    return new RegExp(`\\bAgg\\s*${aggregate}\\b`, "i").test(String(row.action || ""));
  }

  function isPhysicalAggregateHold(row, aggregate) {
    if (!belongsToAggregate(row, aggregate) || Number(row?.cmd) !== 3) return false;
    const action = String(row?.action || "");
    return row?.stage === "complete"
      || row?.wipeReference === true
      || /wipe\s+hold|wipe.*rest|(?:hold|rest|complete).*agg/i.test(action);
  }

  function terminalIndex(rows, aggregate) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (isPhysicalAggregateHold(rows[index], aggregate)) return index;
    }
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (belongsToAggregate(rows[index], aggregate) && Number(rows[index]?.cmd) === 3) return index;
    }
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (belongsToAggregate(rows[index], aggregate)) return index;
    }
    return -1;
  }

  function canonicalRows(sourceRows, map = activeMap()) {
    const source = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!source.length || !isApl(map)) return source;
    const aggregate = finalAggregateNumber(map, source);
    const index = terminalIndex(source, aggregate);
    if (index < 0) return source;

    const rows = source.slice(0, index + 1);
    rows[index] = {
      ...rows[index],
      cmd: 3,
      baseCmd: 3,
      terminalRest: true,
      activeHold: false,
      aggregateTerminal: true,
      terminalAggregate: aggregate,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3
    };
    return rows.map((row, rowIndex) => ({ ...row, hmi: rowIndex + 1, plc: rowIndex }));
  }

  function syncPlan(plan, rows) {
    if (!plan || !Array.isArray(plan.steps)) return;
    plan.steps = rows.map((row, index) => ({
      ...(plan.steps[index] || {}),
      index,
      hmi: row.hmi,
      plc: row.plc,
      tableAngle: number(row.tableAngle, 0),
      plateAngle: number(row.plateAngle, 0),
      action: String(row.action || ""),
      baseCommand: number(row.baseCmd, number(row.cmd, 3)),
      requestedCommand: number(row.plannerRequestedCommand, number(row.cmd, 3)),
      recommendedCommand: number(row.cmd, 3),
      intent: row.plannerIntent || (Number(row.cmd) === 7 ? "ROTATE" : "HOLD"),
      terminal: row.terminalRest === true
    }));
    if (Array.isArray(plan.events)) plan.events = plan.events.slice(0, rows.length);
  }

  function synchronize(rows) {
    if (!Array.isArray(rows) || !rows.length || !global.state) return rows;
    global.state.program = rows;
    const finalRow = rows.at(-1);
    const aggregate = finalRow?.terminalAggregate;

    if (global.state.motionPlan) {
      global.state.motionPlan.rows = rows;
      global.state.motionPlan.finalPlateAngle = finalRow?.plateAngle;
      global.state.motionPlan.finalAggregateTerminal = true;
      global.state.motionPlan.termination = {
        ...(global.state.motionPlan.termination || {}),
        section: finalRow?.section || global.state.motionPlan.termination?.section || "none",
        station: aggregate,
        hmi: finalRow?.hmi,
        tableAngle: finalRow?.tableAngle,
        command: "Rest"
      };
      syncPlan(global.state.motionPlan.planner, rows);
    }
    if (global.state.motionTranslation) {
      global.state.motionTranslation.rows = rows;
      syncPlan(global.state.motionTranslation.plan, rows);
    }
    syncPlan(global.state.plannerPreview, rows);
    return rows;
  }

  function finalizeCurrentProgram(output) {
    const source = Array.isArray(global.state?.program) && global.state.program.length
      ? global.state.program
      : output;
    return synchronize(canonicalRows(source));
  }

  function latePipelineReady() {
    return global.LabelerProfilePipelineOrchestratorInstalled === true
      && global.LabelerOrientationConstraintPlannerInstalled === true
      && global.LabelerTopModulCorrectionChainLimit?.installed === true;
  }

  function install() {
    if (installed) return true;
    if (!global.state
      || typeof global.applyGeneratedServoProfile !== "function"
      || !latePipelineReady()) return false;

    const base = global.applyGeneratedServoProfile;
    global.applyGeneratedServoProfile = function applyGeneratedServoProfileWithFinalAggregateTerminal(...args) {
      const output = base.apply(this, args);
      return finalizeCurrentProgram(output);
    };

    global.LabelerAplFinalAggregateTerminal = Object.freeze({
      installed: true,
      version: 1,
      finalAggregateNumber,
      belongsToAggregate,
      isPhysicalAggregateHold,
      terminalIndex,
      canonicalRows,
      finalizeCurrentProgram
    });
    installed = true;

    try {
      global.applyGeneratedServoProfile();
      global.render?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply final aggregate terminal policy.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
''',
)


# ---------------------------------------------------------------------------
# Delete dedicated coder-servo implementation and obsolete coder tests.
# ---------------------------------------------------------------------------
retired_files = [
    "app/clockwise-code-box-orientation-integration.js",
    "app/topmodul-coder-prehold-finalizer-integration.js",
    "app/coder-window-reference-handoff-integration.js",
    "app/map-object-coder-after-wipe-integration.js",
    "app/controllers/coding-cycle-normalization-controller.js",
    "app/coder-rest-grammar-repair-integration.js",
    "drivers/profile/coder-orientation-driver.js",
    "drivers/profile/coder-handoff-driver.js",
]
for path in retired_files:
    target = ROOT / path
    if target.exists():
        target.unlink()

for path in [
    "tests/coder-hold-allowed-corrections-and-neck-progress.test.js",
    "tests/coder-orientation-driver.test.js",
    "tests/coder-window-reference-handoff.test.js",
    "tests/coding-cycle-normalization.test.js",
    "tests/map-double-click-coder-segment-grammar.test.js",
    "tests/topmodul-terminal-coding-hold.test.js",
    ".github/workflows/validate-coder-hold-allowed-corrections.yml",
    ".github/workflows/validate-coder-window-reference-handoff.yml",
]:
    target = ROOT / path
    if target.exists():
        target.unlink()

sw = read("service-worker.js")
sw = remove_lines_containing(sw, [f'"./{path}"' for path in retired_files])
if '"./app/apl-final-aggregate-terminal-integration.js"' not in sw:
    anchor = '  "./app/topmodul-allowed-correction-diagnostics-integration.js",\n'
    if anchor in sw:
        sw = sw.replace(anchor, '  "./app/apl-final-aggregate-terminal-integration.js",\n' + anchor, 1)
    else:
        sw = sw.replace(
            '  "./app/update-manager.js",\n',
            '  "./app/apl-final-aggregate-terminal-integration.js",\n  "./app/update-manager.js",\n',
            1,
        )
write("service-worker.js", sw)

manifest_path = ROOT / "update-manifest.json"
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["buildId"] = "coding-disabled-aggregate6-terminal-v49-20260809-2103"
    manifest["notes"] = (
        "Staging: coding servo generation is disabled. APL servo programs terminate at the final physical "
        "aggregate hold; the six-aggregate map has no moves after Aggregate 6."
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Regression and permanent validation workflow.
# ---------------------------------------------------------------------------
write(
    "tests/apl-final-aggregate-terminal.test.js",
    r'''"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const finalizerSource = fs.readFileSync(path.join(root, "app", "apl-final-aggregate-terminal-integration.js"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "app", "apl-map-profile-generation.js"), "utf8");
const seedSource = fs.readFileSync(path.join(root, "app", "apl-seed-profile.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const featureSource = fs.readFileSync(path.join(root, "app", "simulation-collapsible-integration.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(finalizerSource, { filename: "apl-final-aggregate-terminal-integration.js" }));
assert.doesNotMatch(generatorSource, /Direct Turn for Coding|Hold for Coding|codingWindow|codingObject/);
assert.doesNotMatch(seedSource, /Turn for Coding|Hold for Coding|codingWindow|codingObject/);
assert.doesNotMatch(appSource, /coder-window-reference-handoff-integration\.js/);
assert.doesNotMatch(bootstrapSource, /coding-cycle-normalization-controller\.js|topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrapSource, /apl-final-aggregate-terminal-integration\.js/);
assert.doesNotMatch(featureSource, /coder-orientation-driver|coder-handoff-driver|map-object-coder-after-wipe|clockwise-code-box-orientation|coder-rest-grammar-repair/);

let timeoutCallback = null;
const context = {
  console,
  state: { applicationMode: "apl", program: [] },
  activeMachineMap() {
    return { applicationMode: "apl", aggregateCount: 6, aggregateAngles: { 1: 10, 2: 50, 3: 100, 4: 150, 5: 200, 6: 250 } };
  },
  applyGeneratedServoProfile() {},
  LabelerProfilePipelineOrchestratorInstalled: true,
  LabelerOrientationConstraintPlannerInstalled: true,
  LabelerTopModulCorrectionChainLimit: { installed: true },
  setTimeout(callback) { timeoutCallback = callback; }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(finalizerSource, context);
if (!context.LabelerAplFinalAggregateTerminal?.installed && timeoutCallback) timeoutCallback();
const policy = context.LabelerAplFinalAggregateTerminal;
assert.equal(policy?.installed, true);

const sourceRows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 250.5, plateAngle: 287, station: 6, section: "back", action: "Wipe Turn 2 Back - Agg 6" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 290, plateAngle: 287, station: 6, section: "back", stage: "complete", action: "Wipe Hold Back - Agg 6" },
  { hmi: 4, plc: 3, cmd: 7, tableAngle: 290.5, plateAngle: 287, action: "obsolete post-aggregate move" },
  { hmi: 5, plc: 4, cmd: 3, tableAngle: 304, plateAngle: 180, action: "obsolete post-aggregate hold" },
  { hmi: 6, plc: 5, cmd: 7, tableAngle: 320, plateAngle: 180, station: 6, section: "back", sensorId: "late-sensor", action: "Orient Back Label for Sensor - Station 6" }
];
const rows = policy.canonicalRows(sourceRows, context.activeMachineMap());
assert.equal(rows.length, 3);
assert.equal(rows.at(-1).action, "Wipe Hold Back - Agg 6");
assert.equal(rows.at(-1).cmd, 3);
assert.equal(rows.at(-1).tableAngle, 290);
assert.equal(rows.at(-1).terminalRest, true);
assert.equal(rows.at(-1).aggregateTerminal, true);
assert.equal(rows.at(-1).terminalAggregate, 6);
assert.equal(rows.some((row) => Number(row.tableAngle) > 290), false);

console.log("APL final Aggregate 6 terminal regression passed.");
''',
)

write(
    ".github/workflows/validate-no-coding-runtime.yml",
    '''name: Validate no coding servo runtime

on:
  push:
    branches: [main]
    paths:
      - "app/**"
      - "drivers/profile/**"
      - "service-worker.js"
      - "tests/apl-final-aggregate-terminal.test.js"
      - ".github/workflows/validate-no-coding-runtime.yml"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Syntax checks
        run: |
          node --check app/apl-final-aggregate-terminal-integration.js
          node --check app/apl-map-profile-generation.js
          node --check app/apl-seed-profile.js
          node --check app/orientation-constraint-target-service.js
          node --check app/orientation-constraint-program-planner.js
          node --check drivers/profile/map-object-orientation-driver.js
          node --check drivers/profile/orientation-constraint-planner-driver.js
          node --check drivers/profile/map-object-row-builder-driver.js
          node --check drivers/profile/orientation-issue-factory-driver.js
      - name: Verify no post-final-aggregate motion
        run: node tests/apl-final-aggregate-terminal.test.js
      - name: Verify retired coder modules are not loaded
        run: |
          ! grep -E 'coder-orientation-driver|coder-handoff-driver|map-object-coder-after-wipe|coder-window-reference-handoff|coding-cycle-normalization|topmodul-coder-prehold|clockwise-code-box-orientation|coder-rest-grammar-repair' app.js app/bootstrap.js app/simulation-collapsible-integration.js
          ! grep -E 'Direct Turn for Coding|Hold for Coding|Turn for Coding|codingWindow|codingObject' app/apl-map-profile-generation.js app/apl-seed-profile.js
''',
)

# Remove one-time scaffolding from the final commit.
for path in [
    ".github/workflows/audit-coding-runtime.yml",
    ".github/workflows/remove-coding-runtime-once.yml",
    "tools/remove_coding_runtime.py",
]:
    target = ROOT / path
    if target.exists():
        target.unlink()

print("Coding servo runtime sweep prepared successfully.")
