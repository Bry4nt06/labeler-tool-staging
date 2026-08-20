(function installServoForge3DProgressiveLabelFlow(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-progressive-label-flow.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const SECTION_ORDER = Object.freeze(["neck", "body", "back"]);
  const PRE_CAROUSEL_OWNERS = new Set(["infeed-conveyor", "infeed-star", "intermediate-star"]);
  const POST_CAROUSEL_OWNERS = new Set(["discharge-star", "outfeed-conveyor"]);

  let THREE = null;
  let threePromise = null;
  let handlingLayer = null;
  let running = false;
  let lastContractSignature = "";
  let lastStatus = null;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function smoothstep(value) {
    const t = clamp(number(value), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function labelFactory() {
    return global.Labeler3DLabelMeshFactory || null;
  }

  function programRows() {
    return Array.isArray(global.state?.program) ? global.state.program : [];
  }

  function rowSearchText(row) {
    if (!row || typeof row !== "object") return String(row || "").toUpperCase();
    return Object.entries(row)
      .filter(([key]) => !/^(id|index|cmd|command|angle|speed|duration|hmi)$/i.test(String(key)))
      .map(([, value]) => typeof value === "string" ? value : "")
      .join(" ")
      .toUpperCase();
  }

  function activeProgramSections(labelContract) {
    const rows = programRows();
    const text = rows.map(rowSearchText).join(" ");
    const sections = new Set();
    if (/\bNECK\b/.test(text)) sections.add("neck");
    if (/\bBODY\b|\bFRONT\b/.test(text)) sections.add("body");
    if (/\bBACK\b/.test(text)) sections.add("back");

    // Some older generated programs do not carry semantic section names on
    // every row. In that case the active label contract is the read-only
    // fallback, never an invented section.
    if (!sections.size) {
      (Array.isArray(labelContract?.activeSections) ? labelContract.activeSections : [])
        .forEach((section) => sections.add(String(section)));
    }
    return sections;
  }

  function contractForFlow(labelContract, activeSections) {
    const sections = {};
    SECTION_ORDER.forEach((sectionName) => {
      const source = labelContract?.sections?.[sectionName] || {};
      sections[sectionName] = Object.freeze({
        ...source,
        enabled: activeSections.has(sectionName) && Boolean(source.enabled),
        applied: false
      });
    });
    return Object.freeze({
      ...(labelContract || {}),
      activeSections: SECTION_ORDER.filter((section) => sections[section]?.enabled),
      appliedSections: Object.freeze([]),
      sections: Object.freeze(sections),
      progressiveFlowAuthority: "active-servoforge-program-sections-plus-head1-application-angles"
    });
  }

  function contractSignature(snapshot, flowContract) {
    return [
      flowContract?.brand,
      ...SECTION_ORDER.flatMap((section) => {
        const item = flowContract?.sections?.[section] || {};
        return [section, Boolean(item.enabled), number(item.applicationAngleDegrees, -1), number(item.wrapDegrees), number(item.bottomWorld), number(item.topWorld)];
      }),
      snapshot?.geometry?.bottle?.effectiveDiameterMm,
      snapshot?.geometry?.bottle?.visualHeightWorld,
      JSON.stringify(programRows())
    ].join("|");
  }

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
      child.userData?.texture?.dispose?.();
    });
  }

  function handlingBottles() {
    if (!handlingLayer?.traverse) return [];
    const bottles = [];
    handlingLayer.traverse((child) => {
      if (child?.userData?.handlingBottle) bottles.push(child);
    });
    return bottles;
  }

  function removeBottleLabels(bottle) {
    const existing = bottle?.children?.filter((child) => child?.name === "ServoForgeProgressiveBottleLabels") || [];
    existing.forEach((group) => {
      bottle.remove(group);
      disposeObject(group);
    });
  }

  function ensureBottleLabels(bottle, flowContract, geometry) {
    if (!bottle || !THREE) return null;
    const existing = bottle.children?.find((child) => child?.name === "ServoForgeProgressiveBottleLabels");
    if (existing?.userData?.contractSignature === lastContractSignature) return existing;
    removeBottleLabels(bottle);

    const factory = labelFactory();
    if (!factory?.createBottleLabels) return null;
    const labels = factory.createBottleLabels(THREE, flowContract, geometry);
    if (!labels) return null;
    labels.name = "ServoForgeProgressiveBottleLabels";
    labels.userData.contractSignature = lastContractSignature;
    labels.userData.progressiveLabelFlow = true;
    labels.userData.labelMeshes = labels.userData.labelMeshes || {};
    Object.values(labels.userData.labelMeshes).forEach((mesh) => {
      if (!mesh) return;
      mesh.visible = false;
      mesh.userData.applyProgress = 0;
      if (mesh.material) {
        mesh.material = mesh.material.clone();
        mesh.material.transparent = true;
        mesh.material.opacity = 0;
        mesh.material.depthWrite = true;
      }
    });
    bottle.add(labels);
    return labels;
  }

  function sectionProgress(bottle, section, headPitchDegrees) {
    if (!section?.enabled) return 0;
    const owner = String(bottle?.userData?.owner || "");
    if (PRE_CAROUSEL_OWNERS.has(owner)) return 0;
    if (POST_CAROUSEL_OWNERS.has(owner)) return 1;
    if (owner !== "carousel") return 0;

    const tableAngle = Number(bottle?.userData?.tableAngleDegrees);
    const applicationAngle = Number(section?.applicationAngleDegrees);
    if (!Number.isFinite(tableAngle)) return 0;
    if (!Number.isFinite(applicationAngle)) return 1;

    // Mirror Head 1's existing staged rule: a section becomes eligible once
    // the bottle table angle has passed its ServoForge application angle.
    const delta = tableAngle - applicationAngle;
    if (delta < 0) return 0;
    const animationWindowDegrees = Math.max(2.5, number(headPitchDegrees, 8) * 0.85);
    return smoothstep(delta / animationWindowDegrees);
  }

  function applyVisualProgress(mesh, progress, sectionName) {
    if (!mesh) return;
    const p = clamp(progress, 0, 1);
    mesh.visible = p > 0.001;
    mesh.userData.applyProgress = p;
    mesh.userData.applicationState = p <= 0.001 ? "unapplied" : p >= 0.999 ? "applied" : "wrapping";

    // A short, restrained settle approximates the label entering at the
    // application point and conforming to the bottle without cartoon motion.
    const entrySign = sectionName === "back" ? -1 : 1;
    mesh.rotation.y = entrySign * (1 - p) * 0.10;
    const radialSettle = 1 + (1 - p) * 0.035;
    mesh.scale.set(radialSettle, 0.985 + p * 0.015, radialSettle);
    mesh.position.x = entrySign * (1 - p) * 0.014;
    if (mesh.material) {
      mesh.material.opacity = clamp(0.18 + p * 0.82, 0, 1);
      mesh.material.transparent = p < 0.999;
      mesh.material.needsUpdate = true;
    }
  }

  function updateBottleLabels(bottle, flowContract, geometry, headPitchDegrees) {
    const labels = ensureBottleLabels(bottle, flowContract, geometry);
    if (!labels) return;
    SECTION_ORDER.forEach((sectionName) => {
      const section = flowContract?.sections?.[sectionName];
      const mesh = labels.userData?.labelMeshes?.[sectionName];
      const progress = sectionProgress(bottle, section, headPitchDegrees);
      applyVisualProgress(mesh, progress, sectionName);
    });
  }

  function renderFrame() {
    if (!running) return;
    try {
      const activeRuntime = runtime();
      if (handlingLayer && activeRuntime?.snapshot && labelFactory()?.createBottleLabels) {
        const snapshot = activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
          scene: { tableY: 0.20, bottleLift: 0.155, unitMode: "progressive-label-flow-v1" }
        });
        const activeSections = activeProgramSections(snapshot?.labels);
        const flowContract = contractForFlow(snapshot?.labels, activeSections);
        const signature = contractSignature(snapshot, flowContract);
        if (signature !== lastContractSignature) {
          lastContractSignature = signature;
          handlingBottles().forEach(removeBottleLabels);
        }

        const headCount = Math.max(1, number(snapshot?.geometry?.machine?.headCount, 45));
        const headPitchDegrees = 360 / headCount;
        const bottles = handlingBottles();
        bottles.forEach((bottle) => updateBottleLabels(bottle, flowContract, snapshot.geometry, headPitchDegrees));
        lastStatus = Object.freeze({
          integrationVersion: INTEGRATION_VERSION,
          bottleCount: bottles.length,
          activeSections: Object.freeze([...activeSections]),
          applicationAngles: Object.freeze(Object.fromEntries(SECTION_ORDER.map((section) => [section, flowContract?.sections?.[section]?.applicationAngleDegrees ?? null]))),
          head1ReferenceAuthority: true,
          programSectionAuthority: true,
          progressiveWrapAnimation: true,
          servoWrites: false,
          plannerWrites: false
        });
      }
    } catch (error) {
      console.warn("ServoForge progressive label-flow frame skipped", error);
    }
  }

  function startLoop() {
    if (running) return;
    const coordinator = global.Labeler3DPresentationFrameCoordinator;
    if (!coordinator?.register) {
      console.warn("ServoForge 3D presentation frame coordinator is unavailable.");
      return;
    }
    running = true;
    coordinator.register(INTEGRATION_VERSION, renderFrame, { minIntervalMs: 0 });
  }

  function captureHandlingLayer(candidate) {
    if (candidate?.name !== "ServoForgeBottleHandlingSystem") return;
    handlingLayer = candidate;
    startLoop();
  }

  function installSceneHook() {
    const prototype = THREE?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeProgressiveLabelFlowHookV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeProgressiveLabelFlowAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach(captureHandlingLayer);
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeProgressiveLabelFlowHookV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function status() {
    return lastStatus || Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      bottleCount: 0,
      activeSections: Object.freeze([]),
      head1ReferenceAuthority: true,
      programSectionAuthority: true,
      progressiveWrapAnimation: true,
      servoWrites: false,
      plannerWrites: false
    });
  }

  global.Labeler3DProgressiveLabelFlow = Object.freeze({
    INTEGRATION_VERSION,
    SECTION_ORDER,
    status
  });

  ensureThree()
    .then(() => installSceneHook())
    .catch((error) => console.error("ServoForge progressive label-flow integration failed", error));
})(window);
