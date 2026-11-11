# ROS-03C — Draft 01 Static Review, Revision 2

**Status:** Review only; SQL NOT executed or validated against PostgreSQL.  
**Basis:** ROS-03C additive/cutover drafts and tracked migrations and client queries on `main` as of 2026-10-23.  
**Working design:** One current personal state per friction moment; private by default; deliberate share; edits unshare; withdraw without deleting; Mine creator only; no history; legacy provenance preserved.

## Review findings and resolutions in the revised drafts

| ID | Severity | Finding in v1 | Proposed resolution in v2 |
|---|---|---|---|
| C03-SQL-01 | Medium | Share, withdraw and Ours→Mine suspension changed the sharing state without updating `updated_at`. | Update `updated_at` on each successful mutation; increment `report_version`. |
| C03-SQL-02 | High | A stale screen can call `share_my_repair_state(event_id)` after another tab changed the private state, inadvertently sharing an update the person never reviewed. | Add monotonic `report_version`, and require the client to submit `p_expected_report_version` with the explicit share action; reject if it changed. The compatible client must display/review the chosen state before sharing. |
| C03-SQL-03 | High | Backfill in Draft 01 could become stale if old-client status/method/timestamp writes occur before Draft 02; those edits could be lost by dropping the legacy columns. | Save a private snapshot in Draft 01. At cutover, lock the parent table, **fail closed** if snapshotted rows changed, import rows created since Draft 01 without overwriting explicit personal states, then drop legacy columns and the snapshot atomically. On a mismatch, stop and reconcile data (do not override). |
| C03-SQL-04 | High | Older clients select and directly update `relationship_events.status`, `repair_method`, `reconnected_at`. | **Unresolved rollout dependency, not a SQL-only fix.** Update `events.tsx`, `event/[id].tsx`, creation RPC and any outside clients; prohibit old clients from using the database at cutover. Add staging verification. |
| C03-SQL-05 | High | New privacy table coexists with legacy creator status columns readable on an Ours event. | **Unresolved until cutover.** Never claim private-by-default before old columns are removed/restricted, queries updated and authorization tests passed. |

## Revision 2 interface changes

- `event_repair_states.report_version bigint NOT NULL DEFAULT 1` (optimistic concurrency token).
- `public.share_my_repair_state(p_event_id uuid, p_expected_report_version bigint)` replaces the v1 one-argument proposed draft RPC. This RPC **does not yet exist in any database**.
- `save_my_repair_state()` returns the state to private and increments `report_version` when overwriting an existing row.
- Explicit share, withdraw, and visibility suspension update `updated_at` and the version.
- Private snapshot table `private.ros03c_legacy_repair_snapshot` is a temporary compatibility safeguard. It is not an application table and gets removed at a successful cutover.
- Cutover acquires an `ACCESS EXCLUSIVE` lock on `relationship_events`, tests the snapshot, and imports later-created legacy events with `ON CONFLICT DO NOTHING`. A mismatch aborts the transaction. **Never use `DROP ... CASCADE` to force the cutover.**

## Further verification still required before execution

1. Inspect the **actual local schema** and permissions (not just Git migrations), including functions, triggers, `pg_policies`, dependency graphs, Realtime configuration and the project migration ledger.
2. Ensure the migration rollout cannot accept legacy repair updates while transitioning. The snapshot guard detects changed earlier rows, but it cannot infer the chronology of competing new/legacy edits; a planned write freeze and coordinated cutover are necessary.
3. Code review the `SECURITY DEFINER` helpers against the actual function ownership, RLS and schema exposure settings. The private helper should never reveal another person's event information.
4. Test against disposable local data with two authenticated identities: own/partner Mine/Ours visibility, revocation, direct unauthorized writes, edit/withdraw, Ours→Mine→Ours, stale-version share rejection, and concurrency.
5. Verify legacy `open` is presented as an **unconfirmed default**, not a self-reported feeling.
6. Validate counts and data preservation before/after cutover, and confirm a failure rolls back all changes.
7. Keep staging browser membership-revocation test and hosted migration parity on the open security checklist.

## Implementation order once reviewed and approved

A. Record this review and v2 drafts in `docs/events/ros-03c-review`; **not** `supabase/migrations`.

B. Later, convert a reviewed v2 additive draft to a versioned local migration and execute it only after the user approves. Run RLS tests and no-leak checks. At this stage legacy Ours columns still prevent the full privacy claim.

C. Prepare compatible app changes before cutover. Include an explicit share confirmation using the latest row `report_version` and avoid relying on parent event-level repair fields.

D. Coordinate cutover against disposable local data and then staging only after approval. Do not deploy either v2 draft to a hosted or production database without a separate migration plan.

**Result of this review:** v1 drafts should not be promoted unchanged. v2 drafts are improvement candidates, **not certified runnable migrations**. SQL syntax/runtime, permissions, concurrency and migration correctness remain unverified until local DB execution is separately authorized.
