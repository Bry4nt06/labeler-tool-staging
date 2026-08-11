from pathlib import Path

path = Path("tests/bottle-orientation-panel.test.js")
text = path.read_text()
text = text.replace(
    'assert.match(source, /Reference-style clear glass bottle side view/);\nassert.match(source, /stop-color="#dce9ef"/);\nassert.match(source, /stop-opacity="\\.25"/);',
    'assert.match(source, /Pseudo-3D clear glass bottle side view/);\nassert.match(source, /data-pseudo-3d-glass=\\"true\\"/);\nassert.match(source, /stop-color="#dbe7ec"/);\nassert.match(source, /stop-opacity="\\.34"/);',
    1,
)
path.write_text(text)
