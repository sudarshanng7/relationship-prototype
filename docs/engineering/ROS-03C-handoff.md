# Relationship OS — ROS-03C Engineering Handoff

Updated: 2026-10-23
Branch: feature/ros-03c-independent-repair-states

## Product purpose

Relationship OS helps couples work through meaningful
relationship moments and understand recurring patterns.

It is not primarily a questions, quizzes, games, calendar,
mood-tracking or generic AI advice application.

Key principle:
"We're not here to tell you how relationships work.
We're here to help you understand how yours works."

## Current technology

- Expo / React Native
- Expo Router
- TypeScript
- Supabase Auth and PostgreSQL
- Supabase Row Level Security (RLS)
- Local Supabase for development
- Git / GitHub
- pnpm
- VS Code with WSL

## Existing features

ROS-03A:
Private event reflections with independent ownership
and database authorization.

ROS-03B:
Independent partner perspectives with explicit submission,
withdrawal and Mine/Ours visibility protections.

ROS-03C:
Independent personal repair states for friction moments.

## Confirmed ROS-03C decisions

1. Repair status belongs to the individual user.
2. Private by default, explicit sharing required.
3. Each partner can report independently.
4. Optional "what helped" repair method.
5. Mine moments permit a creator-owned private repair state.
6. Existing legacy status values preserve their provenance.
7. Legacy Open defaults are not confirmed user reports.
8. Editing a shared repair report returns it to private.
9. Sharing withdrawal preserves the private record.
10. Shared report edits use report_version concurrency checks.
11. Moving Ours to Mine suspends shared repair states.
12. Restoring Ours must not automatically restore sharing.
13. One current repair state per partner per event.
14. Repair-state history is deferred.

## Database implementation

Applied locally:
20261023090000_ros03c_add_individual_repair_states.sql

New table:
public.event_repair_states

New RPCs:

- save_my_repair_state
- share_my_repair_state
- withdraw_my_repair_state

The existing visibility function:
set_moment_visibility

A trigger suspends repair sharing when an event moves
from Ours to Mine.

The repair-state table has RLS enabled.
Authenticated clients have SELECT permissions but
no direct INSERT, UPDATE or DELETE permissions.
Mutations use guarded RPCs.

## Legacy migration

Five original friction event records were imported:

- 3 open: legacy_default_unconfirmed
- 1 partially_repaired: legacy_creator_report
- 1 reconnected: legacy_creator_report

All were imported privately.

The private legacy snapshot table exists to detect
legacy-source changes before the final cutover.

## Test results

Local additive migration checks A-G: PASS.
Positive two-account SQL workflow: PASS.
Negative security scenarios 01-11: PASS.
Rollback integrity checks: PASS.

Frontend:
Step 4B Event Detail integration: PASS.
Step 4C Moments card integration: PASS.
Save privately / Save & share UX: implemented.
Step 4D Event Detail UI consolidation: PASS,
based on 11 manual regression checks.

## Current frontend

src/lib/repair-states.ts
Typed repair-state Supabase client.

src/components/EventRepairSection.tsx
Personal repair states, optional method, explicit sharing
and withdrawal.

src/app/event/[id].tsx
Modernized Event Detail, perspectives, visibility,
delete confirmation and repair component.

src/app/events.tsx
RLS-constrained repair summaries on Moments cards.

## Known limitations

The following legacy columns still exist:
relationship_events.status
relationship_events.repair_method
relationship_events.reconnected_at

They remain accessible through existing shared event rows.

Consequently, complete private-by-default repair privacy
has not yet been established.

The currently reviewed frontend avoids these fields,
but the database cutover is still necessary.

Save & share currently uses two RPC calls, not one atomic
operation. A failed sharing operation may leave the
report saved privately.

Event Detail asynchronous loading and account-change
race conditions deserve an additional targeted review.

The creator's ability to delete partner contributions
through event deletion remains a product-policy question.

Local manual testing has passed.
The hosted Supabase migration has NOT been performed.

## Next engineering milestone

ROS-03C Step 5:
Coordinated legacy repair-column cutover.

Before implementation:

- Perform a read-only dependency audit.
- Review all uses of the legacy columns.
- Review the moment-creation RPC.
- Review the legacy snapshot and later data changes.
- Review RLS and migration rollback/failure behavior.
- Ensure frontend and database changes are coordinated.

The existing cutover SQL files are REVIEW ONLY.

Do not execute the cutover migration until its final
version and execution plan are explicitly approved.

Do not merge this branch into main yet.

## Working procedure

Use small commits and review diffs.

For database and privacy work:

1. Inspect and report findings.
2. Propose a plan.
3. Wait for approval.
4. Implement on the feature branch.
5. Run local tests.
6. Review results before deployment.
