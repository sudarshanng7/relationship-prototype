# ROS-03C Step 4B — Event Detail frontend integration

Scope: local development only; do not apply to hosted Supabase.

This package adds `src/components/EventRepairSection.tsx` and a one-time script
`scripts/apply_ros03c_step4b.py` that updates existing Event Detail and Moments
list files in place. It does not modify database tables or migrations.

Before running, confirm:
- Working tree is clean and branch is `feature/ros-03c-independent-repair-states`.
- `src/lib/repair-states.ts` is present and TypeScript checks currently pass.
- Local Supabase has migration `20261023090000` applied.

From repository root:

```bash
python3 scripts/apply_ros03c_step4b.py --check
python3 scripts/apply_ros03c_step4b.py --apply
pnpm exec tsc --noEmit
pnpm exec expo lint
git diff --check
git diff --stat
```

Inspect diffs carefully, especially any changes to Mine/Ours or Our Perspectives.
If working on web, run Expo with your *local* Supabase environment variables.

## Manual acceptance tests (two authenticated accounts)

1. A opens an Ours friction event. Imported repair is marked private and as legacy;
   a `legacy_default_unconfirmed` value requires an explicit save to confirm.
2. A chooses a status and optionally a repair method, then presses **Save privately**.
   B opens/refreshes the same event: A's repair state is not visible.
3. A chooses **Share my saved update**, then **Confirm sharing**.
   B refreshes and sees A's shared status and optional method, explicitly labelled
   as A's report (not mutual repair).
4. A changes the report and saves. B refreshes and can no longer read the new
   personal report. A must explicitly reshare.
5. A shares again, then withdraws. B refreshes: no shared update; A keeps private data.
6. B independently saves and shares a different state. A sees B's reported state
   without either state overriding the other.
7. A Mine friction event allows personal saving but does not display sharing controls.
   B cannot open that Mine event.
8. Existing Our Perspectives submit/edit/withdraw and event Mine/Ours controls still work.
9. Switch accounts in the same browser, revisit Event Detail, and confirm no
   previous account's private information appears.
10. Run `pnpm exec tsc --noEmit` and `pnpm exec expo lint`.

`src/app/events.tsx` receives only an interim compatibility change: it stops
reading/displaying legacy event-level status and shows neutral text on friction
cards. Full cards with independently shared updates are Step 4C.

**Security limitation:** Until coordinated cutover removes legacy
`relationship_events.status`, `repair_method`, and `reconnected_at`, an authorized
partner can still query those legacy fields on an Ours event. The component does
not use them, but the database is not fully private-by-default yet. Keep this
feature on the local branch; do not release/deploy to hosted yet.

After testing:

```bash
git add 'src/app/event/[id].tsx' src/app/events.tsx src/components/EventRepairSection.tsx
git diff --cached --check
git commit -m "feat: integrate independent repair updates in event detail"
# One-time helper may be deleted after applying; do not need to commit it:
rm scripts/apply_ros03c_step4b.py
git status --short
git push
```
