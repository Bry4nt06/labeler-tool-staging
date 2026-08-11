from pathlib import Path
import json,re

BUILD='top-view-mount-recovery-v85-20260811-1928'
UPDATED='Aug 11, 2026 7:28 PM ET'

recovery=Path('app/bottle-orientation-panel-recovery-integration.js')
s=recovery.read_text()
s=s.replace('  const VERSION = 3;','  const VERSION = 4;',1)
s=s.replace('  let recoveryQueued = false;','  let recoveryQueued = false;\n  let documentObserver = null;',1)
old='''  function recoverAll() {
    recoveryQueued = false;
    sources.forEach(recoverSource);
  }
'''
new='''  function recoverAll() {
    recoveryQueued = false;
    // Reacquire the workspace hosts every recovery pass. The Servo Program
    // workspace can be rebuilt after this integration first loads, so a one-time
    // observer install is not sufficient to keep the live Top View mounted.
    sources.forEach((source) => {
      observeHost(source);
      recoverSource(source);
    });
  }
'''
assert old in s
s=s.replace(old,new,1)
anchor='''  function observeHost(source) {
    const host = typeof document !== "undefined" ? document.getElementById(source) : null;
    if (!host || observers.has(source) || typeof MutationObserver !== "function") return false;
'''
replace='''  function observeHost(source) {
    const host = typeof document !== "undefined" ? document.getElementById(source) : null;
    const existing = observers.get(source);
    if (existing?.host === host && host?.isConnected) return true;
    if (existing?.observer) {
      try { existing.observer.disconnect(); } catch { /* ignore stale observer */ }
      observers.delete(source);
    }
    if (!host || typeof MutationObserver !== "function") return false;
'''
assert anchor in s
s=s.replace(anchor,replace,1)
s=s.replace('''    observers.set(source, observer);
    return true;
  }

  function install() {
    sources.forEach(observeHost);
    recoverAll();
''','''    observers.set(source, { host, observer });
    return true;
  }

  function observeDocument() {
    if (documentObserver || typeof document === "undefined" || typeof MutationObserver !== "function" || !document.body) return false;
    documentObserver = new MutationObserver(() => queueRecovery());
    documentObserver.observe(document.body, { childList: true, subtree: true });
    return true;
  }

  function install() {
    observeDocument();
    sources.forEach(observeHost);
    recoverAll();
''',1)
s=s.replace('''    recoverAll,
    servoProgramPanelGuaranteedV75: true,''','''    recoverAll,
    observeHost,
    observeDocument,
    servoProgramPanelGuaranteedV75: true,
    persistentTopViewMountV85: true,
    workspaceHostReacquireV85: true,''',1)
recovery.write_text(s)

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
d['notes']='v85 repairs Bottle Orientation Top View mounting. The panel remains Top View only, with no side view, no standalone controls, and no wipe graphic. Recovery now reacquires rebuilt Servo Program/Simulation hosts and remounts the live Top View after workspace rerenders.'
manifest.write_text(json.dumps(d,indent=2)+'\n')

test=Path('tests/bottle-orientation-mount-recovery.test.js')
test.write_text('''"use strict";\nconst assert=require("assert");\nconst fs=require("fs");\nconst path=require("path");\nconst root=path.resolve(__dirname,"..");\nconst recovery=fs.readFileSync(path.join(root,"app/bottle-orientation-panel-recovery-integration.js"),"utf8");\nconst panel=fs.readFileSync(path.join(root,"app/bottle-orientation-panel-integration.js"),"utf8");\nconst bootstrap=fs.readFileSync(path.join(root,"app/bootstrap.js"),"utf8");\nconst manifest=JSON.parse(fs.readFileSync(path.join(root,"update-manifest.json"),"utf8"));\nassert.match(panel,/topViewOnlyV84: true/);\nassert.doesNotMatch(panel,/data-orientation-side/);\nassert.doesNotMatch(panel,/>WIPE<\\/text>/);\nassert.match(recovery,/const VERSION = 4/);\nassert.match(recovery,/observeDocument/);\nassert.match(recovery,/observeHost\\(source\\);\\n      recoverSource\\(source\\);/);\nassert.match(recovery,/existing\\?\\.host === host/);\nassert.match(recovery,/observers\\.set\\(source, \\{ host, observer \\}\\)/);\nassert.match(recovery,/persistentTopViewMountV85: true/);\nassert.match(recovery,/workspaceHostReacquireV85: true/);\nassert.match(bootstrap,/top-view-mount-recovery-v85-20260811-1928/);\nassert.equal(manifest.buildId,"top-view-mount-recovery-v85-20260811-1928");\nconsole.log("Bottle Orientation top-view mount recovery v85 regression passed.");\n''')
