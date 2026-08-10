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
  assert.ok(executablePath, "Chrome/Chromium is required for the runtime startup regression.");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.stack || error.message || String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("http://127.0.0.1:8000/index.html", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    // ServoForge intentionally loads several ordered integration groups after
    // DOMContentLoaded. Do not use networkidle0 here: the app owns background
    // work that can keep the network lifecycle active after the DOM is ready.
    await page.waitForFunction(() => {
      const startupFailed = document.querySelector("#validationList")?.textContent?.includes("Startup failed:");
      const animationStarted = window.LabelerAnimationRuntime?.isRunning?.() === true;
      return startupFailed || animationStarted;
    }, { timeout: 20000 });
    await sleep(1200);

    const status = await page.evaluate(() => ({
      runtimeBridge: Boolean(window.LabelerRuntimeContextBridge?.installed),
      stateBridge: window.state === state,
      elementsBridge: window.els === els,
      assemblyAdapter: Boolean(window.LabelerAssemblyDriverAdapter?.installed),
      coderPolicy: Boolean(window.LabelerTopModulCoderTerminalSourcePolicy?.installed),
      animationRuntime: Boolean(window.LabelerAnimationRuntime),
      animationRunning: Boolean(window.LabelerAnimationRuntime?.isRunning?.()),
      explicitRenderer: Boolean(window.LabelerAnimationRuntime?.explicitRendererOwnerV1),
      overlayPlacement: Boolean(window.LabelerMapOverlayBuilderPlacement?.movedIntoMapBuilderV1),
      overlaySectionParent: document.querySelector("#mapOverlaySettingsSection")?.parentElement?.className || "",
      oldOverlayPanelExists: Boolean(document.querySelector(".map-overlay-control")),
      activeMoveInsideBuilder: Boolean(document.querySelector("#mapOverlaySettingsSection #showMoveDistanceOverlay")),
      allMovesInsideBuilder: Boolean(document.querySelector("#mapOverlaySettingsSection #showAllProgramMovesOverlay")),
      startupFailure: document.querySelector("#validationList")?.textContent?.includes("Startup failed:") || false,
      startupText: document.querySelector("#validationList")?.textContent?.trim() || "",
      playing: state.isPlaying,
      angle: state.previewAngle,
      center: document.querySelector("[data-animation-center]")?.textContent || "",
      playLabel: document.querySelector("#playPause")?.textContent || ""
    }));

    assert.equal(status.runtimeBridge, true, "Runtime context bridge must install before startup integrations.");
    assert.equal(status.stateBridge, true, "Window runtime state must reference the real application state object.");
    assert.equal(status.elementsBridge, true, "Window element registry must reference the real application element registry.");
    assert.equal(status.assemblyAdapter, true, "Assembly adapter must be available before Map Builder migration.");
    assert.equal(status.coderPolicy, true, "Mandatory TopModul coder terminal policy must install before app startup.");
    assert.equal(status.animationRuntime, true, "Animation runtime must load.");
    assert.equal(status.animationRunning, true, `Animation runtime must be started by initializeLabelerApp(). ${status.startupText}`);
    assert.equal(status.explicitRenderer, true, "Animation runtime must use the explicit map animation renderer owner.");
    assert.equal(status.overlayPlacement, true, "Map Overlay controls must be relocated into Map Builder.");
    assert.match(status.overlaySectionParent, /wipe-builder-body/, "Map Overlay settings must live in the Map Builder body.");
    assert.equal(status.oldOverlayPanelExists, false, "Standalone Map Overlays panel must be removed from the right rail.");
    assert.equal(status.activeMoveInsideBuilder, true, "Active-move overlay switch must be preserved inside Map Builder.");
    assert.equal(status.allMovesInsideBuilder, true, "All-program-moves switch must be preserved inside Map Builder.");
    assert.equal(status.startupFailure, false, `Workspace must not report a startup failure. ${status.startupText}`);
    assert.equal(status.playing, true, "Default animation state should be playing after successful startup.");
    assert.equal(status.playLabel, "Pause", "Play control must reflect the running animation state.");

    const before = await page.evaluate(() => state.previewAngle);
    await sleep(1200);
    const after = await page.evaluate(() => ({
      angle: state.previewAngle,
      center: document.querySelector("[data-animation-center]")?.textContent || ""
    }));
    assert.ok(after.angle - before > 5, `Table angle must advance while playing; delta was ${after.angle - before}.`);
    assert.notEqual(after.center, "0 deg", "Mechanical Map center readout must repaint while playing.");

    await page.click("#playPause");
    const pausedBefore = await page.evaluate(() => ({ angle: state.previewAngle, playing: state.isPlaying }));
    await sleep(700);
    const pausedAfter = await page.evaluate(() => ({ angle: state.previewAngle, playing: state.isPlaying }));
    assert.equal(pausedBefore.playing, false, "Clicking Pause must clear the playing state.");
    assert.equal(pausedAfter.playing, false, "Animation must remain paused.");
    assert.ok(Math.abs(pausedAfter.angle - pausedBefore.angle) < 0.05,
      `Table angle must remain stable while paused; delta was ${pausedAfter.angle - pausedBefore.angle}.`);

    await page.click("#playPause");
    const resumedBefore = await page.evaluate(() => ({ angle: state.previewAngle, playing: state.isPlaying }));
    await sleep(700);
    const resumedAfter = await page.evaluate(() => ({ angle: state.previewAngle, playing: state.isPlaying }));
    assert.equal(resumedBefore.playing, true, "Clicking Play must restore the playing state.");
    assert.ok(resumedAfter.angle - resumedBefore.angle > 2,
      `Table angle must resume after Play; delta was ${resumedAfter.angle - resumedBefore.angle}.`);

    const meaningfulPageErrors = pageErrors.filter((message) => !/favicon/i.test(message));
    assert.deepEqual(meaningfulPageErrors, [], `Browser page errors were emitted:\n${meaningfulPageErrors.join("\n\n")}`);
    assert.equal(consoleErrors.some((message) => /startup failed|normalizeAssembly is not defined/i.test(message)), false,
      `Startup/assembly console errors remain: ${consoleErrors.join(" | ")}`);

    console.log("Full ServoForge browser startup regression passed.");
    console.log(JSON.stringify({ status, before, after, pausedBefore, pausedAfter, resumedBefore, resumedAfter }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
