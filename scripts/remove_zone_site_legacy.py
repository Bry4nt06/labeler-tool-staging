import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]


def read(path):
    return (root / path).read_text(encoding="utf-8")


def write(path, text):
    (root / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing expected source while updating {label}")
    return text.replace(old, new, 1)


# Defaults: remove abbreviation registry, state fields, and DOM handles.
path = "app/defaults.js"
text = read(path)
text, count = re.subn(
    r"const defaultZoneSiteConfiguration = Object\.freeze\(\{.*?\n\}\);\n",
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove default Zone/Site configuration")
for line in [
    '  selectedZone: "NAZ",\n',
    '  selectedSite: "FCL",\n',
    '  mapLibraryZone: "",\n',
    '  mapLibrarySite: "",\n',
    '  zoneSiteConfiguration: deepClone(defaultZoneSiteConfiguration),\n',
    '  mapZone: document.querySelector("#mapZone"),\n',
    '  mapSite: document.querySelector("#mapSite"),\n',
    '  developerZoneSiteEditor: document.querySelector("#developerZoneSiteEditor"),\n',
    '  exportZoneSiteConfig: document.querySelector("#exportZoneSiteConfig"),\n',
    '  importZoneSiteConfig: document.querySelector("#importZoneSiteConfig"),\n',
]:
    text = text.replace(line, "")
write(path, text)

# Persistence: discard legacy fields during load/import and never export them.
path = "app/persistence.js"
text = read(path)
migration = r'''
function stripDeprecatedLocationMetadata(saved) {
  if (!saved || typeof saved !== "object") return saved;
  [
    "selected" + "Zone",
    "selected" + "Site",
    "mapLibrary" + "Zone",
    "mapLibrary" + "Site",
    "zoneSite" + "Configuration"
  ].forEach((key) => delete saved[key]);
  if (Array.isArray(saved.mapLibrary)) {
    saved.mapLibrary = saved.mapLibrary.map((source) => {
      const map = source && typeof source === "object" ? { ...source } : source;
      if (map && typeof map === "object") {
        delete map.zone;
        delete map.site;
      }
      return map;
    });
  }
  return saved;
}
'''
text = replace_once(text, "\nfunction loadSavedSettings() {", migration + "\nfunction loadSavedSettings() {", path)
text = replace_once(text, "    const saved = JSON.parse(raw);", "    const saved = stripDeprecatedLocationMetadata(JSON.parse(raw));", path)
text = text.replace(', "selectedZone", "selectedSite", "mapLibraryZone", "mapLibrarySite"', "")
text = text.replace("    if (saved.zoneSiteConfiguration) state.zoneSiteConfiguration = normalizeZoneSiteConfiguration(saved.zoneSiteConfiguration);\n", "")
text = text.replace("    ensureSelectedZoneAndSite();\n", "")
for line in [
    "    selectedZone: state.selectedZone,\n",
    "    selectedSite: state.selectedSite,\n",
    "    mapLibraryZone: state.mapLibraryZone,\n",
    "    mapLibrarySite: state.mapLibrarySite,\n",
    "    zoneSiteConfiguration: state.zoneSiteConfiguration,\n",
]:
    text = text.replace(line, "")
text = replace_once(text, "      const saved = documentData.settings;", "      const saved = stripDeprecatedLocationMetadata(documentData.settings);", path)
text = replace_once(
    text,
    '    const seeded = documentData?.format === "labeler-tool-portable-settings" ? documentData.settings : documentData;',
    '    const seeded = stripDeprecatedLocationMetadata(documentData?.format === "labeler-tool-portable-settings" ? documentData.settings : documentData);',
    path,
)
text, count = re.subn(
    r"(\n    if \(saved\.simulation\) \{.*?\n    \}\n)(  \} catch \{)",
    r"\1    writeStorage(SETTINGS_KEY, JSON.stringify(settingsSnapshot()));\n\2",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to add saved-settings cleanup writeback")
write(path, text)

# Core Map Builder: maps are global records identified only by name and ID.
path = "app/wipe-down-builder.js"
text = read(path)
text, count = re.subn(
    r"function mapLocationFor\(map\) \{.*?\n\}\n\nfunction createMachineMap",
    "function createMachineMap",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove Map Builder location helpers")
text = replace_once(
    text,
    "function createMachineMap({ id, name, zone, site, machineType, applicationMode,",
    "function createMachineMap({ id, name, machineType, applicationMode,",
    path,
)
text = text.replace("  const location = mapLocationFor({ zone, site });\n", "")
text = text.replace("    zone: location.zone,\n    site: location.site,\n", "")
text = text.replace("        Object.assign(map, mapLocationFor(map));", "        delete map.zone;\n        delete map.site;")
text = replace_once(
    text,
    "  const location = mapLocationFor(map);\n  map.zone = location.zone;\n  map.site = location.site;\n  state.selectedZone = location.zone;\n  state.selectedSite = location.site;\n",
    "  delete map.zone;\n  delete map.site;\n",
    path,
)
text = replace_once(
    text,
    "  const libraryLocation = mapLibraryLocation();\n  const visibleMaps = mapsForMapLibraryLocation();",
    "  const visibleMaps = [...state.mapLibrary];",
    path,
)
text = text.replace("No maps saved for this site", "No maps saved")
text, count = re.subn(
    r"  if \(els\.mapZone\).*?\n  if \(els\.newMachineMap\) els\.newMachineMap\.disabled = libraryLocation\.zone === \"ALL\";\n",
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove Map Builder Zone/Site controls")
text, count = re.subn(
    r"  const proposedZone = .*?\n  if \(explicitSave && !window\.confirm\(`Save map .*?\n  state\.mapLibrarySite = proposedSite;\n",
    '  if (explicitSave && !window.confirm(`Save map "${proposedName}"?`)) return;\n',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove Zone/Site save logic")
text = replace_once(
    text,
    '    const location = mapLibraryLocation();\n    const copy = createMachineMap({ ...deepClone(base), id: uniqueMapId("machine-map"), name: uniqueMapName(`${base.name} Copy`), zone: location.zone, site: location.site, isTemplate: false });',
    '    const copy = createMachineMap({ ...deepClone(base), id: uniqueMapId("machine-map"), name: uniqueMapName(`${base.name} Copy`), isTemplate: false });',
    path,
)
text, count = re.subn(
    r"  els\.mapZone\?\.addEventListener\(\"change\", \(\) => \{.*?\n  \}\);\n  els\.mapSite\?\.addEventListener\(\"change\", \(\) => \{.*?\n  \}\);\n",
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove Zone/Site change handlers")
text = text.replace(
    'if (!map || !window.confirm(`Delete map "${map.name}" from ${mapLocationLabel(map)}? This cannot be undone.`)) return;',
    'if (!map || !window.confirm(`Delete map "${map.name}"? This cannot be undone.`)) return;',
)
write(path, text)

# Application shell and startup bindings.
path = "index.html"
text = read(path)
text = text.replace('                  <label>Zone<select id="mapZone"></select></label>\n', "")
text = text.replace('                  <label>Site<select id="mapSite"></select></label>\n', "")
text = text.replace('    <script src="app/zone-site-configuration.js?v=0.9.2"></script>\n', "")
write(path, text)

path = "app/bootstrap.js"
text = read(path).replace("  bindZoneSiteDeveloperMenu();\n", "")
write(path, text)

# Remove retired editor CSS.
path = "styles.css"
text = read(path)
text, count = re.subn(
    r"\.developer-menu > summary \{.*?\.zone-site-selection \{[^\n]*\}\n\n",
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Unable to remove legacy Zone/Site CSS")
write(path, text)

# Remove old configuration asset from runtime and offline lists.
for path in ["service-worker.js", "app/update-manager.js"]:
    text = read(path)
    trailing = text.endswith("\n")
    text = "\n".join(line for line in text.splitlines() if "zone-site-configuration.js" not in line)
    if trailing:
        text += "\n"
    if path == "service-worker.js":
        text = re.sub(
            r'const CACHE_NAME = "[^"]+";',
            'const CACHE_NAME = "servoforge-labeler-staging-v0.9.2-no-zone-site";',
            text,
            count=1,
        )
    write(path, text)

# Clean company seed metadata so fresh installs never receive it.
path = root / "config/company-default-settings.json"
document = json.loads(path.read_text(encoding="utf-8"))
settings = document.get("settings", document)
if isinstance(settings, dict):
    for key in ["selectedZone", "selectedSite", "mapLibraryZone", "mapLibrarySite", "zoneSiteConfiguration"]:
        settings.pop(key, None)
    maps = settings.get("mapLibrary", [])
    if isinstance(maps, list):
        for machine_map in maps:
            if isinstance(machine_map, dict):
                machine_map.pop("zone", None)
                machine_map.pop("site", None)
path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")

legacy_module = root / "app/zone-site-configuration.js"
if legacy_module.exists():
    legacy_module.unlink()
