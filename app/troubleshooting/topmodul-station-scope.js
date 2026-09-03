"use strict";

(function installTopModulStationScope(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationScopeExtension() {
  return function extendLibrary(base) {
    if (!base?.searchEntries || !base?.getEntry || !base?.getTopModulFault) {
      throw new Error("TopModul PLC fault catalog is required before station-scope normalization.");
    }

    const STATION_COUNT = 6;
    const STATION_BASE = 1024;
    const STATION_STRIDE = 80;
    const STATION_TEMPLATE_FAULTS = 62;

    function stationInfo(entry) {
      const station = Number(entry?.plcFault?.station || 0);
      const number = Number(entry?.number);
      if (!Number.isInteger(station) || station < 1 || station > STATION_COUNT || !Number.isInteger(number)) return null;
      const offset = number - (STATION_BASE + (station - 1) * STATION_STRIDE);
      if (offset < 0 || offset >= STATION_STRIDE) return null;
      return { station, offset };
    }

    function stripStationPrefix(title) {
      return String(title || "").replace(/^Labeling Station [1-6]\s*\/\s*/i, "").trim();
    }

    function scopeForEntry(entry) {
      if (!entry?.plcFault) return null;
      return stationInfo(entry) ? "Station" : "Labeler";
    }

    function enrichSpecificEntry(entry) {
      if (!entry?.plcFault) return entry;
      const scope = scopeForEntry(entry);
      const info = stationInfo(entry);
      return Object.freeze({
        ...entry,
        category: `TopModul PLC / ${scope} / ${entry.plcFault.family || "Fault"}`,
        diagnosticScope: scope,
        stationTemplateOffset: info?.offset ?? null,
        canonicalFaultId: info ? `topmodul-station-template-${info.offset}` : entry.id
      });
    }

    function variantsForOffset(offset) {
      const variants = [];
      for (let station = 1; station <= STATION_COUNT; station += 1) {
        const number = STATION_BASE + (station - 1) * STATION_STRIDE + offset;
        const entry = base.getTopModulFault(number);
        if (entry) {
          variants.push(Object.freeze({
            station,
            number: entry.number,
            code: entry.code,
            id: entry.id,
            title: entry.title,
            address: entry.plcFault?.address || "",
            family: entry.plcFault?.family || ""
          }));
        }
      }
      return Object.freeze(variants);
    }

    const stationOffsets = [...new Set(
      base.entries
        .map((entry) => stationInfo(entry)?.offset)
        .filter((value) => Number.isInteger(value))
    )].sort((a, b) => a - b);

    const canonicalStationEntries = new Map();
    for (const offset of stationOffsets) {
      const variants = variantsForOffset(offset);
      const representative = variants.length ? base.getEntry(variants[0].id) : null;
      if (!representative) continue;
      const titles = variants.map((variant) => stripStationPrefix(variant.title));
      const frequency = new Map();
      for (const title of titles) frequency.set(title, (frequency.get(title) || 0) + 1);
      const canonicalTitle = [...frequency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || stripStationPrefix(representative.title);
      const exceptions = variants
        .filter((variant) => stripStationPrefix(variant.title) !== canonicalTitle)
        .map((variant) => Object.freeze({ station: variant.station, title: stripStationPrefix(variant.title), code: variant.code }));
      const faultNumbers = variants.map((variant) => `S${variant.station} ${variant.code}`).join(" • ");
      const sourceRefs = variants.map((variant) => ({
        sourceId: "topmodul-k407039-lb1-l5k",
        locator: `Station ${variant.station}: ${variant.address} — Fault ${variant.code} — ${variant.title}`
      }));
      canonicalStationEntries.set(offset, Object.freeze({
        ...representative,
        id: `topmodul-station-template-${offset}`,
        code: "STATION TEMPLATE",
        number: null,
        title: canonicalTitle,
        category: `TopModul PLC / Station / ${representative.plcFault?.family || "Fault"}`,
        aliases: [
          canonicalTitle,
          `station ${canonicalTitle}`,
          `labeling station ${canonicalTitle}`,
          ...variants.flatMap((variant) => [variant.code, `fault ${variant.code}`])
        ],
        summary: `One shared TopModul station diagnostic method covers this alarm position across Stations 1–6. The six PLC instances are ${faultNumbers}. Search an exact fault number to open the physical station instance and its exact Faults_LB1 bit.`,
        sourceRefs,
        diagnosticScope: "Station",
        stationTemplateOffset: offset,
        canonicalFaultId: `topmodul-station-template-${offset}`,
        stationVariants: variants,
        stationTextExceptions: Object.freeze(exceptions),
        plcFault: Object.freeze({
          scope: "station-template",
          station: null,
          offset,
          family: representative.plcFault?.family || "",
          traceStatus: "shared-station-method-validated"
        })
      }));
    }

    function getEntry(id) {
      const match = /^topmodul-station-template-(\d+)$/.exec(String(id || ""));
      if (match) return canonicalStationEntries.get(Number(match[1])) || null;
      return enrichSpecificEntry(base.getEntry(id));
    }

    function explicitStationIntent(query) {
      return /(?:labeling\s+)?station\s*[1-6]\b/i.test(String(query || ""));
    }

    function numericIntent(query) {
      return /^0*\d+$/.test(String(query || "").trim());
    }

    function canonicalizeMatch(entry) {
      const info = stationInfo(entry);
      return info ? canonicalStationEntries.get(info.offset) || enrichSpecificEntry(entry) : enrichSpecificEntry(entry);
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const specific = numericIntent(query) || explicitStationIntent(query);
      const matches = base.searchEntries(query, context, specific ? requested + 8 : Math.max(48, requested * STATION_COUNT * 2));
      const seen = new Set();
      const output = [];
      for (const original of matches) {
        const entry = specific ? enrichSpecificEntry(original) : canonicalizeMatch(original);
        if (!entry || seen.has(entry.id)) continue;
        seen.add(entry.id);
        output.push(entry);
        if (output.length >= requested) break;
      }
      return output;
    }

    function getStationFaultTemplate(offset) {
      return canonicalStationEntries.get(Number(offset)) || null;
    }

    function getStationFaultVariant(offset, station) {
      const n = Number(station);
      if (!Number.isInteger(n) || n < 1 || n > STATION_COUNT) return null;
      const number = STATION_BASE + (n - 1) * STATION_STRIDE + Number(offset);
      return enrichSpecificEntry(base.getTopModulFault(number));
    }

    function getTopModulFault(value) {
      return enrichSpecificEntry(base.getTopModulFault(value));
    }

    function computeValidation() {
      let exactTextTemplates = 0;
      const overrides = [];
      for (const [offset, entry] of canonicalStationEntries) {
        if (entry.stationVariants.length !== STATION_COUNT) continue;
        if (!entry.stationTextExceptions.length) exactTextTemplates += 1;
        else overrides.push(Object.freeze({ offset, exceptions: entry.stationTextExceptions }));
      }
      return Object.freeze({
        stationCount: STATION_COUNT,
        namedFaultsPerStation: canonicalStationEntries.size,
        exactTextTemplates,
        templatesWithTextOverrides: overrides.length,
        overrides: Object.freeze(overrides),
        sharedProgramEvidence: Object.freeze([
          "LabelingStation_Jumps calls the same ETH_ComSend routine for Stations 1–6; station index and station I/O references are the changing parameters.",
          "The six station alarm ranges use the same 80-fault stride and contain the same 62 named alarm positions.",
          "Station-specific wording exceptions are retained as metadata instead of creating separate diagnostic methods."
        ])
      });
    }

    const stationTemplateValidation = computeValidation();

    function validate() {
      const result = base.validate();
      const errors = [...(result.errors || [])];
      if (canonicalStationEntries.size !== STATION_TEMPLATE_FAULTS) {
        errors.push(`Expected ${STATION_TEMPLATE_FAULTS} shared station alarm templates, found ${canonicalStationEntries.size}.`);
      }
      if (stationTemplateValidation.exactTextTemplates !== 60 || stationTemplateValidation.templatesWithTextOverrides !== 2) {
        errors.push(`Expected 60 exact station templates and 2 wording overrides; found ${stationTemplateValidation.exactTextTemplates} exact and ${stationTemplateValidation.templatesWithTextOverrides} overrides.`);
      }
      for (const entry of canonicalStationEntries.values()) {
        if (entry.stationVariants.length !== STATION_COUNT) errors.push(`${entry.id} does not map to all six stations.`);
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-station-scope-v1`,
      getEntry,
      searchEntries,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      stationTemplateValidation,
      topModulDiagnosticScopes: Object.freeze(["Labeler", "Station"]),
      topModulSharedStationMethodCount: canonicalStationEntries.size,
      validate
    });
  };
});
