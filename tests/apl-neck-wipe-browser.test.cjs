"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer-core");

(async () => {
  const executablePath = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(fs.existsSync);
  assert.ok(executablePath, "Chrome is required");
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:8000/index.html", { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => window.LabelerAplFinishedCenterlineCompletion && window.LabelerAplRollerSectionHandoff && typeof applyGeneratedServoProfile === "function");
    const results = await page.evaluate(async () => {
      const [labels, bottles, template] = await Promise.all([
        fetch("./config/default-programs/label-specs.json").then(r => r.json()),
        fetch("./config/default-programs/bottle-specs.json").then(r => r.json()),
        fetch("./config/default-programs/map-apl-6-aggregate.json").then(r => r.json())
      ]);
      const original = labels.find(label => label.applicationMode === "apl");
      const label = { ...original, id: 99999, brand: "Neck wipe regression fixture", neckBottomCurveMm: 81.54,
        neckLengthMm: 81.54, neckBottomCircumferenceMm: 105, bodyLengthMm: 70, backLengthMm: 53,
        enabledLabelSections: { neck: true, body: true, back: true } };
      window.ensurePersistentApplicationMaps = () => state.mapLibrary;
      const result = [];
      for (const machineType of ["MultiModul", "TopModul (DTS3)"]) {
        const map = { ...template, id: "neck-wipe-regression", name: "Three-station neck regression", machineType,
          protectedDefaultMap: false, companyDefaultProgram: false, restoreDefaultObjects: false,
          enabledStations: [true, false, true, false, true, false],
          enabledAggregates: [true, false, true, false, true, false],
          stationSections: { 1: "neck", 3: "body", 5: "back" },
          objects: [
            { id: "neck-outer", name: "Neck outer", station: 1, kind: "roller", application: "apl", side: "outer", start: 72, end: 82.5 },
            { id: "neck-inner", name: "Neck inner", station: 1, kind: "roller", application: "apl", side: "inner", start: 89.5, end: 147.5 },
            { id: "body", name: "Body pad", station: 3, kind: "pad", application: "apl", side: "outer", start: 149, end: 169 },
            { id: "back", name: "Back pad", station: 5, kind: "pad", application: "apl", side: "outer", start: 230, end: 250 }
          ] };
        state.labelSpecs = [label];
        state.bottleSpecs = bottles;
        state.mapLibrary = [map];
        state.activeMapId = map.id;
        state.applicationMode = "apl";
        state.selectedBrand = label.brand;
        state.selectedBottle = label.bottleType;
        state.maxMoveRatio = 21;
        Object.assign(state.buildInputs, { neckApplication: "Center", neckApplicationReference: "center-tack",
          neckOverWipeDeg: 194.5 - (81.54 / 105 * 360 / 2), neckContactMm: 0,
          bodyContactMm: 5, backContactMm: 5, bodyOverWipeDeg: 0, backOverWipeDeg: 0 });
        applyGeneratedServoProfile();
        const rows = state.program;
        const firstIndex = rows.findIndex(row => /Wipe Turn 1 Neck/i.test(row.action));
        const secondIndex = rows.findIndex(row => /Wipe Turn 2 Neck/i.test(row.action));
        const first = rows[firstIndex], second = rows[secondIndex];
        const firstTravel = Number(rows[firstIndex + 1]?.plateAngle) - Number(first?.plateAngle);
        const secondTravel = Number(rows[secondIndex + 1]?.plateAngle) - Number(second?.plateAngle);
        const plan = sectionWipePlan("neck");
        result.push({ machineType, firstTravel, secondTravel, required: Math.abs(firstTravel) + plan.labelDeg / 2 + plan.overWipeDeg,
          neckStations: [...new Set(rows.filter(row => /Wipe Turn [12] Neck/i.test(row.action)).map(row => row.station))],
          rowCount: rows.length, tables: rows.map(row => row.tableAngle) });
      }
      return result;
    });
    for (const result of results) {
      assert.ok(Number.isFinite(result.firstTravel) && Number.isFinite(result.secondTravel), JSON.stringify(result));
      assert.ok(Math.abs(result.firstTravel - 194.5) < 0.2, "the first wipe must remain unchanged: " + JSON.stringify(result));
      assert.ok(result.secondTravel <= -result.required + 0.2, "the final program must finish the reverse wipe: " + JSON.stringify(result));
      assert.equal(result.neckStations.length, 1, "the fixture has only one neck station");
      assert.ok(result.tables.every(angle => angle < 360), "the program must stay in one cycle: " + JSON.stringify(result));
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
