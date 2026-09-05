"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-core.js"));

const fixture = `
RSLogix 5000 Export Version 15.02
CONTROLLER CO85_LB1_APLCart_1_V35 (ProcessorType := 1756-L61)
  TAG
    Logic_0 : BOOL := 0;
    ResetGeneral : BOOL := 0;
    StartCondition : BOOL := 0;
    WebBreakTime : DINT := 0;
    TON_SensorVerification : TIMER;
    CtuEndOfReel1 : COUNTER;
    E5701_PE621_FeedUnitFront : BOOL (Alias For := "Local:5:I.Data.28");
    MainDriveAxis : AXIS_SERVO;
  END_TAG
  MODULE Ethernet_IO_2 (
    Parent := Local,
    Slot := 4,
    NodeAddress := 10.107.204.191,
    CatalogNumber := "1756-ENBT/A"
  )
  END_MODULE
  PROGRAM FaultLogic
    ROUTINE Faults (Type := RLL)
      RUNG 0
        N: XIC(StartCondition)OTL(Faults[1].13);
      END_RUNG
      RUNG 1
        N: XIC(ResetGeneral)OTU(Faults[1].13);
      END_RUNG
      RUNG 2
        N: XIO(E5701_PE621_FeedUnitFront)TON(TON_SensorVerification,100,0)XIC(TON_SensorVerification.DN)OTE(Faults[1].11);
      END_RUNG
      RUNG 3
        N: ADD(WebBreakTime,1,WebBreakTime)GRT(WebBreakTime,1000)OTL(Faults[1].13);
      END_RUNG
      RUNG 4
        N: CTU(CtuEndOfReel1,5,0)XIC(CtuEndOfReel1.DN)OTL(Faults[1].9);
      END_RUNG
      RUNG 5
        N: XIC(ResetGeneral)RES(CtuEndOfReel1);
      END_RUNG
      RUNG 6
        N: GSV(MODULE,Ethernet_IO_2,FaultCode,EthernetModuleSlot4FaultData)NEQ(EthernetModuleSlot4FaultData,0)OTE(Faults[0].13);
      END_RUNG
      RUNG 7
        N: XIC(MainDriveAxis.FeedbackFault)OTE(Faults[4].3);
      END_RUNG
      RUNG 8
        N: XIC(Logic_0)OTE(Faults[2].8);
      END_RUNG
      RUNG 9
        N: XIC(MainDriveAxis.Ready)MSO(MainDriveAxis);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v1 parses controller structure, tags, modules, axes, and rungs", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "sample.L5K", byteLength: fixture.length });
  assert.equal(project.controller, "CO85_LB1_APLCart_1_V35");
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.statistics.programs, 1);
  assert.equal(project.statistics.routines, 1);
  assert.equal(project.statistics.rungs, 10);
  assert.ok(project.tags.some((tag) => tag.name === "MainDriveAxis" && /AXIS/i.test(tag.dataType)));
  assert.ok(project.axes.some((axis) => axis.name === "MainDriveAxis"));
  const module = project.modules.find((item) => item.name === "Ethernet_IO_2");
  assert.ok(module);
  assert.equal(module.slot, "4");
  assert.equal(module.catalog, "1756-ENBT/A");
});

test("v1 traces OTL producers and matching OTU reset paths", () => {
  const project = analyzer.parseL5K(fixture);
  const fault = project.faultWriters.find((item) => item.target === "Faults[1].13");
  assert.ok(fault);
  assert.equal(fault.writerCount, 2);
  assert.ok(fault.writers.every((writer) => writer.instruction === "OTL"));
  assert.equal(fault.resets.length, 1);
  assert.equal(fault.resets[0].instruction, "OTU");
  assert.ok(project.findings.some((finding) => finding.id === "multiple-writers:Faults[1].13"));
  assert.equal(project.findings.some((finding) => finding.id === "latched-no-otu:Faults[1].13"), false);
});

test("v1 distinguishes a native TON from a PLC-cycle counter candidate", () => {
  const project = analyzer.parseL5K(fixture);
  const timer = project.timers.find((item) => item.tag === "TON_SensorVerification");
  assert.ok(timer);
  assert.deepEqual(timer.presetValues, [100]);
  assert.ok(timer.instructions.some((item) => item.type === "TON"));
  const pseudo = project.findings.find((finding) => finding.id === "scan-counter:WebBreakTime");
  assert.ok(pseudo);
  assert.equal(pseudo.classification, "static-inference");
  assert.match(pseudo.summary, /do not interpret.*milliseconds/i);
});

test("v1 extracts counters and their RES path", () => {
  const project = analyzer.parseL5K(fixture);
  const counter = project.counters.find((item) => item.tag === "CtuEndOfReel1");
  assert.ok(counter);
  assert.ok(counter.instructions.some((item) => item.type === "CTU"));
  assert.deepEqual(counter.presetValues, [5]);
  assert.equal(counter.resets.length, 1);
  assert.equal(counter.resets[0].instruction, "RES");
});

test("v1 indexes MODULE GSV evidence, I/O aliases, and motion status references", () => {
  const project = analyzer.parseL5K(fixture);
  assert.ok(project.moduleStatusReads.some((read) => read.instance === "Ethernet_IO_2" && read.attribute === "FaultCode" && read.destination === "EthernetModuleSlot4FaultData"));
  assert.ok(project.tags.some((tag) => tag.name === "E5701_PE621_FeedUnitFront" && tag.aliasFor === "Local:5:I.Data.28"));
  assert.ok(project.ioReferences.includes("Local:5:I.Data.28"));
  assert.ok(project.motionReferences.some((ref) => ref.instruction === "STATUS" && ref.source === "MainDriveAxis.FeedbackFault"));
  assert.ok(project.motionReferences.some((ref) => ref.instruction === "MSO" && ref.axis === "MainDriveAxis"));
});

test("v1 preserves Logic_0 source evidence instead of promoting an active hardware fault", () => {
  const project = analyzer.parseL5K(fixture);
  const fault = project.faultWriters.find((item) => item.target === "Faults[2].8");
  assert.ok(fault);
  const finding = project.findings.find((item) => item.id === "constant-driver:Faults[2].8");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.match(finding.summary, /inactive alarm position/i);
});

test("v1 exact address/tag search outranks fuzzy rung matches", () => {
  const project = analyzer.parseL5K(fixture);
  const faultMatches = analyzer.searchAnalysis(project, "Faults[1].13", 10);
  assert.equal(faultMatches[0].type, "fault");
  assert.equal(faultMatches[0].key, "Faults[1].13");
  const timerMatches = analyzer.searchAnalysis(project, "TON_SensorVerification", 10);
  assert.equal(timerMatches[0].type, "timer");
  assert.equal(timerMatches[0].key, "TON_SensorVerification");
});

test("v1 parser is local/read-only and UI states that files are not uploaded", () => {
  const coreSource = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-core.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  assert.doesNotMatch(coreSource, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(uiSource, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.match(uiSource, /new Worker\("\.\/l5k-analyzer-worker\.js\?v=1"\)/);
  assert.match(page, /parsed in your browser and is not uploaded/i);
  assert.match(page, /static source analysis, not PLC simulation/i);
});
