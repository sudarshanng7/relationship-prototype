Relationship OS — ROS-03C Engineering Handoff
Updated: 2026-11-02
Branch: feature/ros-03c-independent-repair-states
Validated commit: 6ed27bd — fix(ros-03c): complete repair privacy cutover and client privilege hardening
Status: Local implementation and regression testing passed; integration review and hosted deployment are pending.
Product purpose
Relationship OS helps couples work through meaningful relationship moments and understand recurring patterns. It is not primarily a questions, quizzes, games, calendar, mood-tracking or generic AI advice application.
We're not here to tell you how relationships work. We're here to help you understand how yours works.

Current technology

- Expo / React Native, Expo Router, TypeScript
- Supabase Auth, PostgreSQL, Row Level Security (RLS), and guarded RPCs
- Local Supabase for development
- Git / GitHub, pnpm, VS Code with WSL
  Existing features
- ROS-03A: Private event reflections with independent ownership and database authorization.
- ROS-03B: Independent partner perspectives with explicit submission/withdrawal and Mine/Ours visibility protections.
- ROS-03C: Independent, personally owned repair states for friction moments, private by default with explicit sharing.
  Confirmed ROS-03C decisions

1. Repair status belongs to the individual user, not to the event or couple collectively.
2. Personal repair states are private by default; sharing requires explicit action.
3. Each partner may report independently; non-participation is not interpreted as a status.
4. The “what helped” repair method is optional.
5. Mine moments permit a creator-owned private repair state.
6. Legacy statuses preserve their provenance; legacy automatic open defaults are not confirmed personal reports.
7. Editing a shared repair report returns it to private.
8. Withdrawing sharing retains the author’s private report.
9. Sharing/editing uses report_version concurrency protection.
10. Moving Ours to Mine suspends shared repair states; returning to Ours never automatically re-shares them.
11. One current repair-state row per partner per event; a repair-state history/timeline is deferred.
12. One partner's reported reconnection must not be treated as mutual repair or agreement.
    Database implementation — applied locally
    The local database contains the ROS-03C additive repair implementation and later privacy hardening. Relevant migrations include:

- 20261023090000_ros03c_add_individual_repair_states.sql — public.event_repair_states, ownership/RLS, guarded repair operations and legacy preservation support.
- 20261027214000_ros03c_stop_legacy_status_on_creation.sql — stop writing a new legacy repair status during moment creation.
- 20261028184500_ros03c_revoke_legacy_repair_updates.sql — revoke obsolete legacy repair updates.
- 20261028200000_ros03c_restrict_event_insert_columns.sql — restrict event insertion privileges.
- 20261028220000_ros03c_legacy_repair_privacy_cutover.sql — preserve legacy data and drop relationship_events.status, repair_method and reconnected_at from the partner-readable event row.
- 20261102180000_ros03c_harden_client_table_privileges.sql — remove unintended anon table grants and authenticated administrative table grants across eight application tables; tighten applicable postgres schema default privileges.
  Existing protected operations include:
- save_my_repair_state
- share_my_repair_state
- withdraw_my_repair_state
- set_moment_visibility
  The repair-state table uses RLS; authenticated users read only what policy permits and cannot directly insert, update or delete repair reports. Repair mutations use guarded RPCs. Ours-to-Mine transitions suspend sharing, without automatically restoring it later.
  Legacy cutover and provenance
  The initial legacy import contained five friction-event records: three open defaults classified legacy_default_unconfirmed, one partially_repaired and one reconnected classified legacy_creator_report. These were imported privately.

During the later local cutover, the five original legacy snapshots were preserved. An additional historical automatic open value was archived as unconfirmed provenance and was not turned into a newly confirmed personal repair report. The legacy event-row repair columns were removed from the local schema; a REST selection of a removed field returns a missing-column error rather than exposing old data.

The two final SQL files in docs/events/ros-03c-review/ are review/rehearsal artifacts, ending in ROLLBACK;. The corresponding numbered migration files end in COMMIT;. Do not execute old cutover scripts against the already-cut-over local schema; their prerequisites belong to the earlier schema state.
Frontend integration

- src/lib/repair-states.ts — typed repair-state Supabase client.
- src/components/EventRepairSection.tsx — individual repair reports, optional method, private save, explicit sharing and withdrawal.
- src/app/event/[id].tsx — Event Detail, independent perspectives, visibility controls and repair section.
- src/app/events.tsx — Moments list with RLS-constrained repair summaries.
- src/app/profile.tsx — profile and relationship-space/invitation flows.
  An Ours moment shares the event but does not automatically disclose the author’s private reflection or repair report. A partner’s submitted perspective and a shared repair update are separate explicit-disclosure actions.
  Validation evidence — local only
  Earlier ROS-03C implementation checks
- Additive migration checks A–G: passed.
- Two-account positive SQL workflow: passed.
- Negative authorization scenarios 01–11: passed.
- Rollback integrity checks: passed.
- Event Detail integration (Step 4B), Moments cards (Step 4C) and UI consolidation (Step 4D): locally tested as recorded previously.
  Step 5E cutover
- Pre-cutover audits, source/dependency guards and rollback rehearsal completed before local application.
- Final cutover migration recorded as applied locally.
- Existing events, private reflections, perspectives and independent repair reports remained available in local post-cutover checks.
- Original historical snapshots retained; unconfirmed default provenance not represented as user-confirmed repair.
- Legacy event-level repair columns absent after cutover.
  Step 5F privilege hardening
- Rollback-only privilege rehearsal completed without SQL errors; five post-rollback restoration checks passed.
- Final hardening migration 20261102180000 recorded as applied locally.
- Read-only audit confirmed all eight application tables have RLS enabled, no remaining effective anonymous table/column privileges in the tested categories, and no authenticated administrative table/column privileges in the tested categories.
- The migration's in-transaction probe validated effective postgres-created table defaults in public for the tested client roles.
- Anonymous REST query on relationship_events was denied (HTTP 401, PostgreSQL 42501).
  Authenticated application regression after permanent hardening
- Partner A and B can read an Ours event; Partner B cannot read Partner A's private reflection.
- Both partners can create/read intended shared events and explicitly submitted perspectives.
- A newly created Ours friction moment and its author-owned private reflection behaved as expected.
- Each partner independently saved a private repair report and could read only their own report.
- Existing couple membership and profile screens loaded for Partner A and Partner B.
- New-user onboarding, relationship-space creation and invitation workflow were reported working locally.
- pnpm lint and pnpm exec tsc --noEmit both exited with code 0.
- Git branch working tree was clean after commit 6ed27bd, and the latest migration ledger had both cutover and grants-hardening migrations applied locally.
  Limit of evidence: These are local checks, not a claim of exhaustive security testing, hosted parity or production readiness. The full live-session membership-revocation scenario has not been demonstrated as part of this latest pass.
  Known limitations and unresolved questions

1. Hosted deployment not performed. Hosted/staging schema, grants, historical data, backups and rollout dependencies must be audited before any migration is applied there. Data-specific cutover guards may require a separately reviewed deployment procedure; do not assume the local data snapshot matches hosted data.
2. Save-and-share atomicity. The frontend uses separate save and share RPCs. If sharing fails, a successfully saved report can remain private. Do not imply that sharing succeeded merely because saving did.
3. Account-switch / asynchronous loading. Additional targeted review of Event Detail loading and account-transition race conditions is still worthwhile.
4. Deletion semantics. Whether an event creator may remove a partner’s contributed perspectives or repair state by deleting the parent event remains a product-policy decision.
5. Live membership revocation. Previously noted browser-session/staging revocation tests are not closed by the local two-user regression tests alone.
6. History and long-term intelligence. Multi-step repair history, learning sequences, recurring patterns, agreements and Our Playbook remain outside this ROS-03C implementation; no relationship-health scores or inferred mutual conclusions are authorized.
7. Historical documents. The October 23 additive-migration acceptance record and original proposed design contract describe their historical state and should not be silently rewritten to pretend that the later cutover had already occurred.
   Integration readiness and next milestone
   Local ROS-03C implementation: Complete for this scope, subject to the limitations above.

Git: The feature branch feature/ros-03c-independent-repair-states contains verified commit 6ed27bd. At the November 2 comparison, the branch was ahead of main with no behind commits, whereas TestBranch had diverged. Confirm the intended integration workflow and review the full feature-branch diff before selecting or merging a PR; do not merge directly into TestBranch by assumption.

Recommended immediate steps:

1. Review and commit this handoff update on the feature branch as a documentation-only change.
2. Prepare a draft pull request against the agreed integration base, with migration inventory, local test evidence, unresolved risks and deployment restrictions.
3. Review the complete pull-request diff and CI before any merge.
4. Separately design and approve hosted/staging migration rehearsal, backup/recovery, data-dependent prerequisites and authenticated post-deploy validation.
5. Only after approval consider merge/deploy. No hosted Supabase migration, database reset or forced branch reconciliation is authorized by this handoff.
   Working procedure
   For database/privacy work: inspect and report findings; propose a plan; obtain approval; implement on a feature branch; run local tests; review diffs and results before deployment. Preserve private-data boundaries, individual ownership and source provenance throughout.
