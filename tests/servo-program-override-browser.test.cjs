"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer-core");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const executablePath = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].find((candidate) => fs.existsSync(candidate));
  assert.ok(executablePath, "Chrome/Chromium is required for the Servo Program override regression.");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.stack || error.message || String(error)));

    await page.goto("http://127.0.0.1:8000/index.html", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    await sleep(6500);

    const setup = await page.evaluate(async () => {
      const [labelSpecs, bottleSpecs, machineMap] = await Promise.all([
        fetch("./config/default-programs/label-specs.json").then((response) => response.json()),
        fetch("./config/default-programs/bottle-specs.json").then((response) => response.json()),
        fetch("./config/default-programs/map-apl-6-aggregate.json").then((response) => response.json())
      ]);

      window.ensurePersistentApplicationMaps = () => state.mapLibrary;
      state.labelSpecs = labelSpecs;
      state.bottleSpecs = bottleSpecs;
      state.mapLibrary = [machineMap];
      state.applicationMode = "apl";
      state.activeMapId = machineMap.id;
      state.selectedBrand = "12oz Mic Family (T6,41,FO,79,BT,87)";
      state.selectedBottle = "SSNR - 12 Oz";
      state.servoOverrides = {};
      state.isPlaying = false;
      applyGeneratedServoProfile();
      renderProgram();
      window.LabelerTabsController.activate("program", document.querySelector('.tab[data-tab="program"]'));

      const input = document.querySelector('#program tr[data-program-hmi="10"] input[data-program-field="plateAngle"]')
        || document.querySelector('#program input[data-program-field="plateAngle"]');
      if (!input) throw new Error("Bottle override input was not rendered.");
      const row = input.closest("tr[data-program-hmi]");
      input.dataset.browserEditSentinel = "original-node";
      return {
        hmi: Number(row.dataset.programHmi),
        generated: Number(state.program.find((item) => Number(item.hmi) === Number(row.dataset.programHmi))?.generatedPlateAngle),
        build: window.ServoForgeBootstrapBuild
      };
    });

    const selector = `#program tr[data-program-hmi="${setup.hmi}"] input[data-program-field="plateAngle"]`;
    await page.click(selector);
    await page.keyboard.type("-173.5");
    await sleep(120);

    const duringEdit = await page.evaluate(({ selector, hmi }) => {
      const input = document.querySelector(selector);
      const row = state.program.find((item) => Number(item.hmi) === hmi);
      return {
        sameNode: input?.dataset.browserEditSentinel === "original-node",
        inputValue: input?.value,
        liveOverride: row?.plateAngleOverride,
        liveAngle: row?.plateAngle,
        activeElementIsInput: document.activeElement === input
      };
    }, { selector, hmi: setup.hmi });

    assert.equal(duringEdit.sameNode, true, "The override editor must not be replaced while the user is typing.");
    assert.equal(duringEdit.inputValue, "-173.5", "Typed override must remain visible before commit.");
    assert.equal(duringEdit.liveOverride, -173.5, "Typing must update the live row override.");
    assert.equal(duringEdit.liveAngle, -173.5, "Typing must update the live effective bottle angle.");
    assert.equal(duringEdit.activeElementIsInput, true, "Typing must keep focus in the same override input.");

    await page.evaluate(() => document.querySelector(".validation h2")?.focus?.());
    await page.click(".validation");
    await sleep(180);

    const committed = await page.evaluate(({ selector, hmi }) => {
      const input = document.querySelector(selector);
      const row = state.program.find((item) => Number(item.hmi) === hmi);
      const profileKey = window.LabelerServoOverrideService.profileKey();
      const stored = state.servoOverrides?.[profileKey]?.[String(row?.plc)];
      return {
        inputValue: input?.value,
        override: row?.plateAngleOverride,
        angle: row?.plateAngle,
        stored: stored?.plateAngle
      };
    }, { selector, hmi: setup.hmi });

    assert.equal(committed.inputValue, "-173.5", "Committed override must remain visible after blur.");
    assert.equal(committed.override, -173.5, "Committed row must retain the override.");
    assert.equal(committed.angle, -173.5, "Committed row must retain the effective angle.");
    assert.equal(committed.stored, -173.5, "Committed override must be retained in the authoritative store.");

    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await sleep(100);

    const duringClear = await page.evaluate(({ selector, hmi, generated }) => {
      const input = document.querySelector(selector);
      const row = state.program.find((item) => Number(item.hmi) === hmi);
      return {
        inputValue: input?.value,
        override: row?.plateAngleOverride,
        angle: row?.plateAngle,
        generated
      };
    }, { selector, hmi: setup.hmi, generated: setup.generated });

    assert.equal(duringClear.inputValue, "", "Clearing must leave the editor blank while it is active.");
    assert.equal(duringClear.override, null, "Clearing must remove the live override immediately.");
    assert.equal(duringClear.angle, setup.generated, "Clearing must restore the generated effective angle immediately.");

    await page.click(".validation");
    await sleep(180);

    const cleared = await page.evaluate(({ selector, hmi, generated }) => {
      const input = document.querySelector(selector);
      const row = state.program.find((item) => Number(item.hmi) === hmi);
      const profileKey = window.LabelerServoOverrideService.profileKey();
      const stored = state.servoOverrides?.[profileKey]?.[String(row?.plc)];
      return {
        inputValue: input?.value,
        override: row?.plateAngleOverride,
        angle: row?.plateAngle,
        storedPlateAngle: stored?.plateAngle,
        generated
      };
    }, { selector, hmi: setup.hmi, generated: setup.generated });

    assert.equal(cleared.inputValue, "", "Cleared override must stay blank after commit.");
    assert.equal(cleared.override, null, "Cleared row must have no bottle override.");
    assert.equal(cleared.angle, setup.generated, "Cleared row must use the generated bottle angle.");
    assert.equal(cleared.storedPlateAngle, undefined, "Cleared override must be removed from the authoritative store.");

    const meaningfulErrors = pageErrors.filter((error) =>
      !/favicon/i.test(error)
      && !/normalizeAssembly is not defined/i.test(error)
    );
    assert.deepEqual(meaningfulErrors, [], `Override browser errors were emitted:\n${meaningfulErrors.join("\n\n")}`);

    console.log("Servo Program real-browser override editing regression passed.");
    console.log(JSON.stringify({ setup, duringEdit, committed, duringClear, cleared }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
