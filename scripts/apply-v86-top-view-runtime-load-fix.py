from pathlib import Path
import json,re

BUILD='top-view-runtime-load-fix-v86-20260811-1932'
UPDATED='Aug 11, 2026 7:32 PM ET'

panel=Path('app/bottle-orientation-panel-integration.js')
s=panel.read_text()
s=s.replace('  const VERSION = 9;','  const VERSION = 10;',1)
assert '    sideViewSvg,\n' in s
s=s.replace('    sideViewSvg,\n','',1)
s=s.replace('    mainAnimationOnlyV84: true,','    mainAnimationOnlyV84: true,\n    staleSideViewExportRemovedV86: true,',1)
panel.write_text(s)

bootstrap=Path('app/bootstrap.js')
t=bootstrap.read_text()
t=re.sub(r'const build = "[^"]+";',f'const build = "{BUILD}";',t,count=1)
t=re.sub(r'const buildUpdatedAt = "[^"]+";',f'const buildUpdatedAt = "{UPDATED}";',t,count=1)
t=t.replace('// Regression lineage:',f'// Regression lineage: {BUILD} •',1)
bootstrap.write_text(t)

update=Path('app/update-manager.js')
t=update.read_text(); t=re.sub(r'const BUILD_ID = "[^"]+";',f'const BUILD_ID = "{BUILD}";',t,count=1); update.write_text(t)

sw=Path('service-worker.js')
t=sw.read_text(); t=re.sub(r'const CACHE_NAME = "[^"]+";',f'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-{BUILD}";',t,count=1); sw.write_text(t)

manifest=Path('update-manifest.json')
d=json.loads(manifest.read_text())
d['buildId']=BUILD
d['notes']='v86 fixes Bottle Orientation module startup. v84 removed the Side View renderer but left a stale sideViewSvg export, causing a runtime ReferenceError before the Top View API could install. The stale export is removed; Top View-only layout and v85 mount recovery remain unchanged.'
manifest.write_text(json.dumps(d,indent=2)+'\n')

for filename in ['tests/bottle-orientation-panel.test.js','tests/bottle-orientation-mount-recovery.test.js']:
    p=Path(filename)
    t=p.read_text()
    t=t.replace('top-view-mount-recovery-v85-20260811-1928',BUILD)
    t=t.replace('Top-view-only Bottle Orientation v85 regression passed.','Top-view-only Bottle Orientation v86 regression passed.')
    if filename.endswith('bottle-orientation-panel.test.js'):
        marker='assert.doesNotMatch(source,/function sideViewSvg/);\n'
        assert marker in t
        t=t.replace(marker,marker+'assert.doesNotMatch(source,/\\n\\s*sideViewSvg,/);\nassert.match(source,/staleSideViewExportRemovedV86: true/);\n',1)
    p.write_text(t)

runtime=Path('tests/bottle-orientation-runtime-load.test.js')
runtime.write_text('''"use strict";\nconst assert=require("assert");\nconst fs=require("fs");\nconst path=require("path");\nconst source=fs.readFileSync(path.resolve(__dirname,"../app/bottle-orientation-panel-integration.js"),"utf8");\nassert.doesNotMatch(source,/function sideViewSvg/);\nassert.doesNotMatch(source,/\\n\\s*sideViewSvg,/);\nconst exported=(source.match(/global\\.LabelerBottleOrientationPanel = Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\);/)||[])[1]||"";\nassert.ok(exported.includes("topViewSvg"),"Top View renderer must remain exported");\nassert.ok(!exported.includes("sideViewSvg"),"Removed Side View renderer must not remain in the API export");\nassert.match(source,/staleSideViewExportRemovedV86: true/);\nconsole.log("Bottle Orientation runtime export v86 regression passed.");\n''')
