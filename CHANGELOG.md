# Changelog - ServoForge Labeler Tool

All notable changes to this project are documented below. Versions follow [Semantic Versioning](https://semver.org/).

## Unreleased (Aug 17, 2026)

### CONSOLIDATED
- **Wipe Direction Services**: Merged v116-v125 hotfixes into single `app/wipe-direction-services.js`
  - v116 (Aug 14): Inner radius hotfix - normalizes inside wipe depth to negative
  - v117 (Aug 14): Bottle spin hotfix - tracks stored servo direction independently
  - v118 (Aug 14): Servo coordinate parity - maps servo signs to visual frame
  - v119 (Aug 14): Side servo parity - swaps center-tack coverage based on direction
  - v125 (Aug 16): Physical wipe direction - applies section-aware center tack correction
  - **Deleted**: `wipe-direction-inner-radius-hotfix-v116.js`, `wipe-inner-bottle-spin-hotfix-v117.js`, `wipe-inner-servo-coordinate-parity-v118.js`, `wipe-side-servo-parity-v119.js`, `physical-wipe-direction-v125.js`

### CLEANUP
- Removed build artifacts: `deploy-v125.txt`, `.github/patches/`
- Fixed placeholder text (`XXX` → `e.g., ABC`) in community upload fields
- Added `ARCHITECTURE.md` documenting module organization and patterns
- Added `CODE_HYGIENE_AUDIT.md` detailing cleanup findings and follow-up work
- Added `VERSIONING_STRATEGY.md` establishing rules to prevent future version accumulation

## v0.9.10-auth.1 (Aug 17, 2026)

### Added
- **VERSIONING_STRATEGY.md**: Governance rules preventing `-vN` file accumulation
  - Consolidation patterns for hotfix chains
  - Code review checklist for versioned files
  - Feature flag patterns instead of new files
  - Quarterly consolidation target

### Deprecated
- Versioned files pattern (v116-v133):
  - `autocol-terminal-boundary-v120.js` → consolidate to `autocol-services.js` in next PR
  - `printed-codebox-left-edge-v121.js` → consolidate to `autocol-services.js` in next PR
  - `community-library-v103-integration.js` → consolidate to `community-library-services.js` in next PR
  - `community-library-v104-metadata-integration.js` → consolidate to `community-library-services.js` in next PR

## v0.9.10 (Aug 16, 2026)

### Added
- **Physical wipe direction v125** (`physical-wipe-direction-v125.js`)
  - Neck center tack opposite half handling
  - Section-aware center coverage correction
  - Physical direction semantics for wipe visualization

### Fixed
- Wipe side servo parity v119 (Aug 14)
  - Center tack left/right coverage swap in servo coordinates
  - Inside wipe depth normalization for APL labels

## v0.9.9 (Aug 14, 2026)

### Added
- **Servo coordinate parity v118** — Maps servo direction signs to visual frame
- **Bottle spin hotfix v117** — Tracks stored servo direction independently
- **Inner radius hotfix v116** — Normalizes inside wipe depth to negative values

### Fixed
- Autocol terminal boundary v120 — End-of-curve rest command handling
- Printed codebox left edge v121 — Codebox artwork alignment

## v0.9.8 (Aug 12, 2026)

### Added
- Community admin delete v126 — Moderation tools for community library
- Community library v103/v104 — User-submitted label configurations

### Changed
- Multi-map lock import integration v2 — Enhanced persistence
- Staging build banner authority v2 — Improved version display

## v0.9.5 – v0.9.7

### Added
- Cold glue gripper sequence integration v2
- Assembly planning logic (APL) enhancements
- Bottle orientation physical parameters
- Map builder object depth completeness v130-v133

---

## Guidelines for Future Entries

### When Consolidating Versions
```markdown
### CONSOLIDATED
- **Feature Name**: Merged vX-vY into single file
  - vX (Date): Description of what this version added
  - vY (Date): Description of what this version fixed
  - **Deleted**: old-file-vX.js, old-file-vY.js
```

### When Adding New Features
```markdown
### Added
- **New Feature** — Brief description
  - Related change 1
  - Related change 2
```

### Deprecation Notices
```markdown
### Deprecated
- Versioned file pattern for feature X — Use consolidation instead
```

### No More `-vN` Files
As of Aug 17, 2026, new versioned files require explicit approval and a consolidation deadline.
See `VERSIONING_STRATEGY.md` for details.

---

## Historical Context

Prior to Aug 17, 2026, the codebase accumulated 15+ versioned files (v116-v133) due to sequential hotfixes and features. This pattern created maintenance burden and unclear which versions were active.

**Resolution**: Consolidation strategy + governance rules to prevent recurrence.

See `VERSIONING_STRATEGY.md` for the consolidation framework going forward.

