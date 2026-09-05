"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-legacy-v4.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare.js"));

const legacyFixture = `(*********************************************

  Import-Export
  Version   := RSLogix 5000 v15.02
  Owner     := Test User
**********************************************)
IE_VER := 2.6;

CONTROLLER Legacy_Test (ProcessorType := 1756-L61,
                        Major := 15)
  TAG
    StartCondition : BOOL := 0;
    ResetGeneral : BOOL := 0;
    TON_Verify : TIMER;
    MoveSource : DINT := 0;
    MoveDest : DINT := 0;
    AxisOne : AXIS_SERVO;
  END_TAG
  PROGRAM FaultLogic
    ROUTINE Faults
      RC: "Legacy RSLogix v15 neutral-text ladder records";
      N: XIC(StartCondition)TON(TON_Verify,250,0)XIC(TON_Verify.DN)OTL(Faults[1].13);
      N: XIC(ResetGeneral)OTU(Faults[1].13);
      N: MOV(MoveSource,MoveDest);
      N: XIC(AxisOne.FeedbackFault)OTE(Faults[4].3);
    END_ROUTINE
    ROUTINE Secondary
      N: XIC(StartCondition)OTE(Faults[2].1);
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v4 parses every legacy N: ladder record with real Program/Routine context", () => {
  const project = analyzer.parseL5K(legacyFixture, { fileName: "legacy.L5K", byteLength: legacyFixture.length });
  assert.equal(project.controller, "Legacy_Test");
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.statistics.rungs, 5);
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.source.legacyNeutralRungs, 5);

  const first = project.rungs.find((rung) => rung.source.includes("Faults[1].13") && rung.source.includes("TON_Verify"));
  assert.ok(first);
  assert.equal(first.program, "FaultLogic");
  assert.equal(first.routine, "Faults");
  assert.match(first.source, /^N:\s*XIC\(StartCondition\)/);
  assert.doesNotMatch(first.source, /^RUNG\b/i);

  const secondRoutine = project.rungs.find((rung) => rung.source.includes("Faults[2].1"));
  assert.ok(secondRoutine);
  assert.equal(secondRoutine.program, "FaultLogic");
  assert.equal(secondRoutine.routine, "Secondary");
});

test("v4 indexes legacy N: records even when they do not contain the old fallback instruction subset", () => {
  const project = analyzer.parseL5K(legacyFixture);
  const moveRung = project.rungs.find((rung) => rung.source.includes("MOV(MoveSource,MoveDest)"));
  assert.ok(moveRung, "MOV-only legacy rung should be indexed instead of discarded by fallback filtering");
  assert.equal(moveRung.routine, "Faults");
  assert.ok(moveRung.instructions.some((instruction) => instruction.name === "MOV"));
});

test("v4 preserves original source line coordinates after internal compatibility transformation", () => {
  const sourceLines = legacyFixture.replace(/\r\n?/g, "\n").split("\n");
  const expectedLine = sourceLines.findIndex((line) => line.includes("TON_Verify,250")) + 1;
  const project = analyzer.parseL5K(legacyFixture);
  const rung = project.rungs.find((item) => item.source.includes("TON_Verify,250"));
  const fault = project.faultWriters.find((item) => item.target === "Faults[1].13");
  assert.equal(rung.startLine, expectedLine);
  assert.equal(rung.endLine, expectedLine);
  assert.equal(fault.writers[0].line, expectedLine);
});

test("v4 preserves fault producer and reset evidence in legacy L5K", () => {
  const project = analyzer.parseL5K(legacyFixture);
  const fault = project.faultWriters.find((item) => item.target === "Faults[1].13");
  assert.ok(fault);
  assert.equal(fault.writerCount, 1);
  assert.equal(fault.writers[0].routine, "Faults");
  assert.equal(fault.writers[0].instruction, "OTL");
  assert.equal(fault.resets.length, 1);
  assert.equal(fault.resets[0].instruction, "OTU");
  assert.equal(fault.resets[0].routine, "Faults");

  const timer = project.timers.find((item) => item.tag === "TON_Verify");
  assert.ok(timer);
  assert.deepEqual(timer.presetValues, [250]);
});

test("v4 uses declared AXIS tags and retains the legacy status rung for import review", () => {
  const project = analyzer.parseL5K(legacyFixture);
  assert.ok(project.axes.some((axis) => axis.name === "AxisOne"));
  const axisFault = project.faultWriters.find((item) => item.target === "Faults[4].3");
  assert.ok(axisFault);
  assert.ok(axisFault.writers[0].symbols.includes("AxisOne.FeedbackFault"));
});

test("v4 comparison uses stable routine-local rung ordinals instead of source line numbers", () => {
  const withExtraComment = legacyFixture.replace(
    'RC: "Legacy RSLogix v15 neutral-text ladder records";',
    'RC: "Legacy RSLogix v15 neutral-text ladder records";\n      RC: "A comment was inserted but ladder order did not change";'
  );
  const baseline = analyzer.parseL5K(legacyFixture);
  const current = analyzer.parseL5K(withExtraComment);
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.differences.filter((difference) => difference.category === "rungs").length, 0);
});

test("v4 comparison still detects actual legacy ladder logic changes", () => {
  const changed = legacyFixture.replace("TON(TON_Verify,250,0)", "TON(TON_Verify,500,0)");
  const baseline = analyzer.parseL5K(legacyFixture);
  const current = analyzer.parseL5K(changed);
  const result = compare.compareProjects(baseline, current);
  assert.ok(result.differences.some((difference) => difference.category === "timers" && difference.key === "TON_Verify"));
  assert.ok(result.differences.some((difference) => difference.category === "rungs" && /FaultLogic\/Faults\//.test(difference.key)));
});

test("v4 leaves explicit RUNG/END_RUNG exports on the original parser path", () => {
  const explicit = `RSLogix 5000 Export Version 20.01\nCONTROLLER Explicit\nPROGRAM P\nROUTINE R\nRUNG 0\nN: XIC(A)OTE(Faults[0].1);\nEND_RUNG\nEND_ROUTINE\nEND_PROGRAM\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(explicit);
  assert.equal(project.statistics.rungs, 1);
  assert.equal(project.source.ladderEncoding, undefined);
  assert.equal(project.rungs[0].routine, "R");
});
