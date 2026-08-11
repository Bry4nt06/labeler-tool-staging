from pathlib import Path
import json,re

BUILD='map-machine-settings-wipe-direction-v87-20260811-1940'
UPDATED='Aug 11, 2026 7:40 PM ET'

# 1) Make machine-setting fields keyboard-friendly and route their committed
# values directly to the authoritative map-definition mutation.
p=Path('app/controllers/map-builder-event-controller.js')
s=p.read_text()
old='''  const definitionFields = new Set([\n    "mapName",\n    "mapHeadCount",\n    "mapRadius",\n    "mapReferencePitchRadiusMm",\n    "mapEncoderCountsPerRev",\n    "mapServoGearRatio",\n    "mapZeroAngle",\n    "mapMaxMoveRatio"\n  ]);\n'''
new='''  const liveDefinitionFields = new Set([\n    "mapName",\n    "mapHeadCount"\n  ]);\n  const machineSettingFields = new Set([\n    "mapRadius",\n    "mapReferencePitchRadiusMm",\n    "mapEncoderCountsPerRev",\n    "mapServoGearRatio",\n    "mapZeroAngle",\n    "mapMaxMoveRatio"\n  ]);\n  const definitionFields = new Set([...liveDefinitionFields, ...machineSettingFields]);\n\n  function saveDefinition(eventType = "change") {\n    // Machine settings are core map data. Prefer the authoritative global domain\n    // mutation so a stale/frozen controller wrapper cannot swallow the edit.\n    if (typeof global.saveMapDefinitionFromControls === "function") {\n      return global.saveMapDefinitionFromControls({ type: eventType });\n    }\n    return builder.saveDefinition(eventType);\n  }\n'''
assert old in s
s=s.replace(old,new,1)
old='''  document.addEventListener("input", (event) => {\n    const target = event.target;\n    if (!(target instanceof Element) || !definitionFields.has(target.id)) return;\n    builder.saveDefinition("input");\n    consume(event);\n  }, true);\n'''
new='''  document.addEventListener("input", (event) => {\n    const target = event.target;\n    if (!(target instanceof Element) || !definitionFields.has(target.id)) return;\n    // Numeric machine settings must remain freely editable while the user is\n    // typing. Committing an incomplete value (for example the empty state while\n    // replacing 250) caused the control to snap back immediately.\n    if (machineSettingFields.has(target.id)) return;\n    saveDefinition("input");\n    consume(event);\n  }, true);\n'''
assert old in s
s=s.replace(old,new,1)
s=s.replace('''    if (definitionFields.has(target.id)) builder.saveDefinition("change");\n    else if (target.id === "builderObjectType") builder.updateObjectType();\n    else if (target.id === "mapMachineType") builder.saveDefinition("change");\n    else if (target.id === "mapDirection") builder.saveDefinition("change");\n    else if (target.id === "mapAutoScaleTableMap") builder.saveDefinition("change");\n''','''    if (definitionFields.has(target.id)) saveDefinition("change");\n    else if (target.id === "builderObjectType") builder.updateObjectType();\n    else if (target.id === "mapMachineType") saveDefinition("change");\n    else if (target.id === "mapDirection") saveDefinition("change");\n    else if (target.id === "mapAutoScaleTableMap") saveDefinition("change");\n''',1)
s=s.replace('''    installed: true,\n    definitionFields\n''','''    installed: true,\n    definitionFields,\n    liveDefinitionFields,\n    machineSettingFields,\n    directMachineSettingsCommitV87: true,\n    machineSettingsCommitOnChangeV87: true\n''',1)
p.write_text(s)

# 2) Harden the map-definition writer against transient blank numeric values and
# mark local machine-setting overrides so protected defaults can preserve them.
p=Path('app/map-builder-controller.js')
s=p.read_text()
anchor='''function saveMapDefinitionFromControls(event) {\n'''
assert anchor in s
helper='''function machineSettingNumber(control, currentValue, minimum = null) {\n  const raw = String(control?.value ?? "").trim();\n  const current = Number(currentValue);\n  if (!raw) return Number.isFinite(current) ? current : 0;\n  const parsed = Number(raw);\n  if (!Number.isFinite(parsed)) return Number.isFinite(current) ? current : 0;\n  return minimum == null ? parsed : Math.max(minimum, parsed);\n}\n\nfunction saveMapDefinitionFromControls(event) {\n'''
s=s.replace(anchor,helper,1)
old='''  map.machineSettings = {\n    direction: els.mapDirection?.value === "cw" ? "cw" : "ccw",\n    radius: Math.max(1, num(els.mapRadius?.value, map.machineSettings?.radius)),\n    referencePitchRadiusMm: Math.max(1, num(els.mapReferencePitchRadiusMm?.value, map.machineSettings?.referencePitchRadiusMm)),\n    encoderCountsPerRev: Math.max(1, num(els.mapEncoderCountsPerRev?.value, map.machineSettings?.encoderCountsPerRev)),\n    servoGearRatio: Math.max(0.001, num(els.mapServoGearRatio?.value, map.machineSettings?.servoGearRatio)),\n    autoScaleTableMap: Boolean(els.mapAutoScaleTableMap?.checked),\n    zeroAngle: norm(num(els.mapZeroAngle?.value, map.machineSettings?.zeroAngle)),\n    maxMoveRatio: Math.max(0.1, num(els.mapMaxMoveRatio?.value, map.machineSettings?.maxMoveRatio))\n  };\n'''
new='''  map.machineSettings = {\n    direction: els.mapDirection?.value === "cw" ? "cw" : "ccw",\n    radius: machineSettingNumber(els.mapRadius, map.machineSettings?.radius, 1),\n    referencePitchRadiusMm: machineSettingNumber(els.mapReferencePitchRadiusMm, map.machineSettings?.referencePitchRadiusMm, 1),\n    encoderCountsPerRev: machineSettingNumber(els.mapEncoderCountsPerRev, map.machineSettings?.encoderCountsPerRev, 1),\n    servoGearRatio: machineSettingNumber(els.mapServoGearRatio, map.machineSettings?.servoGearRatio, 0.001),\n    autoScaleTableMap: Boolean(els.mapAutoScaleTableMap?.checked),\n    zeroAngle: norm(machineSettingNumber(els.mapZeroAngle, map.machineSettings?.zeroAngle)),\n    maxMoveRatio: machineSettingNumber(els.mapMaxMoveRatio, map.machineSettings?.maxMoveRatio, 0.1)\n  };\n  // Protected/company maps stay protected, but a user's local machine setup is\n  // allowed to differ from the packaged template until they perform a reset.\n  map.localMachineSettingsOverride = true;\n'''
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# 3) Preserve local machine-setting overrides while continuing to refresh all
# other protected/default-map content from the repository catalog.
p=Path('app/company-default-map-catalog-integration.js')
s=p.read_text()
old='''    const catalog = await service.loadCatalog();\n    const official = approvedMaps(catalog);\n'''
new='''    const catalog = await service.loadCatalog();\n    const currentBeforeEnforcement = Array.isArray(global.state.mapLibrary) ? global.state.mapLibrary : [];\n    const localById = new Map(currentBeforeEnforcement.map((map) => [key(map?.id), map]));\n    const official = approvedMaps(catalog).map((packaged) => {\n      const local = localById.get(key(packaged?.id));\n      if (!local?.localMachineSettingsOverride) return packaged;\n      return {\n        ...packaged,\n        machineSettings: clone(local.machineSettings || packaged.machineSettings),\n        localMachineSettingsOverride: true\n      };\n    });\n'''
assert old in s
s=s.replace(old,new,1)
s=s.replace('''    const current = Array.isArray(global.state.mapLibrary) ? global.state.mapLibrary : [];\n''','''    const current = currentBeforeEnforcement;\n''',1)
s=s.replace('''      approvedMaps,\n      isRetiredPackagedMap,\n      enforce\n''','''      approvedMaps,\n      isRetiredPackagedMap,\n      enforce,\n      localMachineSettingsOverrideV87: true\n''',1)
p.write_text(s)

# 4) Source wipe direction from the active map machine setting. This keeps the
# panel in physical parity with the Mechanical Map: CW L->R, CCW R->L.
p=Path('app/wipe-telemetry-service.js')
s=p.read_text()
anchor='''function wipeVisualApplication(section, labelLengthMm) {\n'''
assert anchor in s
helper='''function liveWipeMachineDirection() {\n  try {\n    const configured = String(activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();\n    if (configured === "cw" || configured === "ccw") return configured;\n  } catch {\n    // Fall back to the synchronized runtime direction below.\n  }\n  return String(state.direction || "").toLowerCase() === "cw" ? "cw" : "ccw";\n}\n\nfunction wipeVisualApplication(section, labelLengthMm) {\n'''
s=s.replace(anchor,helper,1)
s=s.replace('''  const direction = state.direction === "cw" ? "ltr" : "rtl";\n''','''  const direction = liveWipeMachineDirection() === "cw" ? "ltr" : "rtl";\n''',1)
s=s.replace('''function wipeVisualSideForPlateTravel(plateTravel, machineDirection = state.direction) {\n''','''function wipeVisualSideForPlateTravel(plateTravel, machineDirection = liveWipeMachineDirection()) {\n''',1)
s=s.replace('''  wipeVisualApplication,\n''','''  liveWipeMachineDirection,\n  wipeVisualApplication,\n''',1)
p.write_text(s)

# 5) Bump the dynamic Map Builder loader so clients definitely receive the
# edited controller rather than reusing the old v71 query identity.
p=Path('app/wipe-down-builder.js')
s=p.read_text()
s=re.sub(r'const releaseVersion = "[^"]+";', 'const releaseVersion = "0.9.10-map-machine-settings-v87";', s, count=1)
p.write_text(s)

# 6) Build/update identity.
p=Path('app/bootstrap.js')
s=p.read_text()
s=re.sub(r'const build = "[^"]+";',f'const build = "{BUILD}";',s,count=1)
s=re.sub(r'const buildUpdatedAt = "[^"]+";',f'const buildUpdatedAt = "{UPDATED}";',s,count=1)
s=s.replace('// Regression lineage:',f'// Regression lineage: {BUILD} •',1)
p.write_text(s)

p=Path('app/update-manager.js')
s=p.read_text(); s=re.sub(r'const BUILD_ID = "[^"]+";',f'const BUILD_ID = "{BUILD}";',s,count=1); p.write_text(s)

p=Path('service-worker.js')
s=p.read_text(); s=re.sub(r'const CACHE_NAME = "[^"]+";',f'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-{BUILD}";',s,count=1); p.write_text(s)

p=Path('update-manifest.json')
d=json.loads(p.read_text())
d['buildId']=BUILD
d['notes']='v87 keeps the confirmed Top View-only Bottle Orientation baseline unchanged, restores editable Map Builder machine settings, preserves local machine-setting overrides on protected default maps, and locks Label Wipe-Down direction to the active map: clockwise is left-to-right; counter-clockwise is right-to-left.'
p.write_text(json.dumps(d,indent=2)+'\n')

# 7) Regressions.
p=Path('tests/map-machine-settings-editability-v87.test.js')
p.write_text('''"use strict";\nconst assert=require("assert");\nconst fs=require("fs");\nconst path=require("path");\nconst root=path.resolve(__dirname,"..");\nconst events=fs.readFileSync(path.join(root,"app/controllers/map-builder-event-controller.js"),"utf8");\nconst controller=fs.readFileSync(path.join(root,"app/map-builder-controller.js"),"utf8");\nconst catalog=fs.readFileSync(path.join(root,"app/company-default-map-catalog-integration.js"),"utf8");\nconst loader=fs.readFileSync(path.join(root,"app/wipe-down-builder.js"),"utf8");\nassert.match(events,/machineSettingFields = new Set/);\nassert.match(events,/if \(machineSettingFields\.has\(target\.id\)\) return/);\nassert.match(events,/saveMapDefinitionFromControls\(\{ type: eventType \}\)/);\nassert.match(events,/machineSettingsCommitOnChangeV87: true/);\nassert.match(controller,/function machineSettingNumber/);\nassert.match(controller,/map\.localMachineSettingsOverride = true/);\nassert.match(catalog,/local\?\.localMachineSettingsOverride/);\nassert.match(catalog,/machineSettings: clone\(local\.machineSettings/);\nassert.match(loader,/0\.9\.10-map-machine-settings-v87/);\nconsole.log("Map machine settings editability v87 regression passed.");\n''')

p=Path('tests/wipe-direction-machine-parity-v87.test.js')
p.write_text('''"use strict";\nconst assert=require("assert");\nconst fs=require("fs");\nconst path=require("path");\nconst source=fs.readFileSync(path.resolve(__dirname,"../app/wipe-telemetry-service.js"),"utf8");\nconst renderer=fs.readFileSync(path.resolve(__dirname,"../app/wipe-telemetry-renderer.js"),"utf8");\nassert.match(source,/function liveWipeMachineDirection/);\nassert.match(source,/activeMachineMap\?\.\(\)\?\.machineSettings\?\.direction/);\nassert.match(source,/liveWipeMachineDirection\(\) === "cw" \? "ltr" : "rtl"/);\nassert.match(renderer,/data\.direction === "rtl"/);\nassert.match(renderer,/"Right → left"/);\nassert.match(renderer,/"Left → right"/);\nconsole.log("Wipe direction machine parity v87 regression passed: CW=L->R, CCW=R->L.");\n''')

# Lock the known-good Top View baseline into this release's regression lineage.
p=Path('tests/bottle-orientation-panel.test.js')
s=p.read_text()
s=s.replace('top-view-runtime-load-fix-v86-20260811-1932',BUILD)
s=s.replace('Top-view-only Bottle Orientation v86 regression passed.','Top-view-only Bottle Orientation v87 baseline regression passed.')
p.write_text(s)
p=Path('tests/bottle-orientation-mount-recovery.test.js')
s=p.read_text().replace('top-view-runtime-load-fix-v86-20260811-1932',BUILD)
p.write_text(s)
