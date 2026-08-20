# ServoForge Versioning Strategy

This document establishes rules for versioning features and preventing the accumulation of stale versioned files.

## The Problem

As of August 2026, the codebase contains 15+ versioned files (v116-v127) from incremental fixes:

```
app/wipe-direction-inner-radius-hotfix-v116.js
app/wipe-inner-bottle-spin-hotfix-v117.js
app/wipe-inner-servo-coordinate-parity-v118.js
app/wipe-side-servo-parity-v119.js
app/autocol-terminal-boundary-v120.js
app/printed-codebox-left-edge-v121.js
app/autocol-coder-codebox-generation-v122.js
app/community-admin-delete-v126.js
app/physical-wipe-direction-v125.js
```

This accumulation creates maintenance burden, confusion about which versions are active, and technical debt.

## Solution: Consolidation + Prevention

### PHASE 1: Immediate Consolidation (PR #X)

#### 1. **Wipe Direction Chain (v116-v125) → `wipe-direction-services.js`**

**Why consolidate**: These are sequential fixes for the same feature area (wipe direction servo semantics). The logical progression is:
- v116: Inner radius hotfix
- v117: Bottle spin hotfix
- v118: Servo coordinate parity
- v119: Side servo parity + inside-wipe depth normalization
- v125: Physical wipe direction + neck center tack handling

**Action**:
1. Create new file: `app/wipe-direction-services.js`
2. Merge all five modules into one, accumulating their features
3. Keep internal function names from latest version (v125) as primary API
4. Add comments documenting what each version contributed
5. Update `app.js` to load `wipe-direction-services.js` instead of v119 + v125
6. Delete: v116, v117, v118, v119, v125 files
7. Update tests to reference `wipe-direction-services.js`

**New file structure**:
```javascript
"use strict";
(function installWipeDirectionServices(global) {
  // v116: Inner radius hotfix
  // - normalizeAplInsideWipeDepth()
  
  // v117: Bottle spin hotfix
  // - storedServoDirection()
  
  // v118: Servo coordinate parity
  // - servoCoordinateVisualSign()
  
  // v119: Side servo parity
  // - swapCenterCoverage()
  // - centerTackNeedsSideSwap()
  
  // v125: Physical wipe direction
  // - physicalMachineDirection()
  // - sectionAwareCenterCoverage()
  
  // Combined public API
  global.LabelerWipeDirectionServices = Object.freeze({
    storedMachineDirection,
    physicalMachineDirection,
    servoCoordinateVisualSign,
    physicalWipeVisualSideForPlateTravel,
    swapCenterCoverage,
    sectionAwareCenterCoverage,
    normalizeAplInsideWipeDepth,
    // ... and all exported functions
  });
})
```

#### 2. **Autocol Chain (v120-v121) → `autocol-services.js`**

**Why consolidate**: v120 (terminal boundary) and v121 (printed codebox) are related autocol fixes.

**Action**:
1. Create: `app/autocol-services.js`
2. Merge v120 and v121 logic
3. Update `app.js` to load `autocol-services.js`
4. Delete: v120, v121, v122 (if unused)
5. Update tests

#### 3. **Community Library Chain (v103-v104) → `community-library-services.js`**

**Why consolidate**: v103 is the base, v104 adds metadata. Merge into single module.

**Action**:
1. Rename: `app/community-library-v103-integration.js` → `app/community-library-services.js`
2. Inline v104 metadata functionality
3. Delete: `app/community-library-v104-metadata-integration.js`

### PHASE 2: Future Prevention

#### Rule: No More `-vN` Suffixes (Except Rare Cases)

**When versioning is allowed**:
- Only for backwards-compatibility bridges during multi-step migrations
- Must be approved in code review with explicit migration plan
- Must have an issue/milestone target for consolidation
- Example: `-v2` allowed only if v1 is actively deprecated and a migration plan exists

**When versioning is NOT allowed**:
- For bugfixes (consolidate into the main file immediately)
- For incremental features (use feature flags, not new files)
- For experimental code (use branches or feature branches)

#### Pattern: Use Feature Flags Instead

Instead of creating `feature-v2.js`, use feature flags and consolidate:

```javascript
// ✗ OLD: Create multiple files
app/wipe-direction-hotfix-v117.js
app/wipe-direction-hotfix-v118.js
app/wipe-direction-hotfix-v119.js

// ✓ NEW: Single file with feature flags + changelog comment
app/wipe-direction-services.js
/*
 * Features:
 * - v117 (Aug 2026): Bottle spin hotfix
 * - v118 (Aug 2026): Servo coordinate parity
 * - v119 (Aug 2026): Side servo parity
 */
const features = {
  bottleSpinV117: true,
  servoCoordinateParityV118: true,
  sideSideServoParityV119: true
};
```

### PHASE 3: Governance (Going Forward)

#### Before Creating a Versioned File

Ask these questions:

1. **Is this a bugfix?** → Patch the existing file, don't create v2
2. **Is this experimental?** → Use a feature branch, not a vN suffix
3. **Is this a backwards-compat bridge?** → OK to use vN, but get approval + migration plan
4. **Does the existing file lack permissions to edit?** → Refactor to allow inline patches instead

#### Code Review Checklist for Version-Numbered Files

- [ ] Is there an existing file in this domain?
- [ ] If yes, why not consolidate instead of creating v2?
- [ ] Is there a migration plan to consolidate with the previous version?
- [ ] Is there a GitHub issue/milestone tracking this consolidation?
- [ ] Will old version be deleted/deprecated, or kept forever?

#### File Naming: Use Clear Feature Names, Not Versions

```
✗ BAD:  app/wipe-direction-hotfix-v117.js
✓ GOOD: app/wipe-direction-services.js (comment documents v117-v125)

✗ BAD:  app/autocol-integration-v2.js
✓ GOOD: app/autocol-services.js (single source of truth)

✗ BAD:  app/community-lib-v103-integration.js, v104-metadata-integration.js
✓ GOOD: app/community-library-services.js (consolidated)
```

### PHASE 4: Documentation

#### New File: CHANGELOG.md

Track feature history and version consolidations:

```markdown
# Changelog

## Unreleased (Aug 2026)
- **CONSOLIDATED**: Wipe direction fixes v116-v125 → `wipe-direction-services.js`
- **CONSOLIDATED**: Autocol fixes v120-v121 → `autocol-services.js`
- **CONSOLIDATED**: Community library v103-v104 → `community-library-services.js`

## v0.9.10 (Aug 16, 2026)
- Added physical wipe direction v125 (`physical-wipe-direction-v125.js`)
- Added wipe side servo parity v119 (`wipe-side-servo-parity-v119.js`)
- ...
```

#### New Inline Comment Format

For consolidated files, add a header comment:

```javascript
"use strict";
/**
 * Wipe Direction Services
 * 
 * Consolidated from multiple hotfixes:
 * - v116 (Aug 14, 2026): Inner radius hotfix
 * - v117 (Aug 14, 2026): Bottle spin hotfix  
 * - v118 (Aug 14, 2026): Servo coordinate parity
 * - v119 (Aug 14, 2026): Side servo parity + inside-wipe depth normalization
 * - v125 (Aug 16, 2026): Physical wipe direction + neck center tack handling
 * 
 * Public API:
 * - storedMachineDirection()
 * - physicalMachineDirection()
 * - servoCoordinateVisualSign()
 * - physicalWipeVisualSideForPlateTravel()
 * - ... (see exports below)
 */
(function installWipeDirectionServices(global) { ... })
```

## Summary: Old vs. New Patterns

| Aspect | OLD (v116-v125) | NEW (Going Forward) |
|--------|-----------------|-------------------|
| **Multiple fixes** | One file per version | Consolidate into one file per feature area |
| **Backwards compat** | Keep all old versions | Delete old versions after consolidation |
| **Documentation** | None | CHANGELOG.md + inline comments |
| **Review process** | No guidelines | Checklist before approving vN files |
| **Feature flags** | No | Use feature flags instead of new files |
| **Migration planning** | Informal | Explicit GitHub issue + milestone |

## Immediate Action Items

### For This PR
- [ ] Consolidate wipe-direction v116-v125 → `wipe-direction-services.js`
- [ ] Consolidate autocol v120-v121 → `autocol-services.js`
- [ ] Consolidate community library v103-v104 → `community-library-services.js`
- [ ] Update `app.js` script loading order
- [ ] Delete old versioned files
- [ ] Create `CHANGELOG.md` documenting the consolidation
- [ ] Create this `VERSIONING_STRATEGY.md` file

### For Future PRs
- Update `.github/pull_request_template.md` to include version check
- Add pre-commit hook to flag `-v[0-9]` filenames for review
- Add GitHub issue template for "Feature consolidation" task type

## Questions?

When in doubt about versioning:
1. Check this document
2. Ask in code review
3. Open a discussion issue if adding new vN patterns

**Goal**: Consolidate versioned files quarterly; never accumulate more than 2 versions of the same feature.

