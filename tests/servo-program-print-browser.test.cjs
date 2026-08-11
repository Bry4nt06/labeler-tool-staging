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
        tabsController: Boolean(window.LabelerTabsController?.activate),
        build: window.ServoForgeBootstrapBuild,
        rows: state.program.length,
        map: activeMachineMap()?.name,
        brand: state.selectedBrand,
        bottle: state.selectedBottle
      };
    });

    assert.equal(setup.printInstalled, true, "Servo Program print integration must be installed.");
    assert.equal(setup.tabsController, true, "Servo Program tab controller must be available.");
    assert.ok(setup.build, "Current staging build ID must be available.");
    assert.ok(setup.rows > 20, `Expected a generated Mic Family program, found ${setup.rows} rows.`);
    assert.equal(setup.map, "APL 6-Aggregate");

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

    const programTab = await page.evaluate(() => ({
      activeTab: state.activeTab,
      programTabActive: document.querySelector('.tab[data-tab="program"]')?.classList.contains("active"),
      hidden: document.querySelector("#printServoProgram")?.hidden,
      disabled: document.querySelector("#printServoProgram")?.disabled,
      label: document.querySelector("#printServoProgram")?.textContent
    }));
    assert.equal(programTab.activeTab, "program");
    assert.equal(programTab.programTabActive, true);
    assert.equal(programTab.hidden, false, "Print Program must be visible on Servo Program.");
    assert.equal(programTab.disabled, false, "Print Program must be enabled when rows exist.");
    assert.equal(programTab.label, "Print Program");

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

    const meaningfulErrors = pageErrors.filter((error) => !/favicon/i.test(error));
    assert.deepEqual(meaningfulErrors, [], `Browser errors were emitted:\n${meaningfulErrors.join("\n\n")}`);

    console.log("Servo Program print browser regression passed.");
    console.log(JSON.stringify({ setup, programTab, printedLength: printed.html.length }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
