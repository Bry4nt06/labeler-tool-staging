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
      window.__servoForgePrintFixture = JSON.parse(JSON.stringify({
        labelSpecs,
        bottleSpecs,
        machineMap,
        program: state.program,
        applicationMode: state.applicationMode,
        activeMapId: state.activeMapId,
        selectedBrand: state.selectedBrand,
        selectedBottle: state.selectedBottle
      }));

      const liveHeaders = [...document.querySelectorAll("#programTable th, #program th")]
        .map((node) => node.textContent.trim())
        .filter(Boolean);

      return {
        printInstalled: Boolean(window.LabelerServoProgramPrint?.installed),
        groupingInstalled: Boolean(window.LabelerServoProgramEightRowGrouping?.installed),
        groupSize: window.LabelerServoProgramEightRowGrouping?.groupSize,
        printColumnCount: window.LabelerServoProgramEightRowGrouping?.printColumnCount,
        tabsController: Boolean(window.LabelerTabsController?.activate),
        build: window.ServoForgeBootstrapBuild,
        rows: state.program.length,
        liveDividers: document.querySelectorAll("tr.program-eight-row-divider").length,
        liveHeaders,
        liveHeaderCount: liveHeaders.length,
        map: activeMachineMap()?.name,
        brand: state.selectedBrand,
        bottle: state.selectedBottle
      };
    });

    const expectedDividers = Math.floor((setup.rows - 1) / 8);
    assert.equal(setup.printInstalled, true, "Servo Program print integration must be installed.");
    assert.equal(setup.groupingInstalled, true, "Eight-row grouping integration must be installed.");
    assert.equal(setup.groupSize, 8, "Servo Program grouping must use eight HMI rows per visual block.");
    assert.equal(setup.printColumnCount, 9, "Printed Servo Program should expose nine operator-facing columns.");
    assert.equal(setup.tabsController, true, "Servo Program tab controller must be available.");
    assert.ok(setup.build, "Current staging build ID must be available.");
    assert.ok(setup.rows > 20, `Expected a generated Mic Family program, found ${setup.rows} rows.`);
    assert.equal(setup.map, "APL 6-Aggregate");
    assert.equal(setup.liveDividers, expectedDividers,
      `Live Servo Program must show one small divider after each complete 8-row group; expected ${expectedDividers}, found ${setup.liveDividers}.`);
    assert.equal(setup.liveHeaders.includes("HMI"), true);
    assert.equal(setup.liveHeaders.some((header) => header === "CMD" || header === "Travel command"), true);

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
      const fixture = window.__servoForgePrintFixture;
      state.labelSpecs = fixture.labelSpecs;
      state.bottleSpecs = fixture.bottleSpecs;
      state.mapLibrary = [fixture.machineMap];
      state.program = fixture.program;
      state.applicationMode = fixture.applicationMode;
      state.activeMapId = fixture.activeMapId;
      state.selectedBrand = fixture.selectedBrand;
      state.selectedBottle = fixture.selectedBottle;
      window.LabelerServoProgramPrint.syncButton();
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
    assert.match(printed.html, /<th>HMI<\/th>/);
    assert.match(printed.html, /<th>CMD<\/th>/);
    assert.match(printed.html, /<th>Table Angle<\/th>/);
    assert.match(printed.html, /<th>Bottle Angle<\/th>/);
    assert.match(printed.html, /<th>Action<\/th>/);
    assert.doesNotMatch(printed.html, /<th>PLC<\/th>/, "PLC must be hidden from the printed Servo Program.");
    assert.doesNotMatch(printed.html, /<th>Encoder(?: Travel)?<\/th>/i,
      "Encoder must be hidden from the printed Servo Program.");

    const printDividerCount = (
      printed.html.match(/class="(?:hmi-group-divider|program-eight-row-divider)"/g) || []
    ).length;
    assert.equal(printDividerCount, expectedDividers,
      `Printed Servo Program must show the same small divider after each 8-row group; expected ${expectedDividers}, found ${printDividerCount}.`);

    await page.evaluate(() => {
      state.simulation = {
        useCustom: true,
        turns: [],
        rows: [],
        deletedRows: [],
        lines: state.program.map((row) => ({ ...row }))
      };
      window.LabelerTabsController.activate("simulation", document.querySelector('.tab[data-tab="simulation"]'));
      window.LabelerSimulationController.loadGeneratedTurns();
      state.simulation.lines[0].action = "Custom simulation print marker";
      renderSimulation();

      const name = document.querySelector("#servoProfileName");
      const description = document.querySelector("#servoProfileDescription");
      name.value = "Operator click-away draft";
      name.dispatchEvent(new Event("input", { bubbles: true }));
      description.value = "Must survive leaving and returning to Servo Simulation";
      description.dispatchEvent(new Event("input", { bubbles: true }));

      window.LabelerTabsController.activate("specs", document.querySelector('.tab[data-tab="specs"]'));
      window.LabelerTabsController.activate("simulation", document.querySelector('.tab[data-tab="simulation"]'));
      renderSimulation();
      window.LabelerServoProgramPrint.syncButton();
    });
    await sleep(250);

    const simulationTab = await page.evaluate(() => {
      const button = document.querySelector("#printServoProgram");
      const saved = JSON.parse(localStorage.getItem("labelerToolSettings") || "{}");
      return {
        activeTab: state.activeTab,
        draftName: state.simulation.draftName,
        draftDescription: state.simulation.draftDescription,
        renderedName: document.querySelector("#servoProfileName")?.value,
        renderedDescription: document.querySelector("#servoProfileDescription")?.value,
        storedName: saved.simulation?.draftName,
        hidden: button?.hidden,
        disabled: button?.disabled,
        title: button?.title,
        ariaLabel: button?.getAttribute("aria-label"),
        followsSimulationTab: button?.previousElementSibling?.dataset?.tab === "simulation"
      };
    });
    assert.equal(simulationTab.activeTab, "simulation");
    assert.equal(simulationTab.draftName, "Operator click-away draft");
    assert.equal(simulationTab.renderedName, "Operator click-away draft");
    assert.equal(simulationTab.storedName, "Operator click-away draft");
    assert.equal(simulationTab.renderedDescription, simulationTab.draftDescription);
    assert.equal(simulationTab.hidden, false);
    assert.equal(simulationTab.disabled, false);
    assert.equal(simulationTab.title, "Print Simulation Profile");
    assert.equal(simulationTab.ariaLabel, "Print Simulation Profile");
    assert.equal(simulationTab.followsSimulationTab, true);

    await page.evaluate(() => {
      window.__servoForgePrintHtml = "";
      window.__servoForgePrintCalled = false;
    });
    await page.click("#printServoProgram");
    await sleep(400);

    const simulationPrinted = await page.evaluate(() => ({
      html: window.__servoForgePrintHtml,
      printCalled: window.__servoForgePrintCalled
    }));
    assert.equal(simulationPrinted.printCalled, true);
    assert.match(simulationPrinted.html, /Custom Simulation Profile/);
    assert.match(simulationPrinted.html, /Operator click-away draft/);
    assert.match(simulationPrinted.html, /Unsaved Custom Draft/);
    assert.match(simulationPrinted.html, /Custom simulation print marker/);

    const meaningfulErrors = pageErrors.filter((error) =>
      !/favicon/i.test(error)
      && !/normalizeAssembly is not defined/i.test(error)
    );
    assert.deepEqual(meaningfulErrors, [], `Print-feature browser errors were emitted:\n${meaningfulErrors.join("\n\n")}`);

    console.log("Servo Program and custom simulation shared print regression passed.");
    console.log(JSON.stringify({ setup, expectedDividers, programTab, simulationTab, printDividerCount, printedLength: printed.html.length, simulationPrintedLength: simulationPrinted.html.length }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
