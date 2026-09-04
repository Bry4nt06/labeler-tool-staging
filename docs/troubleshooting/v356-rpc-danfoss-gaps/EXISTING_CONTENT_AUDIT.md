# Existing-content audit

## Already covered in v356

The base diagnostic library already contains the primary Danfoss/RPC fault family:

`servo-power-timeout`, `servo-enable-timeout`, `servo-power-loss`, `servo-feedback`, `servo-malfunction`, `servo-transition`, `servo-status`, `servo-count`, `servo-reset`, `servo-enumeration`, `servo-mode-switch`, `servo-version`, `servo-config`, `encoder-continuity`, `encoder-direction`, `io-box-communication`, and `servo-system-baseline`.

The existing records cover alarm-led troubleshooting, shared-versus-single-drive scoping, CAN/IO communication, drive enumeration, feedback, configuration, and safe baseline checks. They should be linked, not copied.

`topmodul-servo-table-internal-status.js` covers TopModul internal status faults 720–723. It is not the owner of RPC AC/DC converter diagnostics, monitoring-board diagnostics, the Danfoss code 600 condition, or the mechanical replacement procedure.

## Confirmed gaps

| Gap | Evidence | Proposed owner record |
|---|---|---|
| Touchscreen code 600 / no Power PC communication | Danfoss Word document, commissioning section | `servo-terminal-code-600` |
| RPC servomotor replacement and post-install commissioning | RPC PDF pp. 21–30, 32, 37–38 | `rpc-servomotor-replacement-guide` |
| RPC 300 V supply and monitoring-board diagnostic screens | RPC PDF pp. 33–34, supported by pp. 12–14 | `rpc-power-monitoring-diagnostics` |

## Import decision

Prepare three records only. Keep them as support/diagnostic guides with explicit relationships to the existing alarm records. Do not create another broad RPC fault catalog, duplicate the base servo flow, or wire new scripts from this branch.

The master implementation chat should choose the authoritative runtime owner after reviewing current architecture. The general base library is the leading candidate because these are cross-machine RPC/Danfoss concepts, but this research branch deliberately makes no ownership change.

