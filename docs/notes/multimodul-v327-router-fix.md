# MultiModul v327 selected-map CMD grammar fix

## Root cause

The v326 correction-pair normalizer wrapped `window.LabelerAplMapProfileGenerator.generate`, but `generatedServoProfile()` routed an active machine map directly to the lexical `generatedAplMapDrivenProfile(machineMap)` function. That bypassed the wrapper, so selected MultiModul maps could still emit adjacent CMD 7 rows and fail the machine-family grammar validator.

## Fix

Active APL machine maps now resolve `window.LabelerAplMapProfileGenerator.generate` at call time, with the lexical generator retained only as a fallback. This makes the actual selected-map Servo Program pass through the MultiModul CMD 3 -> CMD 7 -> CMD 3 correction-pair normalizer before validation.

## Regression

`tests/multimodul-profile-router-integration.test.js` exercises the selected-map route and asserts that an adjacent CMD 7 pair becomes `3, 7, 3, 7, 3`, the machine-family grammar passes, and `state.motionPlan.rows` remains synchronized.
