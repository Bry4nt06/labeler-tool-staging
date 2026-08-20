(function installServoForge3DLabelMeshFactory(global) {
  "use strict";

  const FACTORY_VERSION = "servoforge.3d-label-mesh.v1";
  const assetCaches = new WeakMap();

  function cachesFor(THREE) {
    let caches = assetCaches.get(THREE);
    if (!caches) {
      caches = { geometries: new Map(), textures: new Map() };
      assetCaches.set(THREE, caches);
    }
    return caches;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positive(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function radiusAtY(profilePoints = [], y = 0) {
    const points = (Array.isArray(profilePoints) ? profilePoints : [])
      .map((point) => ({ y: number(point?.y), radius: positive(point?.radius) }))
      .filter((point) => point.radius !== null)
      .sort((left, right) => left.y - right.y);
    if (!points.length) return null;
    if (y <= points[0].y) return points[0].radius;
    if (y >= points[points.length - 1].y) return points[points.length - 1].radius;
    for (let index = 1; index < points.length; index += 1) {
      const right = points[index];
      const left = points[index - 1];
      if (y > right.y) continue;
      const span = right.y - left.y || 1;
      const t = (y - left.y) / span;
      return left.radius + (right.radius - left.radius) * t;
    }
    return points[points.length - 1].radius;
  }

  function pushTriangle(positions, uvs, a, b, c, auv, buv, cuv) {
    positions.push(...a, ...b, ...c);
    uvs.push(...auv, ...buv, ...cuv);
  }

  function curvedLabelGeometry(THREE, section, geometry, options = {}) {
    const profile = geometry?.bottle?.profilePointsWorld || [];
    const bottom = number(section?.bottomWorld);
    const top = number(section?.topWorld);
    const wrapRadians = Math.max(0.01, number(section?.wrapDegrees, 0) * Math.PI / 180);
    const centerRadians = number(section?.centerAngleDegrees, 0) * Math.PI / 180;
    const radialOffset = positive(options.radialOffsetWorld, 0.006);
    if (!THREE?.BufferGeometry || top <= bottom || wrapRadians <= 0.01) return null;
    const cacheKey = JSON.stringify([
      bottom,
      top,
      number(section?.wrapDegrees),
      number(section?.centerAngleDegrees),
      radialOffset,
      number(geometry?.bottle?.radiusWorld),
      profile.map((point) => [number(point?.radius), number(point?.y)])
    ]);
    const cache = cachesFor(THREE).geometries;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const angularSegments = Math.max(8, Math.min(72, Math.ceil(number(section?.wrapDegrees, 20) / 4)));
    const verticalSegments = Math.max(2, Math.min(20, Math.ceil((top - bottom) / 0.055)));
    const positions = [];
    const uvs = [];

    function vertex(u, v) {
      const angle = centerRadians - wrapRadians / 2 + wrapRadians * u;
      const y = bottom + (top - bottom) * v;
      const radius = positive(radiusAtY(profile, y), positive(geometry?.bottle?.radiusWorld, 0.14)) + radialOffset;
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    }

    for (let yIndex = 0; yIndex < verticalSegments; yIndex += 1) {
      const v0 = yIndex / verticalSegments;
      const v1 = (yIndex + 1) / verticalSegments;
      for (let xIndex = 0; xIndex < angularSegments; xIndex += 1) {
        const u0 = xIndex / angularSegments;
        const u1 = (xIndex + 1) / angularSegments;
        const a = vertex(u0, v0);
        const b = vertex(u1, v0);
        const c = vertex(u1, v1);
        const d = vertex(u0, v1);
        pushTriangle(positions, uvs, a, b, c, [u0, v0], [u1, v0], [u1, v1]);
        pushTriangle(positions, uvs, a, c, d, [u0, v0], [u1, v1], [u0, v1]);
      }
    }

    const meshGeometry = new THREE.BufferGeometry();
    meshGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    meshGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    meshGeometry.computeVertexNormals();
    meshGeometry.computeBoundingBox();
    meshGeometry.computeBoundingSphere();
    meshGeometry.userData = { ...(meshGeometry.userData || {}), servoforgeSharedLabelAsset: true };
    cache.set(cacheKey, meshGeometry);
    return meshGeometry;
  }

  function fitFont(context, text, maximumWidth, initialSize) {
    let size = initialSize;
    while (size > 24) {
      context.font = `700 ${size}px Arial, sans-serif`;
      if (context.measureText(text).width <= maximumWidth) return size;
      size -= 3;
    }
    return size;
  }

  function referenceTexture(THREE, brand, sectionName) {
    if (!global.document?.createElement || !THREE?.CanvasTexture) return null;
    const cache = cachesFor(THREE).textures;
    const cacheKey = `${String(brand || "SERVOFORGE").trim()}|${String(sectionName || "body").toLowerCase()}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const canvas = global.document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const section = String(sectionName || "body").toUpperCase();
    ctx.fillStyle = "#f4f2e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#102f55";
    ctx.fillRect(0, 0, canvas.width, 24);
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
    ctx.fillStyle = "#b7332c";
    ctx.fillRect(canvas.width * 0.48, 0, canvas.width * 0.04, canvas.height);

    const title = String(brand || "SERVOFORGE").trim() || "SERVOFORGE";
    const fontSize = fitFont(ctx, title, canvas.width * 0.82, 74);
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#17365d";
    ctx.fillText(title, canvas.width / 2, canvas.height * 0.46);

    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillStyle = "#6b7075";
    ctx.fillText(`${section} LABEL • REFERENCE ART`, canvas.width / 2, canvas.height * 0.72);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    texture.userData = { ...(texture.userData || {}), servoforgeSharedLabelAsset: true };
    cache.set(cacheKey, texture);
    return texture;
  }

  function createSectionMesh(THREE, labelContract, sectionName, geometry) {
    const section = labelContract?.sections?.[sectionName];
    if (!section?.enabled || number(section.wrapDegrees) <= 0) return null;
    const meshGeometry = curvedLabelGeometry(THREE, section, geometry);
    if (!meshGeometry) return null;
    const texture = referenceTexture(THREE, labelContract?.brand, sectionName);
    const material = new THREE.MeshStandardMaterial({
      color: texture ? 0xffffff : 0xf4f2e8,
      map: texture || null,
      roughness: 0.68,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(meshGeometry, material);
    mesh.name = `ServoForgeBottleLabel-${sectionName}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = Boolean(section.applied);
    mesh.userData.labelSection = sectionName;
    mesh.userData.texture = texture;
    mesh.userData.labelAuthority = Object.freeze({
      wrapAuthority: section.wrapAuthority,
      heightAuthority: Boolean(section.heightAuthority),
      verticalPlacementAuthority: Boolean(section.verticalPlacementAuthority),
      artworkAuthority: false
    });
    return mesh;
  }

  function createBottleLabels(THREE, labelContract, geometry) {
    if (!labelContract?.sections) return null;
    const group = new THREE.Group();
    group.name = "ServoForgeBottleLabels";
    const meshes = {};
    ["neck", "body", "back"].forEach((sectionName) => {
      const mesh = createSectionMesh(THREE, labelContract, sectionName, geometry);
      if (!mesh) return;
      meshes[sectionName] = mesh;
      group.add(mesh);
    });
    group.userData.labelMeshes = meshes;
    group.userData.brand = labelContract.brand;
    group.userData.artworkAuthority = false;
    return group;
  }

  function cacheStatus(THREE) {
    const caches = THREE ? cachesFor(THREE) : null;
    return Object.freeze({
      geometryCount: caches?.geometries?.size || 0,
      textureCount: caches?.textures?.size || 0
    });
  }

  global.Labeler3DLabelMeshFactory = Object.freeze({
    FACTORY_VERSION,
    radiusAtY,
    curvedLabelGeometry,
    referenceTexture,
    cacheStatus,
    createSectionMesh,
    createBottleLabels
  });
})(window);

