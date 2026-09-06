"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-dependencies-v5.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-dependencies-v5-2.js"));

function fixture(options = {}) {
  const main = options.main || "MainRoutine";
  const memberType = options.memberType || "BOOL";
  const includeJsr = options.includeJsr !== false;
  const extraJsr = options.extraJsr ? `\n      RUNG 1\n        N: JSR(ExtraRoutine);\n      END_RUNG` : "";
  const aoiUsage = options.aoiUsage || "Input";
  const aoiArgument = options.aoiArgument || "InputA";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Compare_Dependency
  DATATYPE DeviceState
    ${memberType} Ready;
  END_DATATYPE
  ADD_ON_INSTRUCTION_DEFINITION DemoAOI
    PARAMETERS
      Enable : BOOL (Usage := ${aoiUsage});
      Status : BOOL (Usage := Output);
    END_PARAMETERS
  END_ADD_ON_INSTRUCTION_DEFINITION
  TAG
    Device : DeviceState;
    DemoInst : DemoAOI;
    InputA : BOOL;
    InputB : BOOL;
    Faults : DINT[1];
  END_TAG
  PROGRAM P (MAIN := ${main})
    ROUTINE MainRoutine
      RUNG 0
        N: ${includeJsr ? "JSR(FaultRoutine);" : "XIC(InputA)OTE(InputB);"}
      END_RUNG${extraJsr}
    END_ROUTINE
    ROUTINE AlternateMain
      RUNG 0
        N: JSR(FaultRoutine);
      END_RUNG
    END_ROUTINE
    ROUTINE FaultRoutine
      RUNG 0
        N: XIC(Device.Ready)DemoAOI(DemoInst,${aoiArgument})XIC(DemoInst.Status)OTL(Faults[0].1);
      END_RUNG
    END_ROUTINE
    ROUTINE ExtraRoutine
      RUNG 0
        N: XIC(InputA)OTE(InputB);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER`;
}

test("v5.2 reports no dependency differences for identical dependency-enabled exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.statistics.dependencyDifferences, 0);
  assert.equal(result.differences.filter((item) => item.category === "dependencies").length, 0);
  assert.equal(result.version, "l5k-compare-v5.2");
});

test("v5.2 detects PROGRAM MAIN changes as dependency differences", () => {
  const baseline = analyzer.parseL5K(fixture({ main: "MainRoutine" }));
  const current = analyzer.parseL5K(fixture({ main: "AlternateMain" }));
  const result = compare.compareProjects(baseline, current);
  const difference = result.differences.find((item) => item.category === "dependencies" && item.dependencyKind === "program-main");
  assert.ok(difference);
  assert.equal(difference.changeType, "changed");
  assert.equal(difference.baseline.mainRoutine, "MainRoutine");
  assert.equal(difference.current.mainRoutine, "AlternateMain");
});

test("v5.2 detects JSR call graph additions/removals without claiming runtime execution", () => {
  const baseline = analyzer.parseL5K(fixture({ extraJsr: false }));
  const current = analyzer.parseL5K(fixture({ extraJsr: true }));
  const result = compare.compareProjects(baseline, current);
  const added = result.differences.find((item) => item.category === "dependencies" && item.dependencyKind === "routine-call" && item.changeType === "added" && /ExtraRoutine/.test(item.title));
  assert.ok(added);
  assert.match(added.summary, /source call graph/i);
  assert.match(result.dependencyComparison.sourceBoundary, /does not prove runtime execution/i);
});

test("v5.2 detects UDT member data-type changes", () => {
  const baseline = analyzer.parseL5K(fixture({ memberType: "BOOL" }));
  const current = analyzer.parseL5K(fixture({ memberType: "DINT" }));
  const result = compare.compareProjects(baseline, current);
  const changed = result.differences.find((item) => item.category === "dependencies" && item.dependencyKind === "udt");
  assert.ok(changed);
  assert.equal(changed.changeType, "changed");
  assert.equal(changed.baseline.members[0].dataType, "BOOL");
  assert.equal(changed.current.members[0].dataType, "DINT");
});

test("v5.2 detects AOI definition and invocation argument changes", () => {
  const baseline = analyzer.parseL5K(fixture({ aoiUsage: "Input", aoiArgument: "InputA" }));
  const current = analyzer.parseL5K(fixture({ aoiUsage: "InOut", aoiArgument: "InputB" }));
  const result = compare.compareProjects(baseline, current);
  assert.ok(result.differences.some((item) => item.category === "dependencies" && item.dependencyKind === "aoi-definition" && item.changeType === "changed"));
  assert.ok(result.differences.some((item) => item.category === "dependencies" && item.dependencyKind === "aoi-call" && item.changeType === "changed"));
});

test("v5.2 dependency category can be filtered with the existing comparison filter API", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ main: "AlternateMain", memberType: "DINT" }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "dependencies" });
  assert.ok(filtered.length >= 2);
  assert.ok(filtered.every((item) => item.category === "dependencies"));
});

test("v5.2 Compare layer remains local/read-only under the current v11.1 sequence-aware release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-dependencies-v5-2.js"), "utf8");
  const dependencies = page.indexOf("l5k-analyzer-dependencies-v5.js?v=5");
  const messageParser = page.indexOf("l5k-analyzer-message-v9.js?v=9");
  const consistencyParser = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const sequenceParser = page.indexOf("l5k-analyzer-sequence-v11.js?v=11");
  const baseCompare = page.indexOf("l5k-analyzer-compare.js?v=2");
  const wrapper = page.indexOf("l5k-analyzer-compare-dependencies-v5-2.js?v=5.2");
  const taskWrapper = page.indexOf("l5k-analyzer-compare-task-schedule-v7-1.js?v=7.1");
  const communicationWrapper = page.indexOf("l5k-analyzer-compare-communication-v8-1.js?v=8.1");
  const messageWrapper = page.indexOf("l5k-analyzer-compare-message-v9-1.js?v=9.1");
  const consistencyWrapper = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const sequenceWrapper = page.indexOf("l5k-analyzer-compare-sequence-v11-1.js?v=11.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=11.1");
  assert.ok(dependencies >= 0 && dependencies < messageParser && messageParser < consistencyParser && consistencyParser < sequenceParser && sequenceParser < baseCompare && baseCompare < wrapper && wrapper < taskWrapper && taskWrapper < communicationWrapper && communicationWrapper < messageWrapper && messageWrapper < consistencyWrapper && consistencyWrapper < sequenceWrapper && sequenceWrapper < uiScript);
  assert.match(page, /value="dependencies"/);
  assert.match(page, /PLC ANALYZER COMPARE v9\.1 — MSG \/ MESSAGE DIFF/);
  assert.match(page, /v11\.1 SEQUENCE DIFF/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=11\.1"\)/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
