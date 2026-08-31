"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const defaultsSource = fs.readFileSync(path.join(root, "app/defaults.js"), "utf8");
const defaultProgramsDir = path.join(root, "config/default-programs");

assert.match(
  defaultsSource,
  /brushInner:\s*-16\b/,
  "the legacy/global inside brush default must remain -16"
);

const coldGlueMaps = fs.readdirSync(defaultProgramsDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    value: JSON.parse(fs.readFileSync(path.join(defaultProgramsDir, name), "utf8"))
  }))
  .filter(({ value }) => value?.applicationMode === "cold-glue");

assert.ok(coldGlueMaps.length > 0, "at least one saved Cold Glue default map must be present");
for (const { name, value } of coldGlueMaps) {
  assert.equal(
    Number(value?.depths?.brushInner),
    -16,
    `${name} must store the default inside brush depth at -16`
  );
}

console.log(`Cold Glue inside brush depth regression passed for ${coldGlueMaps.length} default map(s).`);
