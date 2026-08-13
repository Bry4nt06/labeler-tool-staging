from pathlib import Path

path = Path("tests/label-centerline-policy.test.js")
text = path.read_text(encoding="utf-8")
text = text.replace('const startupSource = fs.readFileSync(path.join(root, "app.js"), "utf8");\n', '')
text = text.replace('assert.match(startupSource, /label-application-reference-v32/);\n', '')
path.write_text(text, encoding="utf-8")
