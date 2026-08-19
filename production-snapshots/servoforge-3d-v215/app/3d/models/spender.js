(function installServoForge3DSpenderModel(global) {
"use strict";
const baseFactory = global.Labeler3DHardwareMeshFactory;
if (!baseFactory?.createAggregateAssembly || !baseFactory?.createSpenderPlateAssembly) {
throw new Error("ServoForge spender photo-reference refinement requires the active 3D hardware factory.");
}
const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v13-spender-yoke-arm-alignment";
const MODEL_VERSION = "servoforge.3d-model.spender.v3-yoke-arm-alignment";
const PHOTO_REFERENCE = "user-supplied-spender-plate-multiview-and-yoke-alignment-2026-08-19";
function number(value, fallback = 0) {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
}
function material(THREE, options) {
return new THREE.MeshStandardMaterial(options);
}
function unitsPerMm(geometry = {}) {
return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.004450588));
}
function findFirst(root, name) {
let found = null;
root?.traverse?.((child) => {
if (!found && child?.name === name) found = child;
});
return found;
}
function findAll(root, predicate) {
const found = [];
root?.traverse?.((child) => {
if (predicate(child)) found.push(child);
});
return found;
}
function disposeObject(object) {
if (!object) return;
object.traverse?.((child) => {
child.geometry?.dispose?.();
const disposeMaterial = (entry) => entry?.dispose?.();
if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
else disposeMaterial(child.material);
});
}
function removeNamed(root, names) {
const targets = findAll(root, (child) => names.has(child?.name));
const targetSet = new Set(targets);
const roots = targets.filter((target) => {
let parent = target?.parent;
while (parent) {
if (targetSet.has(parent)) return false;
parent = parent.parent;
}
return true;
});
roots.forEach((target) => {
target.parent?.remove(target);
disposeObject(target);
});
return roots.length;
}
function cylinder(THREE, radius, length, meshMaterial, segments = 32) {
return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
}
function cylinderAlongX(THREE, radius, length, meshMaterial, segments = 28) {
const mesh = cylinder(THREE, radius, length, meshMaterial, segments);
mesh.rotation.z = Math.PI / 2;
return mesh;
}
function cylinderAlongZ(THREE, radius, length, meshMaterial, segments = 28) {
const mesh = cylinder(THREE, radius, length, meshMaterial, segments);
mesh.rotation.x = Math.PI / 2;
return mesh;
}
function geometryDimension(mesh, key, fallback) {
const value = number(mesh?.geometry?.parameters?.[key], 0);
if (value > 0) return value;
mesh?.geometry?.computeBoundingBox?.();
const box = mesh?.geometry?.boundingBox;
if (!box) return fallback;
if (key === "width") return Math.max(0, number(box.max?.x) - number(box.min?.x)) || fallback;
if (key === "height") return Math.max(0, number(box.max?.y) - number(box.min?.y)) || fallback;
if (key === "depth") return Math.max(0, number(box.max?.z) - number(box.min?.z)) || fallback;
return fallback;
}
function addApplicationArmExtrusion(THREE, assembly, sidePivot, engagementPivot, plateHeight, outwardSign) {
if (!sidePivot || !engagementPivot) return null;
removeNamed(sidePivot, new Set([
"ServoForgeSpenderMountTube",
"ServoForgeSpenderClamp",
"ServoForgeKronesABArmSection",
"ServoForgeKronesABArmMeasuringTape",
"ServoForgeKronesABStopPESensorAssembly",
"ServoForgeKronesABStopPESensorLens",
"ServoForgeSpenderPhotoApplicationArmExtrusion"
]));
const armReach = Math.max(0.20, Math.abs(number(engagementPivot.position?.z, 0.46)));
const aluminum = material(THREE, { color: 0xaeb7bb, roughness: 0.27, metalness: 0.86 });
const aluminumEdge = material(THREE, { color: 0xd0d6d8, roughness: 0.20, metalness: 0.90 });
const grooveMaterial = material(THREE, { color: 0x30373b, roughness: 0.55, metalness: 0.34 });
const scaleMaterial = material(THREE, { color: 0xe2e5e3, roughness: 0.48, metalness: 0.28 });
const group = new THREE.Group();
group.name = "ServoForgeSpenderPhotoApplicationArmExtrusion";
sidePivot.add(group);
const armWidth = Math.max(0.094, plateHeight * 0.34);
const armHeight = Math.max(0.108, plateHeight * 0.36);
const body = new THREE.Mesh(new THREE.BoxGeometry(armWidth, armHeight, armReach), aluminum);
body.name = "ServoForgeSpenderApplicationArmExtrusionBody";
body.position.set(0, 0, -outwardSign * armReach / 2);
body.castShadow = true;
group.add(body);
[-0.34, 0.34].forEach((xRatio) => {
const groove = new THREE.Mesh(
new THREE.BoxGeometry(Math.max(0.006, armWidth * 0.08), Math.max(0.006, armHeight * 0.06), armReach * 0.96),
grooveMaterial
);
groove.name = "ServoForgeSpenderApplicationArmExtrusionGroove";
groove.position.set(armWidth * xRatio, armHeight * 0.47, -outwardSign * armReach / 2);
group.add(groove);
});
const sideRail = new THREE.Mesh(
new THREE.BoxGeometry(armWidth * 1.02, Math.max(0.006, armHeight * 0.07), armReach * 0.985),
aluminumEdge
);
sideRail.name = "ServoForgeSpenderApplicationArmTopRail";
sideRail.position.set(0, armHeight * 0.45, -outwardSign * armReach / 2);
group.add(sideRail);
const scaleStrip = new THREE.Mesh(
new THREE.BoxGeometry(armWidth * 0.82, Math.max(0.004, armHeight * 0.035), armReach * 0.78),
scaleMaterial
);
scaleStrip.name = "ServoForgeSpenderApplicationArmScaleStrip";
scaleStrip.position.set(0, armHeight * 0.495, -outwardSign * armReach * 0.48);
group.add(scaleStrip);
const endBlockDepth = Math.max(0.040, armHeight * 0.62);
const endBlock = new THREE.Mesh(
new THREE.BoxGeometry(armWidth * 0.98, armHeight * 1.02, endBlockDepth),
grooveMaterial
);
endBlock.name = "ServoForgeSpenderApplicationArmKnuckleEndBlock";
endBlock.position.set(0, 0, -outwardSign * (armReach - endBlockDepth / 2));
group.add(endBlock);
const shoe = new THREE.Mesh(
new THREE.BoxGeometry(armWidth * 1.00, armHeight * 1.00, Math.max(0.026, armHeight * 0.44)),
aluminumEdge
);
shoe.name = "ServoForgeSpenderApplicationArmKnuckleMountShoe";
shoe.position.set(0, 0, -outwardSign * (armReach - endBlockDepth - Math.max(0.013, armHeight * 0.22)));
group.add(shoe);
return group;
}
function addPlateRailAndRoller(THREE, engagementPivot, plate, plateLength, plateHeight, plateThickness, outwardSign) {
const stainless = material(THREE, { color: 0xaeb7bb, roughness: 0.23, metalness: 0.90 });
const polished = material(THREE, { color: 0xd7dcde, roughness: 0.14, metalness: 0.95 });
const black = material(THREE, { color: 0x151a1d, roughness: 0.52, metalness: 0.38 });
const fastener = material(THREE, { color: 0xe0e4e5, roughness: 0.16, metalness: 0.94 });
const group = new THREE.Group();
group.name = "ServoForgeSpenderPhotoPlateHardware";
engagementPivot.add(group);
const railWidth = Math.max(0.042, plateLength * 0.105);
const railHeight = plateHeight * 0.90;
const railDepth = Math.max(plateThickness * 1.65, plateHeight * 0.055);
const railX = number(plate.position?.x, 0) - plateLength * 0.43;
const railZ = outwardSign * (plateThickness / 2 + railDepth / 2 + 0.002);
const rail = new THREE.Mesh(new THREE.BoxGeometry(railWidth, railHeight, railDepth), black);
rail.name = "ServoForgeSpenderBlackVerticalAdjustmentRail";
rail.position.set(railX, number(plate.position?.y, 0) - plateHeight * 0.015, railZ);
rail.castShadow = true;
group.add(rail);
const holeRadius = Math.max(0.005, railWidth * 0.12);
const holeDepth = Math.max(0.006, railDepth * 0.22);
[-0.34, -0.20, -0.06, 0.08, 0.22, 0.36].forEach((ratio) => {
const insert = cylinderAlongZ(THREE, holeRadius, holeDepth, fastener, 18);
insert.name = "ServoForgeSpenderAdjustmentRailFastener";
insert.position.set(railX, number(plate.position?.y, 0) + railHeight * ratio, railZ + outwardSign * (railDepth / 2 + holeDepth / 2));
group.add(insert);
});
const rollerRadius = Math.max(0.024, plateHeight * 0.070);
const rollerHeight = plateHeight * 0.78;
const rollerX = railX - plateLength * 0.095;
const rollerZ = outwardSign * (plateThickness / 2 + rollerRadius * 0.82);
const roller = cylinder(THREE, rollerRadius, rollerHeight, stainless, 36);
roller.name = "ServoForgeSpenderPhotoGuideRoller";
roller.position.set(rollerX, number(plate.position?.y, 0) - plateHeight * 0.03, rollerZ);
roller.castShadow = true;
group.add(roller);
const axleRadius = Math.max(0.006, rollerRadius * 0.24);
const axle = cylinder(THREE, axleRadius, rollerHeight * 1.08, polished, 22);
axle.name = "ServoForgeSpenderPhotoGuideRollerAxle";
axle.position.copy(roller.position);
group.add(axle);
const topCap = cylinder(THREE, rollerRadius * 0.50, Math.max(0.012, rollerRadius * 0.42), polished, 24);
topCap.name = "ServoForgeSpenderPhotoGuideRollerTopCap";
topCap.position.set(rollerX, roller.position.y + rollerHeight * 0.52, rollerZ);
group.add(topCap);
const pinRadius = Math.max(0.006, plateHeight * 0.020);
const pinLength = Math.max(0.075, plateLength * 0.22);
[-0.20, 0.18].forEach((heightRatio) => {
const pin = cylinderAlongZ(THREE, pinRadius, pinLength, polished, 22);
pin.name = "ServoForgeSpenderPhotoGuidePin";
pin.position.set(
rollerX + rollerRadius * 0.58,
number(plate.position?.y, 0) + plateHeight * heightRatio,
rollerZ + outwardSign * (rollerRadius + pinLength / 2)
);
group.add(pin);
});
return group;
}
function addKnuckle(THREE, engagementPivot, plate, plateLength, plateHeight, plateThickness, outwardSign, armReachWorld) {
const stainless = material(THREE, { color: 0xaeb7bb, roughness: 0.23, metalness: 0.90 });
const polished = material(THREE, { color: 0xdce0e1, roughness: 0.13, metalness: 0.96 });
const dark = material(THREE, { color: 0x161b1e, roughness: 0.50, metalness: 0.40 });
const yellow = material(THREE, { color: 0xd8b51d, roughness: 0.42, metalness: 0.20 });
const red = material(THREE, { color: 0xb92b24, roughness: 0.40, metalness: 0.20 });
const group = new THREE.Group();
group.name = "ServoForgeSpenderPhotoKnuckleAssembly";
const knuckleX = number(plate.position?.x, 0) - plateLength * 0.42;
const knuckleY = number(plate.position?.y, 0) + plateHeight * 0.48;
const dialRadius = Math.max(0.031, plateHeight * 0.105);
const dialDepth = Math.max(0.014, plateThickness * 1.25);
const knuckleZ = outwardSign * (plateThickness / 2 + dialDepth * 0.55);
group.position.set(knuckleX, knuckleY, knuckleZ);
engagementPivot.add(group);
const saddleWidth = Math.max(0.094, plateHeight * 0.34);
const saddleHeight = Math.max(0.108, plateHeight * 0.36);
const saddleDepth = Math.max(0.040, plateThickness * 2.4);
const saddle = new THREE.Mesh(
new THREE.BoxGeometry(saddleWidth, saddleHeight, saddleDepth),
stainless
);
saddle.name = "ServoForgeSpenderKnuckleSaddle";
saddle.position.set(-plateLength * 0.045, -dialRadius * 0.34, 0);
group.add(saddle);
const yellowDisc = cylinder(THREE, dialRadius, dialDepth, yellow, 40);
yellowDisc.name = "ServoForgeSpenderKnuckleYellowIndexDisc";
group.add(yellowDisc);
const redDisc = cylinder(THREE, dialRadius * 0.76, dialDepth * 1.08, red, 40);
redDisc.name = "ServoForgeSpenderKnuckleRedIndexDisc";
redDisc.position.y = dialDepth * 0.08;
group.add(redDisc);
const centerWasher = cylinder(THREE, dialRadius * 0.27, dialDepth * 1.24, polished, 24);
centerWasher.name = "ServoForgeSpenderKnuckleCenterWasher";
centerWasher.position.y = dialDepth * 0.13;
group.add(centerWasher);
const centerBolt = cylinder(THREE, dialRadius * 0.13, dialDepth * 1.45, stainless, 12);
centerBolt.name = "ServoForgeSpenderKnuckleCenterBolt";
centerBolt.position.y = dialDepth * 0.18;
group.add(centerBolt);
const leverLength = Math.max(0.10, plateLength * 0.31);
const leverHeight = Math.max(0.018, plateHeight * 0.055);
const leverDepth = Math.max(0.022, plateThickness * 1.45);
const lever = new THREE.Mesh(new THREE.BoxGeometry(leverLength, leverHeight, leverDepth), dark);
lever.name = "ServoForgeSpenderKnuckleBlackTopLink";
lever.position.set(leverLength * 0.44, dialRadius * 0.34, 0);
group.add(lever);
const hingeRadius = Math.max(0.010, dialRadius * 0.34);
const hingeX = leverLength * 0.92;
const hingePin = cylinderAlongZ(THREE, hingeRadius * 0.48, leverDepth * 1.35, polished, 20);
hingePin.name = "ServoForgeSpenderKnuckleTopLinkHingePin";
hingePin.position.set(hingeX, dialRadius * 0.34, 0);
group.add(hingePin);
const plateEar = new THREE.Mesh(
new THREE.BoxGeometry(Math.max(0.035, plateLength * 0.085), Math.max(0.045, plateHeight * 0.16), Math.max(0.025, plateThickness * 1.65)),
stainless
);
plateEar.name = "ServoForgeSpenderKnucklePlateEar";
plateEar.position.set(hingeX + plateLength * 0.035, -dialRadius * 0.05, 0);
group.add(plateEar);
const knobRadius = Math.max(0.018, dialRadius * 0.62);
const knobLength = Math.max(0.030, plateLength * 0.075);
const knob = cylinderAlongX(THREE, knobRadius, knobLength, dark, 30);
knob.name = "ServoForgeSpenderKnuckleAdjustmentKnob";
knob.position.set(-dialRadius * 1.35, dialRadius * 0.15, 0);
group.add(knob);
const screw = cylinderAlongX(THREE, Math.max(0.005, knobRadius * 0.24), knobLength * 1.65, polished, 18);
screw.name = "ServoForgeSpenderKnuckleAdjustmentScrew";
screw.position.set(-dialRadius * 0.88, dialRadius * 0.15, 0);
group.add(screw);
const cheek = new THREE.Mesh(
new THREE.BoxGeometry(Math.max(0.040, plateLength * 0.10), Math.max(0.050, plateHeight * 0.17), Math.max(0.022, plateThickness * 1.45)),
stainless
);
cheek.name = "ServoForgeSpenderKnuckleArmCheek";
cheek.position.set(-dialRadius * 0.62, -dialRadius * 0.78, 0);
cheek.rotation.z = -0.16;
group.add(cheek);
const cheekBolt = cylinderAlongZ(THREE, Math.max(0.007, dialRadius * 0.20), Math.max(0.025, plateThickness * 1.9), polished, 18);
cheekBolt.name = "ServoForgeSpenderKnuckleArmCheekBolt";
cheekBolt.position.copy(cheek.position);
group.add(cheekBolt);
group.userData.mechanicalReference = Object.freeze({
role: "spender-knuckle-and-index-adjustment",
photoReference: PHOTO_REFERENCE,
knuckleSideAttachedToApplicationArm: true,
armConnection: "rectangular-extrusion-seated-directly-onto-knuckle",
indexedDisc: "yellow-outer-red-inner",
blackTopLinkRendered: true,
adjustmentKnobRendered: true,
articulationAuthority: "knuckle-is-separate-joint-from-application-arm",
dimensionalAuthority: false,
armReachWorld
});
return group;
}
function refineAssembly(THREE, assembly, item, geometry) {
if (!assembly) return assembly;
const engagementPivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
const sidePivot = findFirst(assembly, "ServoForgeSideAnglePivot");
const plate = findFirst(assembly, "ServoForgeSpenderPlate");
if (!engagementPivot || !plate || engagementPivot.userData?.spenderPhotoReferenceV13Applied) return assembly;
const scale = unitsPerMm(geometry);
const plateLength = Math.max(60 * scale, geometryDimension(plate, "width", 0.42));
const plateHeight = Math.max(60 * scale, geometryDimension(plate, "height", 0.30));
const plateThickness = Math.max(2 * scale, geometryDimension(plate, "depth", 0.015));
const outwardSign = number(item?.radialOutSign, 1) >= 0 ? 1 : -1;
const removedLegacyVisuals = removeNamed(assembly, new Set([
"ServoForgeSpenderRefinedAngleAdjustmentKnuckle",
"ServoForgeSpenderAngleAdjustmentKnuckle",
"ServoForgeKronesGuideRollerAssembly",
"ServoForgeKronesWedgeGuidePlate",
"ServoForgeKronesWedgeClampingPlate",
"ServoForgeKronesSprocketIdlerL119",
"ServoForgeKronesWedgeBearing61800",
"ServoForgeSpenderGuideRoller",
"ServoForgeSpenderGuideRollerAxle",
"ServoForgeSpenderGuideRollerCap",
"ServoForgeSpenderBackbone",
"ServoForgeSpenderPlateMountBlade",
"ServoForgeSpenderPhotoPlateHardware",
"ServoForgeSpenderPhotoKnuckleAssembly"
]));
const arm = addApplicationArmExtrusion(THREE, assembly, sidePivot, engagementPivot, plateHeight, outwardSign);
const plateHardware = addPlateRailAndRoller(THREE, engagementPivot, plate, plateLength, plateHeight, plateThickness, outwardSign);
const armReachWorld = Math.max(0, Math.abs(number(engagementPivot.position?.z, 0)));
const knuckle = addKnuckle(THREE, engagementPivot, plate, plateLength, plateHeight, plateThickness, outwardSign, armReachWorld);
engagementPivot.userData.spenderPhotoReferenceV13Applied = true;
engagementPivot.userData.spenderArticulationJoint = "knuckle-side";
engagementPivot.userData.spenderKnuckleAttachedToApplicationArm = true;
assembly.userData.spenderPhotoReference = Object.freeze({
source: PHOTO_REFERENCE,
views: Object.freeze(["front/plate-side", "top", "bottom/opposite", "roller-side", "installed-arm-side", "user-yoke-alignment-feedback"]),
structuralHierarchy: Object.freeze([
"application arm extrusion seated onto knuckle",
"knuckle/index pivot",
"black top adjustment link",
"black vertical perforated adjustment rail",
"vertical polished guide roller",
"two yoke pins aligned with application arm direction",
"stainless spender plate"
]),
knuckleSideAttachedToApplicationArm: true,
armSizedToKnuckle: true,
yokePinsAlignedWithApplicationArm: true,
knuckleSeparateArticulation: true,
plateAndRollerRelationshipPhotoConfirmed: true,
exactDimensionsMeasured: false,
currentDimensions: "photo-proportional-preserving-existing-bottle-clearance-and-map-placement",
removedLegacyVisualCount: removedLegacyVisuals,
applicationArmExtrusionRendered: Boolean(arm),
blackAdjustmentRailRendered: Boolean(plateHardware),
verticalGuideRollerRendered: Boolean(plateHardware),
indexedKnuckleRendered: Boolean(knuckle),
mapPlacementPreserved: true,
bottleClearanceMm: number(item?.applicationClearanceMm, 2),
servoAuthorityUntouched: true,
plannerAuthorityUntouched: true,
dimensionalAuthority: false
});
assembly.userData.highlightMaterials = Array.isArray(assembly.userData.highlightMaterials)
? assembly.userData.highlightMaterials
: [];
return assembly;
}
function createSpenderPlateAssembly(THREE, item, geometry) {
return refineAssembly(THREE, baseFactory.createSpenderPlateAssembly(THREE, item, geometry), item, geometry);
}
function createAggregateAssembly(THREE, item, geometry) {
return refineAssembly(THREE, baseFactory.createAggregateAssembly(THREE, item, geometry), item, geometry);
}
global.Labeler3DHardwareMeshFactory = Object.freeze({
...baseFactory,
FACTORY_VERSION,
SPENDER_PHOTO_REFERENCE: PHOTO_REFERENCE,
createSpenderPlateAssembly,
createAggregateAssembly,
refineSpenderPhotoReference: refineAssembly
});
function matches(item = {}) {
const kind = String(item?.kind || "").toLowerCase();
return kind === "aggregate" || kind === "spender" || Number.isFinite(Number(item?.aggregate));
}
function create(THREE, item, geometry, context = {}) {
const factory = context.legacyFactory || global.Labeler3DHardwareMeshFactory;
if (Number.isFinite(Number(item?.aggregate)) && factory?.createAggregateAssembly) {
return factory.createAggregateAssembly(THREE, item, geometry);
}
if (String(item?.kind || "").toLowerCase() === "spender" && factory?.createSpenderPlateAssembly) {
const group = factory.createSpenderPlateAssembly(THREE, item, geometry);
if (!group) return null;
group.position.set(number(item?.position?.x), number(item?.position?.y, 0), number(item?.position?.z));
group.rotation.y = number(item?.flowRotationY, number(item?.rotationY));
return group;
}
return factory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
}
global.Labeler3DSpenderModel = Object.freeze({
id: "spender",
MODEL_VERSION,
matches,
create,
authority: Object.freeze({
placement: "machine-map-angle-plus-flow-tangent",
contact: "bottle-facing-surface-plus-2mm-clearance",
renderOwnership: "models/spender.js",
photoReference: PHOTO_REFERENCE,
knuckleSideAttachment: "application-arm-to-knuckle-to-spender-assembly",
dimensionalAuthority: false,
migrationState: "registry-owned-photo-refined-factory"
})
});
})(window);
