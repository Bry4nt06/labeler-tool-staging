# Exact Simulation selector values

The Simulation renderer trimmed both the option label and value. The authoritative
brand-selection controller looks up the exact saved brand string, so an imported
recipe named ` Modelo Especial ` was offered as `Modelo Especial` and rejected.
The current user Modelo entry was not available for inspection; this is a
reproduced general defect, not a brand-specific condition.

`servoSimulationSelectOptions` now trims only display labels. Values, deduplication
and selected-option comparison preserve saved identities, with existing HTML
escaping retained. Blank names remain excluded. Brand and bottle selectors share
this maintained helper; no extra controller, listener or compatibility layer was
added and no saved recipe is renamed.

Two new regressions fail on v360 and pass here. Coverage includes surrounding
spaces, exact identity persistence, matching bottle, distinct saved names, duplicate
removal and HTML escaping. The existing desktop/mobile browser test now selects a
padded Modelo fixture through the actual dropdown. Local checks: simulation 16,
adjacent brand/contact/RPC 3, startup 261 and update 3 all pass; changed JavaScript
syntax and whitespace checks pass. Browser verification runs in CI because local
Chromium is unavailable.

Release `simulation-brand-values-v361-20261008`, staging acceptance before
production promotion. Rollback: revert this release merge to
`5530338a1e90e9604219c899b081b296a4cde3d4` (v360).
