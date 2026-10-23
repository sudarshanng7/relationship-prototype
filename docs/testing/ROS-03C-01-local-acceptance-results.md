# ROS-03C — Additive Database Migration: Local Acceptance Results

**Date:** 2026-10-23  
**Environment:** Local Supabase only  
**Migration:** `20261023090000_ros03c_add_individual_repair_states`  
**Status:** Additive migration and local SQL tests passed; full private-by-default cutover not completed.

## Migration verification (checks A–G)

| Check | Result |
| --- | --- |
| A — `event_repair_states` and private legacy snapshot exist | PASS |
| B — Five legacy source records, five imported states, five snapshots | PASS |
| C — Three Open/unconfirmed defaults; one Partially repaired and one Reconnected legacy report | PASS |
| D — No missing or mismatched imports and no imported states accidentally shared | PASS |
| E — `authenticated` may SELECT but cannot directly INSERT, UPDATE or DELETE repair states | PASS |
| F — RLS, SELECT policy and Ours-to-Mine sharing suspension trigger exist | PASS |
| G — Migration `20261023090000` appears in the local migration ledger | PASS |

## Behavioral and authorization tests

| Test suite | Result | Evidence |
| --- | --- | --- |
| Two-account positive workflow | PASS | Asserted local SQL script returned `PASS: rollback restored original Ours event`; includes independent private states, explicit sharing, edits, withdrawal and Ours-to-Mine behavior. |
| Negative security checks 01–11 | PASS | Final SQL result `PASS: negative tests 01-11 completed; database state restored`; all five post-rollback integrity flags were `true`. |

Both scripts executed in transactions and rolled back their temporary changes. This record deliberately contains no user IDs, private moment text, credentials, or raw database exports.

## Limitations and follow-up

- The current `relationship_events.status`, `repair_method` and `reconnected_at` columns **remain on shared event rows**, so private-by-default repair privacy is **not** complete despite new table RLS passing.
- React Native Event Detail and Moments screens still read legacy repair fields and require a coordinated implementation change.
- This milestone was tested **locally**. Hosted schema parity, migrations and authenticated browser behavior remain unverified.
- A committed membership revocation in a live staging browser session is still pending from the ROS-03B test plan.
- Imported legacy `open` reports are classified `legacy_default_unconfirmed`; users must explicitly confirm/edit before sharing.
- Do not run the legacy cutover draft or deploy the additive migration to hosted Supabase until the coordinated client and database transition is reviewed.

## Next milestone

ROS-03C Step 4: Add a typed repair-state API client, then adapt Event Detail and Moments to read independently owned repair states and perform save/share/withdraw actions via tested RPCs. Follow with local regression and controlled legacy-column cutover.
