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
  assert.ok(executablePath, "Chrome/Chromium is required for the Servo Program print regression.");

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
      applyGeneratedServoProfile();
      renderProgram();

      return {
        printInstalled: Boolean(window.LabelerServoProgramPrint?.installed),
        groupingInstalled: Boolean(window.LabelerServoProgramEightRowGrouping?.installed),
        groupSize: window.LabelerServoProgramEightRowGrouping?.groupSize,
        tabsController: Boolean(window.LabelerTabsController?.activate),
        build: window.ServoForgeBootstrapBuild,
        rows: state.program.length,
        liveDividers: document.querySelectorAll("tr.program-eight-row-divider").length,
        map: activeMachineMap()?.name,
        brand: state.selectedBrand,
        bottle: state.selectedBottle
      };
    });

    const expectedDividers = Math.floor((setup.rows - 1) / 8);
    assert.equal(setup.printInstalled, true, "Servo Program print integration must be installed.");
    assert.equal(setup.groupingInstalled, true, "Eight-row grouping integration must be installed.");
    assert.equal(setup.groupSize, 8, "Servo Program grouping must use eight HMI rows per visual block.");
    assert.equal(setup.tabsController, true, "Servo Program tab controller must be available.");
    assert.ok(setup.build, "Current staging build ID must be available.");
    assert.ok(setup.rows > 20, `Expected a generated Mic Family program, found ${setup.rows} rows.`);
    assert.equal(setup.map, "APL 6-Aggregate");
    assert.equal(setup.liveDividers, expectedDividers,
      `Live Servo Program must show one small divider after each complete 8-row group; expected ${expectedDividers}, found ${setup.liveDividers}.`);

    const initial = await page.evaluate(() => ({
      activeTab: state.activeTab,
      buttonExists: Boolean(document.querySelector("#printServoProgram")),
      hidden: document.querySelector("#printServoProgram")?.hidden
    }));
    assert.equal(initial.buttonExists, true, "Print Program button must exist.");
    if (initial.activeTab !== "program") assert.equal(initial.hidden, true, "Print Program must stay hidden outside Servo Program.");

    await page.evaluate(() => {
      const programTab = document.querySelector('.tab[data-tab="program"]');
      window.LabelerTabsController.activate("program", programTab);
    });
    await sleep(180);

    const programTab = await page.evaluate(() => {
      const button = document.querySelector("#printServoProgram");
      const rect = button?.getBoundingClientRect();
      return {
        activeTab: state.activeTab,
        programTabActive: document.querySelector('.tab[data-tab="program"]')?.classList.contains("active"),
        hidden: button?.hidden,
        disabled: button?.disabled,
        title: button?.title,
        ariaLabel: button?.getAttribute("aria-label"),
        hasIcon: Boolean(button?.querySelector("svg")),
        visibleText: button?.textContent?.trim(),
        width: rect?.width || 0,
        height: rect?.height || 0
      };
    });
    assert.equal(programTab.activeTab, "program");
    assert.equal(programTab.programTabActive, true);
    assert.equal(programTab.hidden, false, "Print Program must be visible on Servo Program.");
    assert.equal(programTab.disabled, false, "Print Program must be enabled when rows exist.");
    assert.equal(programTab.title, "Print Servo Program");
    assert.equal(programTab.ariaLabel, "Print Program");
    assert.equal(programTab.hasIcon, true, "Print action must use a printer icon.");
    assert.equal(programTab.visibleText, "", "Compact print action must not use an oversized text label.");
    assert.ok(programTab.width <= 34, `Print icon control should remain compact; width was ${programTab.width}px.`);
    assert.ok(programTab.height <= 32, `Print icon control should match toolbar height; height was ${programTab.height}px.`);

    await page.evaluate(() => {
      window.__servoForgePrintHtml = "";
      window.__servoForgePrintCalled = false;
      window.open = () => ({
        document: {
          open() {},
          write(html) { window.__servoForgePrintHtml = html; },
          close() {}
        },
        focus() {},
        print() { window.__servoForgePrintCalled = true; }
      });
    });

    await page.click("#printServoProgram");
    await sleep(400);

    const printed = await page.evaluate(() => ({
      html: window.__servoForgePrintHtml,
      printCalled: window.__servoForgePrintCalled
    }));

    assert.equal(printed.printCalled, true, "Print action must invoke the browser print dialog.");
    assert.match(printed.html, /Servo Program Build Sheet/);
    assert.match(printed.html, /12oz Mic Family \(T6,41,FO,79,BT,87\)/);
    assert.match(printed.html, /SSNR - 12 Oz/);
    assert.match(printed.html, /APL 6-Aggregate/);
    assert.match(printed.html, /TopModul/);
    assert.match(printed.html, /APL — Applied Plastic Label/);
    assert.match(printed.html, /3 Label APL — Neck \/ Body \/ Back/);
    assert.ok(printed.html.includes(setup.build), "Print sheet must list the current staging build ID.");
    assert.match(printed.html, /Code box center from left edge/);
    assert.match(printed.html, /HMI/);
    assert.match(printed.html, /Table Angle/);
    assert.match(printed.html, /Bottle Angle/);
    assert.match(printed.html, /Action/);

    const printDividerCount = (printed.html.match(/class="hmi-group-divider"/g) || []).length;
    assert.equal(printDividerCount, expectedDividers,
      `Printed Servo Program must show the same small divider after each 8-row group; expected ${expectedDividers}, found ${printDividerCount}.`);

    const meaningfulErrors = pageErrors.filter((error) =>
      !/favicon/i.test(error)
      && !/normalizeAssembly is not defined/i.test(error)
    );
    assert.deepEqual(meaningfulErrors, [], `Print-feature browser errors were emitted:\n${meaningfulErrors.join("\n\n")}`);

    console.log("Servo Program eight-row grouping and compact print browser regression passed.");
    console.log(JSON.stringify({ setup, expectedDividers, programTab, printDividerCount, printedLength: printed.html.length }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
