from pathlib import Path

path = Path("app/bottle-orientation-panel-integration.js")
source = path.read_text()

if "pseudo3dBottleSideViewV81: true" not in source:
    anchor = "    mechanicalMapTransformParityV80: true\n"
    replacement = (
        "    mechanicalMapTransformParityV80: true,\n"
        "    pseudo3dBottleSideViewV81: true,\n"
        "    curvedWrappedLabelBandV81: true,\n"
        "    orientationDepthCueV81: true\n"
    )
    if anchor not in source:
        raise SystemExit("Could not locate v80 capability marker anchor")
    source = source.replace(anchor, replacement, 1)

path.write_text(source)
