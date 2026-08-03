# Refactor Phase 17 — Assembly UI and Renderer Split

Date: 2026-08-02

## Objective

Physically remove assembly editor, application-preset, aggregate-rendering, sensor-status, and configured-object drawing code from `app/assemblies.js` without changing assembly calculations, event behavior, map geometry, or load timing.

Staging head before this phase:

- `28540f6a3fe8825f7baec87838d2741ca62778ef`

## Previous state

`app/assemblies.js` contained approximately 594 lines covering four unrelated responsibilities:

- assembly model and geometry fallbacks
- assembly and object-location editing
- application-preset switching
- aggregate and configured-object SVG rendering

Phase 16 established authoritative `assembly.model` and `assembly.geometry` drivers but intentionally left the UI and renderer inside the compatibility file for browser testing.

## New physical ownership

### `app/assemblies.js`

Reduced to 160 lines.

Temporarily retains only the original model and geometry fallback functions:

- `normalizeAssembly`
- `mmToTableDegrees`
- `padStartAngle`
- `padAnglesForSide`
- `padProfileTableAngles`
- `assemblyAngles`
- `assemblySpan`
- `syncMapPointsFromAssemblies`
- `mapPointStation`
- `assemblyRequiredRatio`
- `assemblyStatus`
- `assemblyTypeLabel`
- `assemblyPositionLabel`
- `assemblySelectValue`

Those functions are still superseded by `app/assembly-driver-adapter.js` before application initialization. Their physical removal is the next contained assembly phase.

### `app/assembly-editor-controller.js`

262 lines copied from the verified compatibility source without formula or event-handler rewrites.

Owns:

- setup-dialog application copy
- assembly editor rendering
- station installed/removed controls
- assembly-family selection
- required-rotation editing
- object-location editing
- Cold Glue object-location editing
- application-preset switching

Public function names remain unchanged:

- `configureSetupDialogMode`
- `renderAssemblyEditor`
- `renderObjectLocationEditor`
- `applyApplicationPreset`

### `app/assembly-map-renderer.js`

174 lines copied from the verified compatibility source without drawing-formula rewrites.

Owns:

- aggregate definitions and centerline gaps
- aggregate SVG markers
- label-sensor map status and color
- APL pad, roller, sensor, and coder rendering
- Cold Glue brush, brush-channel, roller, gripper, sensor, and coder rendering

Public function names remain unchanged:

- `drawMapObjectLabel`
- `activeAggregateDefinitions`
- `aggregateCenterlineGaps`
- `drawIndependentAggregates`
- `labelSensorMapStatus`
- `labelSensorMapColor`
- `drawConfiguredAssemblies`

## Load order

The existing readiness-gated feature manifest now loads:

```text
assembly.model
    ↓
assembly.geometry
    ↓
assembly browser adapter
    ↓
assembly editor/controller
    ↓
assembly map renderer
    ↓
remaining workspace integrations
    ↓
application initialization
```

This phase does not add another readiness promise or asynchronous startup owner.

## Compatibility preserved

No changes were made to:

- stored assembly property names
- stored station numbers
- inner/outer side values
- pad-clearance conversion
- inner-pad offset behavior
- roller or brush geometry
- application-mode conversion rules
- station-toggle event behavior
- required-rotation editing
- Cold Glue reset behavior
- aggregate centerline minimum of 6°
- stored `cw` and `ccw` direction values
- APL aggregate-arm direction behavior
- sensor visibility calculations
- coder or sensor colors
- APL and Cold Glue SVG object geometry
- map schema or saved maps

## Offline behavior

The service-worker cache identity is now:

- `servoforge-labeler-staging-v0.9.2-assembly-ui-split-v1`

The install-time asset manifest now includes:

- both assembly drivers
- the assembly browser adapter
- the assembly editor/controller
- the assembly map renderer

## Regression coverage

`tests/assembly-ui-renderer-boundaries.test.js` enforces:

- one owner for each editor/controller function
- one owner for each renderer function
- no UI or renderer functions returning to `app/assemblies.js`
- the 200-line compatibility ceiling
- focused module-size ceilings
- adapter-before-editor-before-renderer load order
- install-time offline asset coverage
- cache-identity advancement

The extracted editor and renderer Git blobs match the locally syntax-checked sources exactly.

## Next assembly phase

After browser confirmation, remove the remaining model and geometry fallback definitions from `app/assemblies.js` and make the registered drivers plus adapter the only physical owners. At that point `app/assemblies.js` can be deleted or replaced with a short compatibility assertion.
