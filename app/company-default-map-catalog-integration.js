"use strict";

(function installApprovedDefaultMapCatalog(global) {
  if (global.LabelerApprovedDefaultMapCatalog?.installed) return;

  const RETRY_MS = 50;
  const SENSOR_MIGRATION_KEY = "servoforgeOptionalLabelSensorsV136";
  const SENSOR_MIGRATION_VERSION = 1;
  const DEFAULT_MAP_IDS = Object.freeze([
    "map-apl-default",
    "map-45h-topmodul-3-label-apl-wipe-down-pads"
  ]);
  const LEGACY_PACKAGED_MAP_IDS = Object.freeze([
    "map-blank-apl",
    "map-l85-workbook-reference-3-label-apl",
    "machine-map-1784426568359-9375",
    "machine-map-1784427388958-9702",
    "machine-map-1784477554290-6537",
    "machine-map-1785590537632-2751",
    "machine-map-1785604940794-6949",
    "machine-map-1785604972525-2064"
  ]);
  const key = (value) => String(value ?? "").trim().toLowerCase();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  function stripLabelSensorsFromMap(map) {
    if (!map || typeof map !== "object") return 0;
    const source = Array.isArray(map.objects) ? map.objects : [];
    const next = source.filter((item) => item?.kind !== "sensor");
    const removed = source.length - next.length;
    if (removed) map.objects = next;
    return removed;
  }

  function sensorMigrationVersion() {
    try { return Number(global.localStorage?.getItem(SENSOR_MIGRATION_KEY) || 0); }
    catch { return 0; }
  }

  function saveSensorMigrationVersion() {
    try { global.localStorage?.setItem(SENSOR_MIGRATION_KEY, String(SENSOR_MIGRATION_VERSION)); }
    catch { }
  }

  function migrateExistingLabelSensorsOnce() {
    if (sensorMigrationVersion() >= SENSOR_MIGRATION_VERSION) {
      return { applied: false, changed: false, removed: 0 };
    }

    let removed = 0;
    (Array.isArray(global.state?.mapLibrary) ? global.state.mapLibrary : []).forEach((map) => {
      removed += stripLabelSensorsFromMap(map);
    });

    if (Array.isArray(global.state?.aplMapObjects)) {
      const source = global.state.aplMapObjects;
      const next = source.filter((item) => item?.kind !== "sensor");
      removed += source.length - next.length;
      global.state.aplMapObjects = next;
    }

    if (removed && global.state?.selectedMapObjectId) {
      const selectedStillExists = (global.state.mapLibrary || []).some((map) =>
        (Array.isArray(map?.objects) ? map.objects : []).some((item) => item?.id === global.state.selectedMapObjectId)
      );
      if (!selectedStillExists) global.state.selectedMapObjectId = "";
    }

    saveSensorMigrationVersion();
    return { applied: true, changed: removed > 0, removed };
  }

  function approvedMaps(catalog) {
    const byId = new Map((Array.isArray(catalog?.maps) ? catalog.maps : [])
      .map((map) => [key(map?.id), map]));
    return DEFAULT_MAP_IDS
      .map((id) => byId.get(key(id)))
      .filter(Boolean)
      .map((map) => {
        const packaged = clone(map);
        stripLabelSensorsFromMap(packaged);
        return {
          ...packaged,
          companyDefaultProgram: true,
          protectedDefaultMap: true
        };
      });
  }

  function isRetiredPackagedMap(map) {
    const id = key(map?.id);
    return map?.companyDefaultProgram === true
      || map?.protectedDefaultMap === true
      || LEGACY_PACKAGED_MAP_IDS.some((legacyId) => key(legacyId) === id);
  }

  async function enforce({ persist = true, render = true } = {}) {
    const service = global.LabelerCompanyDefaultsService;
    if (!service?.loadCatalog || !global.state) {
      return { changed: false, reason: "service-unavailable" };
    }

    const catalog = await service.loadCatalog();
    const sensorMigration = migrateExistingLabelSensorsOnce();
    const currentBeforeEnforcement = Array.isArray(global.state.mapLibrary) ? global.state.mapLibrary : [];
    const localById = new Map(currentBeforeEnforcement.map((map) => [key(map?.id), map]));
    const official = approvedMaps(catalog).map((packaged) => {
      const local = localById.get(key(packaged?.id));
      if (local?.localStructuralMapOverride) {
        return {
          ...clone(local),
          id: packaged.id,
          companyDefaultProgram: true,
          companyDefaultProgramVersion: packaged.companyDefaultProgramVersion,
          protectedDefaultMap: true,
          localStructuralMapOverride: true,
          localMachineSettingsOverride: Boolean(local.localMachineSettingsOverride)
        };
      }
      if (!local?.localMachineSettingsOverride) return packaged;
      return {
        ...packaged,
        machineSettings: clone(local.machineSettings || packaged.machineSettings),
        localMachineSettingsOverride: true
      };
    });
    if (official.length !== DEFAULT_MAP_IDS.length) {
      throw new Error(`The packaged map catalog must contain exactly ${DEFAULT_MAP_IDS.length} approved maps.`);
    }

    const reserved = new Set(DEFAULT_MAP_IDS.map(key));
    const current = currentBeforeEnforcement;
    const custom = current.filter((map) =>
      !reserved.has(key(map?.id)) && !isRetiredPackagedMap(map)
    );
    const next = [...official, ...custom];
    const catalogChanged = !same(current, next);
    const changed = Boolean(sensorMigration.changed || catalogChanged);
    if (!changed) {
      return {
        changed: false,
        official: official.length,
        custom: custom.length,
        labelSensorMigrationApplied: sensorMigration.applied,
        labelSensorsRemoved: sensorMigration.removed
      };
    }

    const previousActiveId = key(global.state.activeMapId);
    global.state.mapLibrary = next;
    const active = next.find((map) => key(map?.id) === previousActiveId)
      || next.find((map) => key(map?.id) === key(catalog?.base?.settings?.activeMapId))
      || next[0];
    global.state.activeMapId = active?.id || "";
    global.state.selectedMapObjectId = "";
    global.state.builderHistory = { undo: [], redo: [] };

    if (active && typeof global.loadMachineMapIntoRuntime === "function") {
      global.loadMachineMapIntoRuntime(active, false);
    }
    if (persist && typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
    if (typeof global.applyGeneratedServoProfile === "function" && global.state.selectedBrand) {
      global.applyGeneratedServoProfile();
    }
    if (render && typeof global.render === "function") global.render();

    return {
      changed: true,
      official: official.length,
      custom: custom.length,
      activeMapId: global.state.activeMapId,
      labelSensorMigrationApplied: sensorMigration.applied,
      labelSensorsRemoved: sensorMigration.removed
    };
  }

  function install() {
    const service = global.LabelerCompanyDefaultsService;
    if (!service?.reconcile || !service?.loadCatalog || !global.state) return false;
    if (service.approvedDefaultMapCatalogV12) return true;

    const baseReconcile = service.reconcile.bind(service);
    global.LabelerCompanyDefaultsService = Object.freeze({
      ...service,
      async reconcile(...args) {
        const result = await baseReconcile(...args);
        const enforcement = await enforce({ persist: true, render: true });
        return {
          ...result,
          changed: Boolean(result?.changed || enforcement.changed),
          approvedDefaultMaps: DEFAULT_MAP_IDS.slice(),
          approvedDefaultMapCatalogEnforced: enforcement.changed,
          optionalLabelSensorsV136: true,
          labelSensorMigrationApplied: enforcement.labelSensorMigrationApplied,
          labelSensorsRemoved: enforcement.labelSensorsRemoved,
          activeMapId: global.state.activeMapId
        };
      },
      approvedDefaultMapCatalogV12: true,
      optionalLabelSensorsV136: true
    });

    global.LabelerApprovedDefaultMapCatalog = Object.freeze({
      installed: true,
      DEFAULT_MAP_IDS,
      LEGACY_PACKAGED_MAP_IDS,
      approvedMaps,
      isRetiredPackagedMap,
      enforce,
      stripLabelSensorsFromMap,
      migrateExistingLabelSensorsOnce,
      optionalLabelSensorsV136: true,
      localMachineSettingsOverrideV87: true
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
