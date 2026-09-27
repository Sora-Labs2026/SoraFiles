# Revoke Device — 27 September 2026

Owner-authorized behavior: choose Revoke Device in Desktop, verify the purchaser's email, pay the one-time fee, and wait for authoritative payment confirmation. The server revokes that activation and frees its occupied seat. That device must explicitly activate the same or a new valid license through the server before processing again. No automatic activation follows payment.

Implemented in the working source:

- Release-mode orders revoke a specific provider instance, allowing later same-device activation and repeated revoke/rebind cycles. Historical transfer-mode reservations retain their original behavior.
- Purchaser OTP authorization is bound to the selected activation instance. A new revocation cycle needs fresh verification.
- Confirmed payment is checked against exact customer, checkout, product, amount, currency, and absence of refunds/disputes. Provider outages preserve a durable paid release for background retry.
- Completed-order responses identify the revoked instance so an old payment response cannot clear a newer activation.
- A protected local revoked marker removes the old key and entitlement, blocks processing and automatic trial initialization, and permits explicit online activation. A signed remote revocation produces the same state.
- The interface says Revoke Device, shows Device revoked with key entry, supports reopening the flow for another revocation, and receives background license status updates.
- Offline devices learn about remote revocation on their next successful server check; an unreachable device cannot receive an immediate remote state update.

Verification completed: 44 backend tests (including populated-schema migration under real workerd SQLite), 32 client/native-host/checkout tests, replacement browser QA, and full Desktop browser QA. Native cargo check passed. Native Rust tests and the refreshed cross-platform package run are tracked separately below.

Cloudflare version `4c80e539-47b2-475f-8a07-3b95e4081cd2` is uploaded to the production Worker as a staged version. It has NOT been deployed to traffic. Coordinate activation with the updated Desktop release; older clients used automatic replacement activation.

Public Desktop artifacts remain version 0.1.0. These source changes are intended for 0.1.1 and must not be described as publicly released until package checks, publication, and manifest updates are complete. No live paid revocation or customer contact was performed for this change.
