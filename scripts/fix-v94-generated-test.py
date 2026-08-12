from pathlib import Path

path = Path("tests/brand-selection-event-authority-v94.test.js")
text = path.read_text(encoding="utf-8")
start = text.find('const memoryHandler = coldGlue.match(')
end = text.find('assert.match(memoryHandler', start)
if start < 0 or end < 0:
    raise SystemExit("generated memory handler assertion anchors missing")
replacement = '''const memoryStart = coldGlue.indexOf("function bindBrandMemory");
const memoryEnd = coldGlue.indexOf("function install()", memoryStart);
const memoryHandler = memoryStart >= 0 && memoryEnd > memoryStart
  ? coldGlue.slice(memoryStart, memoryEnd)
  : "";
'''
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
