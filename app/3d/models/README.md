# ServoForge 3D Models

This folder is the canonical object boundary for ServoForge 3D geometry.

## Model files

- `bottle.js` — bottle model contract and bottle-geometry ownership boundary.
- `star-wheel.js` — bottle-handling/star-wheel model contract.
- `spender.js` — application spender model contract.
- `wipe-pad.js` — wipe-pad model contract.
- `wipe-roller.js` — wipe-roller model contract.
- `coder.js` — coder model contract.
- `index.js` — central model registry.
- `equipment-model-router-integration.js` — routes rendered equipment through the registry.

## Migration rule

ServoForge motion, planner, machine-map, and normalized replay frames remain authoritative outside this folder. Models consume resolved geometry and placement only; they do not calculate or mutate servo programs.

This is a compatibility-safe migration. The registry is now the public model interface, while some model implementations still delegate to the proven legacy factories underneath. As individual objects are refined, their procedural Three.js geometry should move into the corresponding model file instead of adding another cross-cutting integration layer.
