# ROS-03B / Phase 1 — Integration Regression Record

**Recorded:** 2026-10-23  
**Branch at time of review:** `feature/ros-frontend-integration`  
**Purpose:** Preserve regression results and outstanding security validation before ROS-03C.

## Results

|Test| Result| Evidence /limitation |
| Creator updates personal repair status | **PASS** | Manually tested in app; creator could change own event repair status. |
| Partner cannot change creator repair status | **PASS — UI** | Partner could not use creator-only repair controls. Independent unauthorized direct-write/RLS test remains recommended. |
| Reconnected does not imply mutual agreement | **PASS — current UI wording** | Creator status is attributed to creator; mutual repair confirmation is not implemented. |
| Switching accounts exposes no previous user's moments | **PASS — manual browser test** | Reported as tested in the app. Re-test on hosted and slow network before release. |
| Revoked membership denies event and perspective reads | **PASS — local SQL transaction** | Before revocation, simulated authenticated partner could read shared event. After temporarily removing the partner membership in the same SQL transaction, event, perspectives and couple queries returned no rows. `ROLLBACK` restored membership, and both membership rows were verified. |
| Revoked membership denies reads in an already-open client after a **committed** revocation | **PENDING** | Requires disposable couple in separate staging/hosted environment; use browser Network inspection and authenticated API calls. |

## Environment and scope

- The membership-revocation test above ran against **local Supabase SQL**, not a verified hosted deployment.
- The SQL Editor was used to simulate Account B via `SET LOCAL ROLE authenticated` and JWT claims; privileged SQL Editor reads alone are not RLS evidence.
- The deletion was temporary and rolled back; no intended permanent membership change was made.
- Local database rows and ad-hoc SQL do not become version-controlled just by committing application code.
- The test used a synthetic/shared friction event. Do **not** commit real private reflections, shared topic content, credentials, user emails, or local database exports to this repository.

## Remaining checks before production use

1. **Staging browser revocation:** Create a disposable two-member couple, verify access, commit revocation of one membership, and test existing authenticated session + direct event URL. Restore only in staging when appropriate.
2. **Direct write authorization:** Test that the non-creator cannot update `relationship_events.status`, `repair_method`, or `reconnected_at` using their authenticated API client. Verify persisted values afterward; a zero-row update may not raise an error.
3. **Hosted environment parity:** Verify applicable tracked migrations and RLS policies are deployed to the intended hosted Supabase project. Run read tests using both accounts, including private reflections and perspectives.
4. **Out-of-band membership removal:** Check whether an already-open Moments screen stops displaying previously fetched data after committed revocation; distinguish stale UI from a fresh server request returning forbidden data.

## Product interpretation

- The current `relationship_events.status` is **creator-owned** and does not assert that both partners feel repaired.
- Two-partner independent repair state is planned for **ROS-03C** and must not reuse creator-owned status as shared truth.
- Preserve Mine/Ours privacy, independent perspectives, author control, and explicit sharing/withdrawal semantics in ROS-03C.

**Status:** Phase 1 code integration may proceed to review, with the staging/browser revocation validation explicitly deferred and tracked. Do not mark this test as fully hosted/browser-verified.
