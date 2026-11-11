# PR #7 — A04 legacy repair attribution implementation

Prepared 2026-11-08 (Europe/Berlin). Target repository: `sudarshanng7/relationship-prototype`.
Worktree: `/home/sud/ros03c-tests/pr7-a04-a05-final-gaps`.
Branch: `fix/pr7-a04-a05-final-gaps`; base: `27ad9d1c734b12991d626bdbd8323308d1e45e98`.

Uncommitted candidate for review. A04 changes client presentation and deliberate current selection; it does not change database provenance, authorization, sharing or concurrency contracts. A05 has a separate report and patch. Finding 5's runtime-preservation incident remains unresolved. No release approval is implied.

## Root cause and provenance contract

EventRepairSection previously loaded every own report's status/method into the current draft. An unconfirmed imported Open therefore appeared as “Saved for you: Still unresolved”, had its radio selected, and allowed Save or the save-and-share confirmation path without a new status choice. A generic import footnote did not correct the personal attribution in the headline or the implied current selection.

Reviewed the attachment and final audit, current engineering handoff and confirmed ROS-03C decisions, effective legacy import/cutover and checked repair migrations, typed repair client, EventRepairSection, Moments, My contributions, and existing tests. The source establishes:

| Origin | Meaning |
| --- | --- |
| `explicit` | A deliberate personal report saved through the reviewed mutation contract. Share is a separate deliberate action. |
| `legacy_creator_report` | Preserved earlier creator report, including historical partial/reconnected values; not newly confirmed consent. |
| `legacy_default_unconfirmed` | An imported historical Open that may have been set automatically by old moment creation; not a deliberate personal report. |

The original import classified Open defaults separately and imported reports privately. The later cutover preserved historical snapshots, including additional old event values, before retiring partner-readable legacy event columns. Loading this information does not update provenance, grant sharing consent or invent a contemporary report time. The unchanged checked-save function—not the UI—sets `status_origin = explicit` on an authorized successful save. The reviewed database constraint and sharing RPC prohibit sharing a non-explicit report.

The package declares Expo major 57. Consulted the [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), [documentation index](https://docs.expo.dev/llms.txt) and existing SDK-compatible focus/Pressable conventions. No Expo/React Native dependency or navigation API was changed.

## Implementation and before/after behavior

| Case | Before | After |
| --- | --- | --- |
| Unconfirmed imported Open | Personal “Saved for you: Still unresolved”; Open preselected | “Imported status: Open — not confirmed by you”; no current status selected |
| Import explanation | Generic footnote mixed automatic defaults and historical reports | Explains that the status came from an earlier version and may have been automatic; asks for a current choice |
| Save before current choice | Available because the imported row was preselected | Save privately is visibly disabled; no save/share handler can dispatch without a status selection |
| Selecting Open again | Could be mistaken for an already-confirmed unchanged status | Selecting the Open radio is a deliberate new choice, even though its value matches the import; checked save consumes the loaded version |
| Historical creator report | Generic saved headline/automatic-default footnote | “Earlier report: …”, preserved-history explanation and historical method attribution; no current selection until chosen |
| Explicit report | Existing personal headline and editable selection | Preserved, including unchanged share, withdrawal and conflict behavior |
| Missing or partner-only report | No own report | Still “You haven't recorded a personal repair update yet”; no inferred own Open |

Historical status and method stay in the summary. A fresh draft starts unselected for both legacy origins, with no imported method copied into a current choice. Selecting a current non-Open status leaves its method optional. An unconfirmed default's method is not presented as a personally reported “what helped”.

The mutation handlers and typed RPC client are unchanged. Current choices do not relabel the loaded record as explicit. After a save acknowledgment, the existing authenticated refresh/reconciliation path determines the current row. A lost acknowledgment leaves the historical view until a deliberate read establishes the server state. An acknowledged private save with a failed/stale refresh retains the existing uncertainty message; this change does not add a current-privacy assurance.

Ours sharing still requires a status choice and explicit confirmation. A non-explicit report must first be saved through the version-checked API, and sharing uses the **actual returned version**. Mine has no share action. No load, radio choice, refresh or focus return mutates data automatically. Partner reports remain separately attributed; no joint repair inference was added.

## Complete A04 diff

| File | Purpose |
| --- | --- |
| `src/components/EventRepairSection.tsx` | Provenance-aware primary summary, separate explanations, deliberate draft initialization and disabled imported Save |
| `tests/repair-states.test.cjs` | Adapt two existing assertions to the newly required legacy status choice; retain all 144 existing repair cases |
| `tests/legacy-repair-attribution.test.cjs` | 22 new tests executing the actual component and typed client |
| `tests/helpers/repair-section-harness.cjs` | Test-only harness/fixtures adapted from the existing repair suite, with a source-mutant hook for the negative control |
| This report | Contract, source changes, validation and limits |

Complete A04 diff: `/tmp/pr7-a04-a05-review/A04.patch`.
Complete combined diff: `/tmp/pr7-a04-a05-review/combined.patch`.
Neither A04 source nor its tests depend on A05. My contributions, Moments, account boundaries, repair client/RPC signatures, all SQL migrations/RLS and the A02/A03 implementations remain byte-for-byte unchanged.

## Regression evidence

The new suite runs the real EventRepairSection and real typed repair helper, with deterministic hook/native/focus/transport substitutes. It is not a React renderer, device, PostgreSQL or HTTP test. Synthetic rows and “commit” behavior are test fixtures; no private user data or real credentials are involved.

**A04: 22 passed, 0 failed, exit 0.** Cases include:

- Unconfirmed imported Open on Mine and Ours; correct primary copy, no selected radio, disabled Save and zero writes on load or retained disabled Save handler.
- Deliberate Open-again and different-status selection on both scopes; correct version, author header, private save and provenance only after server acknowledgment/current read.
- Pending save preserves the imported attribution; selecting alone does not change provenance.
- Deliberate share confirmation, checked save and actual saved-version sharing.
- Both preserved historical creator-report statuses and their method/provenance; deliberate updating required.
- Existing explicit editing; absent report; partner-only report cannot populate the caller's status.
- Reload clears unsaved historical confirmation; focus loss/refocus invalidates a delayed save; account replacement suppresses stale history/choices.
- Version conflicts for private and save/share paths; lost save acknowledgment with simulated commit/no-commit; read-only refresh without retry; acknowledged private save plus failed refresh.
- Diagnostic negative control restores the old personal headline/preselection in an in-memory source mutant and demonstrates that the new assertion detects it. No production source is changed by that control.

The 295-test baseline still passes after two targeted expectation updates: the old legacy-sharing case now explicitly selects Open before confirming, and an explicit “load newer” of historical provenance no longer expects the imported method to be an active current choice. Existing sharing uncertainty, report-version, withdrawal and private-save reconciliation assertions remain. All 34 A03 author-contribution tests pass with that screen's existing wording unchanged.

## Actual offline checks

Work was prepared and validated in `/tmp/pr7-a04-a05-offline-hfd38jm7/project`. This copy uses a symlink to already-provisioned dependencies at `/home/sud/relationship-project/relationship-prototype/node_modules`; package.json and pnpm-lock.yaml were byte-compared first. The temporary copy alone received the standard ignored Expo environment type reference. No installation, upgrade, dependency-source edit or change to the original feature branch occurred. Tools: Node 22.23.2, pnpm 12.5.1, Python 3.10.12.

| Check | Actual final result |
| --- | --- |
| Baseline five client suites | 295 passed, 0 failed; separate TAP log |
| A04 suite | 22 passed, 0 failed; separate TAP log |
| Combined six client suites | 317 passed, 0 failed; exit 0 |
| A05 source-only manifest tests | 32 passed, exit 0; separate Python log |
| Offline `pnpm exec tsc --noEmit` | Exit 0, no diagnostics |
| Offline `pnpm exec expo lint --no-cache` | Exit 0, no diagnostics |
| Unchanged pnpm configuration checker | Exit 0 |
| Patch whitespace/applicability and protected-source comparisons | Checked against the clean designated base; see review evidence |

Commands used offline/no-repair flags:

```sh
node --test --experimental-test-isolation=none --test-reporter=tap tests/legacy-repair-attribution.test.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs tests/moment-creation.test.cjs tests/author-contributions.test.cjs
node --test --experimental-test-isolation=none --test-reporter=tap tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs tests/moment-creation.test.cjs tests/author-contributions.test.cjs tests/legacy-repair-attribution.test.cjs
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 node scripts/check-pnpm-config.cjs
```

During iteration, four new tests initially named the refresh button incorrectly; those selectors were corrected. The existing legacy reconciliation case exposed the intentionally changed post-reload selection expectation, which was updated without removing its uncertainty assertions. Final counts above are from passing runs, not those initial failures. Logs and source hashes are in `/tmp/pr7-a04-a05-review/evidence/`.

## Decisions, limitations and remaining gates

Review the chosen copy and the requirement to select a current status for **both** legacy origins. This is a deliberate client UX change within the supplied brief, not a database provenance rewrite or a new partner permission. Historical data remains available in the summary and private snapshot; a current save still replaces the current row under the existing current-state-only contract, not a newly invented history feature.

Real two-account/device behavior, screen-reader/localization acceptance, SQL/HTTP/live revocation, hosted parity, clean installation and deployment remain unexecuted. No SQL or concurrency runner was executed; no PostgreSQL connection, Docker/Supabase operation, runtime creation, hosted/native test, CI activation, PR edit, commit, push, merge or deployment occurred. Finding 5 and the broader final-schema/rollout/product-policy gates remain open.
