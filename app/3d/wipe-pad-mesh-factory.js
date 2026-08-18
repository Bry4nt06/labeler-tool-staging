(function installServoForge3DWipePadMeshFactory(global) {
  "use strict";

  const FACTORY_VERSION = "servoforge.3d-wipe-pad-mesh.v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positive(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function pushTriangle(positions, a, b, c) {
    positions.push(...a, ...b, ...c);
  }

  function pushQuad(positions, a, b, c, d) {
    pushTriangle(positions, a, b, c);
    pushTriangle(positions, a, c, d);
  }

  function annularPrismGeometry(THREE, options = {}) {
    const innerRadius = positive(options.innerRadius);
    const outerRadius = positive(options.outerRadius);
    const originRadius = positive(options.originRadius);
    const height = positive(options.height);
    const spanRadians = Math.max(0.0001, number(options.spanRadians, 0));
    if (!THREE?.BufferGeometry || !innerRadius || !outerRadius || !originRadius || !height || outerRadius <= innerRadius) {
      throw new Error("Measured wipe-pad annular geometry requires valid Three.js radii, height, and span.");
    }

    const segments = Math.max(4, Math.min(96, Math.ceil(number(options.segments, spanRadians * 52))));
    const y0 = -height / 2;
    const y1 = height / 2;
    const positions = [];

    function point(radius, angle, y) {
      return [
        Math.cos(angle) * radius - originRadius,
        y,
        Math.sin(angle) * radius
      ];
    }

    for (let index = 0; index < segments; index += 1) {
      const a0 = -spanRadians / 2 + spanRadians * (index / segments);
      const a1 = -spanRadians / 2 + spanRadians * ((index + 1) / segments);

      const i00 = point(innerRadius, a0, y0);
      const i01 = point(innerRadius, a1, y0);
      const i10 = point(innerRadius, a0, y1);
      const i11 = point(innerRadius, a1, y1);
      const o00 = point(outerRadius, a0, y0);
      const o01 = point(outerRadius, a1, y0);
      const o10 = point(outerRadius, a0, y1);
      const o11 = point(outerRadius, a1, y1);

      // Radial faces.
      pushQuad(positions, o00, o10, o11, o01);
      pushQuad(positions, i01, i11, i10, i00);
      // Top and bottom faces.
      pushQuad(positions, i10, i11, o11, o10);
      pushQuad(positions, i00, o00, o01, i01);
    }

    const start = -spanRadians / 2;
    const end = spanRadians / 2;
    pushQuad(
      positions,
      point(innerRadius, start, y0),
      point(innerRadius, start, y1),
      point(outerRadius, start, y1),
      point(outerRadius, start, y0)
    );
    pushQuad(
      positions,
      point(innerRadius, end, y0),
      point(outerRadius, end, y0),
      point(outerRadius, end, y1),
      point(innerRadius, end, y1)
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function radialBands(wipePad) {
    const contact = positive(wipePad?.contactFaceRadiusWorld);
    const sponge = positive(wipePad?.spongeThicknessWorld);
    const backing = positive(wipePad?.backingPlateThicknessWorld);
    const origin = positive(wipePad?.assemblyCenterRadiusWorld);
    const side = wipePad?.side === "inner" ? "inner" : "outer";
    if (!contact || !sponge || !backing || !origin) return null;

    if (side === "inner") {
      return Object.freeze({
        origin,
        spongeInner: contact - sponge,
        spongeOuter: contact,
        backingInner: contact - sponge - backing,
        backingOuter: contact - sponge
      });
    }
    return Object.freeze({
      origin,
      spongeInner: contact,
      spongeOuter: contact + sponge,
      backingInner: contact + sponge,
      backingOuter: contact + sponge + backing
    });
  }

  function createMeasuredAssembly(THREE, item, options = {}) {
    const wipePad = item?.wipePad;
    const bands = radialBands(wipePad);
    const height = positive(wipePad?.heightWorld);
    const spanRadians = Math.max(0.0001, number(wipePad?.spanDegrees, number(item?.spanDegrees, 0.5)) * Math.PI / 180);
    if (!bands || !height) return null;

    const assembly = new THREE.Group();
    assembly.name = `ServoForgeMeasuredWipePad-${String(item?.id || "pad")}`;

    const spongeMaterial = new THREE.MeshStandardMaterial({
      color: number(options.spongeColor, 0xb96d38),
      roughness: 0.96,
      metalness: 0.0
    });
    const backingMaterial = new THREE.MeshStandardMaterial({
      color: number(options.backingColor, 0x8b9397),
      roughness: 0.34,
      metalness: 0.82
    });

    const sponge = new THREE.Mesh(
      annularPrismGeometry(THREE, {
        innerRadius: bands.spongeInner,
        outerRadius: bands.spongeOuter,
        originRadius: bands.origin,
        height,
        spanRadians
      }),
      spongeMaterial
    );
    sponge.name = "ServoForgeWipePadSponge18mm";
    sponge.castShadow = true;
    sponge.receiveShadow = true;
    assembly.add(sponge);

    const backing = new THREE.Mesh(
      annularPrismGeometry(THREE, {
        innerRadius: bands.backingInner,
        outerRadius: bands.backingOuter,
        originRadius: bands.origin,
        height,
        spanRadians
      }),
      backingMaterial
    );
    backing.name = "ServoForgeWipePadSteelBacking4mm";
    backing.castShadow = true;
    backing.receiveShadow = true;
    assembly.add(backing);

    assembly.userData.wipePad = Object.freeze({
      dimensionalAuthority: String(wipePad.dimensionalAuthority || "user-measured"),
      heightMm: number(wipePad.heightMm),
      spongeThicknessMm: number(wipePad.spongeThicknessMm),
      backingPlateThicknessMm: number(wipePad.backingPlateThicknessMm),
      totalThicknessMm: number(wipePad.totalThicknessMm),
      bottlePenetrationMm: number(wipePad.bottlePenetrationMm),
      contactFaceArcLengthMm: number(wipePad.contactFaceArcLengthMm),
      tableTravelLengthMm: number(wipePad.tableTravelLengthMm),
      contactAuthority: Boolean(wipePad.contactAuthority),
      curved: true
    });
    assembly.userData.contactMaterials = [spongeMaterial];
    assembly.userData.backingMaterials = [backingMaterial];
    return assembly;
  }

  global.Labeler3DWipePadMeshFactory = Object.freeze({
    FACTORY_VERSION,
    annularPrismGeometry,
    radialBands,
    createMeasuredAssembly
  });
})(window);
