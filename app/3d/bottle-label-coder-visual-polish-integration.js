(function installServoForge3DBottleLabelCoderVisualPolish(global) {
  "use strict";

  const baseLabelAdapter = global.Labeler3DLabelGeometryAdapter;
  const baseLabelFactory = global.Labeler3DLabelMeshFactory;
  const baseHardwareFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseLabelAdapter?.snapshot || !baseLabelFactory?.createBottleLabels || !baseHardwareFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge bottle/label/coder visual polish requires the active label and hardware factories.");
  }

  const PATCH_VERSION = "servoforge.3d-bottle-label-coder-polish.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const CODER_LENS_DIAMETER_MM = 76.2;
  const LABEL_TEXT = "I ♥ Beer";
  const beerTextureCaches = new WeakMap();

  let THREE = null;
  let threePromise = null;
  let amberGlassMaterial = null;
  let silverCrownMaterial = null;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function centeredNeckSection(section, geometry) {
    if (!section?.enabled) return section;
    const bottle = geometry?.bottle || {};
    const bodyTopMm = 10 + Math.max(1, number(bottle.bodyStraightHeightMm, 92));
    const shoulderTopMm = bodyTopMm + Math.max(1, number(bottle.shoulderTransitionHeightMm, 41.5));
    const finishStartMm = Math.max(
      shoulderTopMm + 1,
      number(bottle.referenceHeightMm, 241.5) - Math.max(1, number(bottle.finishHeightMm, 17))
    );
    const zoneHeightMm = Math.max(1, finishStartMm - shoulderTopMm);
    const heightMm = Math.min(Math.max(1, number(section.heightMm, 36)), zoneHeightMm);
    const bottomMm = clamp((shoulderTopMm + finishStartMm - heightMm) / 2, shoulderTopMm, finishStartMm - heightMm);
    const topMm = bottomMm + heightMm;
    const scale = unitsPerMm(geometry);
    return Object.freeze({
      ...section,
      bottomMm,
      topMm,
      heightMm,
      bottomWorld: bottomMm * scale,
      topWorld: topMm * scale,
      heightWorld: heightMm * scale,
      verticalPlacementAuthority: true,
      verticalSource: "user-requested-centered-mid-neck-label-zone"
    });
  }

  function labelSnapshot(stateLike = {}, geometry = {}, machineMap = null, tableAngle = 0) {
    const base = baseLabelAdapter.snapshot(stateLike, geometry, machineMap, tableAngle);
    const neck = centeredNeckSection(base?.sections?.neck, geometry);
    const sections = Object.freeze({ ...(base.sections || {}), neck });
    return Object.freeze({
      ...base,
      sections,
      neckVerticalAuthority: "user-requested-mid-neck-zone",
      artworkText: LABEL_TEXT,
      artworkAuthority: "user-requested-3d-reference-artwork"
    });
  }

  global.Labeler3DLabelGeometryAdapter = Object.freeze({
    ...baseLabelAdapter,
    SCHEMA_VERSION: "servoforge.3d-labels.v2-centered-neck",
    PATCH_VERSION,
    snapshot: labelSnapshot
  });

  function createBeerLabelTexture(THREERef, sectionName) {
    if (!global.document?.createElement || !THREERef?.CanvasTexture) return null;
    let cache = beerTextureCaches.get(THREERef);
    if (!cache) {
      cache = new Map();
      beerTextureCaches.set(THREERef, cache);
    }
    const cacheKey = String(sectionName || "body").toLowerCase();
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const canvas = global.document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const section = String(sectionName || "body").toUpperCase();
    ctx.fillStyle = "#f5efe0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#202a33";
    ctx.lineWidth = 18;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 112px Arial, sans-serif";
    const left = "I ";
    const heart = "♥";
    const right = " Beer";
    const leftWidth = ctx.measureText(left).width;
    const heartWidth = ctx.measureText(heart).width;
    const rightWidth = ctx.measureText(right).width;
    const totalWidth = leftWidth + heartWidth + rightWidth;
    let x = (canvas.width - totalWidth) / 2;
    const y = canvas.height * 0.47;

    ctx.textAlign = "left";
    ctx.fillStyle = "#18242d";
    ctx.fillText(left, x, y);
    x += leftWidth;
    ctx.fillStyle = "#b72e32";
    ctx.fillText(heart, x, y - 2);
    x += heartWidth;
    ctx.fillStyle = "#18242d";
    ctx.fillText(right, x, y);

    ctx.textAlign = "center";
    ctx.font = "600 34px Arial, sans-serif";
    ctx.fillStyle = "#6d655d";
    ctx.fillText(`${section} LABEL`, canvas.width / 2, canvas.height * 0.77);

    const texture = new THREERef.CanvasTexture(canvas);
    texture.colorSpace = THREERef.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    texture.userData = { ...(texture.userData || {}), servoforgeSharedLabelAsset: true };
    cache.set(cacheKey, texture);
    return texture;
  }

  function createBottleLabels(THREERef, labelContract, geometry) {
    const group = baseLabelFactory.createBottleLabels(THREERef, labelContract, geometry);
    if (!group) return group;
    group.traverse?.((child) => {
      if (!child?.isMesh || !child?.userData?.labelSection || !child.material) return;
      const texture = createBeerLabelTexture(THREERef, child.userData.labelSection);
      const material = child.material;
      material.color?.set?.(0xffffff);
      material.map = texture;
      material.roughness = 0.52;
      material.metalness = 0;
      material.needsUpdate = true;
      child.material = material;
      child.userData.texture = texture;
      child.userData.labelText = LABEL_TEXT;
      child.userData.labelAuthority = Object.freeze({
        ...(child.userData.labelAuthority || {}),
        artworkAuthority: true,
        artworkSource: "user-requested-I-heart-Beer-reference-art"
      });
    });
    group.userData.brand = LABEL_TEXT;
    group.userData.artworkAuthority = true;
    group.userData.artworkText = LABEL_TEXT;
    return group;
  }

  global.Labeler3DLabelMeshFactory = Object.freeze({
    ...baseLabelFactory,
    FACTORY_VERSION: "servoforge.3d-label-mesh.v2-I-heart-Beer",
    PATCH_VERSION,
    LABEL_TEXT,
    createBeerLabelTexture,
    createBottleLabels
  });

  function findCoderLens(assembly) {
    let lens = null;
    assembly?.traverse?.((child) => {
      if (!lens && child?.isMesh && child.geometry?.type === "CircleGeometry") lens = child;
    });
    return lens;
  }

  function createEquipmentAssembly(THREERef, item, geometry) {
    const assembly = baseHardwareFactory.createEquipmentAssembly(THREERef, item, geometry);
    if (!assembly || item?.kind !== "coding") return assembly;
    const lens = findCoderLens(assembly);
    if (lens) {
      const radiusWorld = CODER_LENS_DIAMETER_MM * unitsPerMm(geometry) / 2;
      const oldGeometry = lens.geometry;
      lens.geometry = new THREERef.CircleGeometry(radiusWorld, 64);
      oldGeometry?.dispose?.();
      lens.name = "ServoForgeCoderLens76_2mm";
      lens.userData.coderLensDiameterMm = CODER_LENS_DIAMETER_MM;
      lens.userData.laserBeamSizePreserved = true;
    }
    assembly.userData.coderLensDiameterMm = CODER_LENS_DIAMETER_MM;
    assembly.userData.laserBeamGeometryUntouched = true;
    return assembly;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseHardwareFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v12-coder-lens-polish",
    PATCH_VERSION,
    CODER_LENS_DIAMETER_MM,
    createEquipmentAssembly
  });

  function realisticBottleMaterials(THREERef) {
    if (!amberGlassMaterial) {
      amberGlassMaterial = new THREERef.MeshPhysicalMaterial({
        color: 0x51240f,
        roughness: 0.16,
        metalness: 0,
        transmission: 0.10,
        thickness: 0.16,
        ior: 1.52,
        clearcoat: 0.34,
        clearcoatRoughness: 0.16,
        transparent: true,
        opacity: 0.96,
        envMapIntensity: 1.15
      });
    }
    if (!silverCrownMaterial) {
      silverCrownMaterial = new THREERef.MeshStandardMaterial({
        color: 0xc8cdd0,
        roughness: 0.26,
        metalness: 0.94,
        envMapIntensity: 1.25
      });
    }
    return { amberGlassMaterial, silverCrownMaterial };
  }

  function polishBottleObject(object, THREERef) {
    if (!object?.isMesh) return;
    const name = String(object.name || "");
    const instanceKind = String(object.userData?.handlingBottleInstances || "");
    const materials = realisticBottleMaterials(THREERef);
    if (instanceKind === "body" || name === "ServoForgeHandlingBottleBody" || /BottleBody$/.test(name)) {
      object.material = materials.amberGlassMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
      object.userData.visualAuthority = "realistic-amber-glass-reference-presentation";
    }
    if (instanceKind === "cap" || name === "ServoForgeHandlingBottleCap" || /BottleCap$/.test(name) || /Crown/i.test(name)) {
      object.material = materials.silverCrownMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
      object.userData.crownFinish = "silver-metallic";
    }
  }

  function installBottleVisualHook(THREERef) {
    const prototype = THREERef?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeBottleVisualPolishV1) return false;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeBottleVisualPolishAdd(...objects) {
      objects.forEach((object) => {
        polishBottleObject(object, THREERef);
        object?.traverse?.((child) => polishBottleObject(child, THREERef));
      });
      return nativeAdd.apply(this, objects);
    };
    Object.defineProperty(prototype, "__servoforgeBottleVisualPolishV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
    return true;
  }

  global.Labeler3DBottleLabelCoderVisualPolish = Object.freeze({
    PATCH_VERSION,
    CODER_LENS_DIAMETER_MM,
    LABEL_TEXT,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        coderLensDiameterMm: CODER_LENS_DIAMETER_MM,
        laserBeamGeometryUntouched: true,
        labelText: LABEL_TEXT,
        neckLabelPlacement: "centered-mid-neck-zone",
        bottleMaterial: "amber-physical-glass",
        crownMaterial: "silver-metallic"
      });
    }
  });

  ensureThree()
    .then((THREERef) => installBottleVisualHook(THREERef))
    .catch((error) => console.warn("ServoForge bottle visual polish could not install", error));
})(window);

