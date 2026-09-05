"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-core.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare.js"));

function fixture(options = {}) {
  const timerPreset = options.timerPreset ?? 100;
  const aliasInput = options.aliasInput ?? "Local:5:I.Data.28";
  const moduleSlot = options.moduleSlot ?? 4;
  const moduleAddress = options.moduleAddress ?? "10.107.204.191";
  const faultInput = options.faultInput ?? "StartCondition";
  const extraIoRung = options.extraIoRung
    ? `\n      RUNG 5\n        N: XIC(Local:6:I.Data.2)OTE(Faults[2].1);\n      END_RUNG`
    : "";
  const motionMember = options.motionMember ?? "FeedbackFault";
  return `
RSLogix 5000 Export Version 15.02
CONTROLLER CompareFixture (ProcessorType := 1756-L61)
  TAG
    StartCondition : BOOL := 0;
    AlternateCondition : BOOL := 0;
    ResetGeneral : BOOL := 0;
    VerifyTimer : TIMER;
    InputAlias : BOOL (Alias For := "${aliasInput}");
    MainAxis : AXIS_SERVO;
  END_TAG
  MODULE Ethernet_IO_2 (
    Parent := Local,
    Slot := ${moduleSlot},
    NodeAddress := ${moduleAddress},
    CatalogNumber := "1756-ENBT/A"
  )
  END_MODULE
  PROGRAM FaultLogic
    ROUTINE Faults (Type := RLL)
      RUNG 0
        N: XIC(${faultInput})OTL(Faults[1].13);
      END_RUNG
      RUNG 1
        N: XIC(ResetGeneral)OTU(Faults[1].13);
      END_RUNG
      RUNG 2
        N: XIC(InputAlias)TON(VerifyTimer,${timerPreset},0)XIC(VerifyTimer.DN)OTE(Faults[1].11);
      END_RUNG
      RUNG 3
        N: GSV(MODULE,Ethernet_IO_2,FaultCode,EthernetModuleSlot4FaultData)NEQ(EthernetModuleSlot4FaultData,0)OTE(Faults[0].13);
      END_RUNG
      RUNG 4
        N: XIC(MainAxis.${motionMember})OTE(Faults[4].3);
      END_RUNG${extraIoRung}
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;
}

function parse(text, fileName) {
  return analyzer.parseL5K(text, { fileName, byteLength: text.length });
}

test("v2 reports no source differences for identical parsed exports", () => {
  const source = fixture();
  const result = compare.compareProjects(parse(source, "known-good.L5K"), parse(source, "current.L5K"));
  assert.equal(result.version, "l5k-compare-v2");
  assert.equal(result.statistics.totalDifferences, 0);
  assert.deepEqual(result.differences, []);
});

test("v2 detects source-proven timer preset changes without recommending the value", () => {
  const baseline = parse(fixture({ timerPreset: 100 }), "known-good.L5K");
  const current = parse(fixture({ timerPreset: 250 }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);
  const timer = result.differences.find((item) => item.category === "timers" && item.key === "VerifyTimer");
  assert.ok(timer);
  assert.equal(timer.changeType, "changed");
  assert.equal(timer.classification, "source-proven");
  assert.equal(timer.reviewLevel, "review");
  assert.deepEqual(timer.baseline.presetValues, ["100"]);
  assert.deepEqual(timer.current.presetValues, ["250"]);
  assert.match(timer.summary, /source evidence, not adjustment recommendations/i);
});

test("v2 detects alias and module configuration differences", () => {
  const baseline = parse(fixture(), "known-good.L5K");
  const current = parse(fixture({ aliasInput: "Local:5:I.Data.29", moduleSlot: 5, moduleAddress: "10.107.204.192" }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);
  const alias = result.differences.find((item) => item.category === "aliases" && item.key === "InputAlias");
  assert.ok(alias);
  assert.equal(alias.baseline.aliasFor, "Local:5:I.Data.28");
  assert.equal(alias.current.aliasFor, "Local:5:I.Data.29");
  assert.match(alias.summary, /pin\/wire mapping is not inferred/i);

  const module = result.differences.find((item) => item.category === "modules" && item.key === "Ethernet_IO_2");
  assert.ok(module);
  assert.equal(module.classification, "configuration-difference");
  assert.equal(module.baseline.slot, "4");
  assert.equal(module.current.slot, "5");
  assert.equal(module.baseline.address, "10.107.204.191");
  assert.equal(module.current.address, "10.107.204.192");
});

test("v2 compares fault writer evidence and preserves exact rung source changes", () => {
  const baseline = parse(fixture({ faultInput: "StartCondition" }), "known-good.L5K");
  const current = parse(fixture({ faultInput: "AlternateCondition" }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);

  const fault = result.differences.find((item) => item.category === "faults" && item.key === "Faults[1].13");
  assert.ok(fault);
  assert.equal(fault.classification, "source-proven");

  const rung = result.differences.find((item) => item.category === "rungs" && item.key.endsWith("/Faults/0"));
  assert.ok(rung);
  assert.match(rung.evidence.baselineSource, /XIC\(StartCondition\)/);
  assert.match(rung.evidence.currentSource, /XIC\(AlternateCondition\)/);
  assert.match(rung.summary, /does not assume the difference is defective/i);
});

test("v2 groups added and removed direct I/O references", () => {
  const baseline = parse(fixture(), "known-good.L5K");
  const current = parse(fixture({ aliasInput: "Local:5:I.Data.29", extraIoRung: true }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);
  const added = result.differences.find((item) => item.category === "io" && item.changeType === "added");
  const removed = result.differences.find((item) => item.category === "io" && item.changeType === "removed");
  assert.ok(added);
  assert.ok(removed);
  assert.ok(added.current.includes("Local:5:I.Data.29"));
  assert.ok(added.current.includes("Local:6:I.Data.2"));
  assert.ok(removed.baseline.includes("Local:5:I.Data.28"));
});

test("v2 detects motion/status source changes without claiming live axis health", () => {
  const baseline = parse(fixture({ motionMember: "FeedbackFault" }), "known-good.L5K");
  const current = parse(fixture({ motionMember: "ModuleSyncFault" }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);
  const motion = result.differences.find((item) => item.category === "motion");
  assert.ok(motion);
  assert.equal(motion.classification, "source-proven");
  assert.match(motion.summary, /runtime axis condition still requires live verification/i);
});

test("v2 filters differences by category, change type, review level, and search", () => {
  const baseline = parse(fixture(), "known-good.L5K");
  const current = parse(fixture({ timerPreset: 250, aliasInput: "Local:5:I.Data.29" }), "problem.L5K");
  const result = compare.compareProjects(baseline, current);
  const timers = compare.filterDifferences(result, { category: "timers" });
  assert.ok(timers.length >= 1);
  assert.ok(timers.every((item) => item.category === "timers"));
  const changedReview = compare.filterDifferences(result, { changeType: "changed", reviewLevel: "review" });
  assert.ok(changedReview.length >= 1);
  assert.ok(changedReview.every((item) => item.changeType === "changed" && item.reviewLevel === "review"));
  const search = compare.filterDifferences(result, { query: "VerifyTimer" });
  assert.ok(search.some((item) => item.category === "timers"));
});

test("v2 comparison remains browser-local, read-only, and worker-based", () => {
  const compareSource = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare.js"), "utf8");
  const workerSource = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  for (const source of [compareSource, uiSource, workerSource]) {
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  }
  assert.match(uiSource, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=2"\)/);
  assert.match(page, /Both files are parsed in your browser and are not uploaded/i);
  assert.match(page, /does not prove live state/i);
  assert.match(page, /does not connect to, write to, force, reset, or modify either PLC project/i);
});
