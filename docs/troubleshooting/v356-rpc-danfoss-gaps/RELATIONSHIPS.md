# Relationships to existing troubleshooting content

| Proposed record | Link to existing record | Relationship / routing note |
|---|---|---|
| `servo-terminal-code-600` | `servo-system-baseline` | Use baseline capture and scope discipline, but keep code 600 focused on touchscreen-to-master communication. |
| `servo-terminal-code-600` | `io-box-communication` | Related communication symptom; distinct paths. Code 600 is Power PC/master Ethernet readiness, while IO-box communication follows the RPC/CAN-IO path. |
| `rpc-servomotor-replacement-guide` | `servo-feedback`, `servo-malfunction` | These may justify a replacement only after isolation proves a motor fault. |
| `rpc-servomotor-replacement-guide` | `servo-count`, `servo-enumeration`, `servo-version`, `servo-config` | Use after installation to route addressing, enumeration, firmware, and parameter/setup faults. |
| `rpc-power-monitoring-diagnostics` | `servo-power-timeout`, `servo-enable-timeout`, `servo-power-loss` | The RPC screens supply evidence for upstream converter and enable/power conditions. |
| `rpc-power-monitoring-diagnostics` | `servo-feedback`, `servo-malfunction` | If common power and the relevant monitored line are healthy, continue downstream at the affected station. |
| `rpc-power-monitoring-diagnostics` | `io-box-communication` | Use CAN/system status to separate monitoring/communication failures from electrical branch failures. |

## Suggested master-chat flow change

If the master implementation chat updates the existing `servo-bottle-plate` flow, add only these decisions:

1. “Does the touchscreen show code 600 / no PC communication?” → `servo-terminal-code-600`.
2. “Do RPC diagnostics show a 300 V supply or monitoring-board abnormality?” → `rpc-power-monitoring-diagnostics`.
3. “Has a motor failure been proven and replacement authorized?” → `rpc-servomotor-replacement-guide`.

Do not create a separate competing servo flow. Preserve the existing first-fault capture, all/group/single scope split, and safe baseline route.

