# Relationship OS

An Expo / React Native application for couples, with independent perspectives
and private-by-default personal repair reports. Routes live in `src/app/`.

## Toolchain and dependency policy

Use **Node.js 22.23.2** (recorded in `.node-version`) and **pnpm 12.5.1**
(recorded in `package.json#packageManager`). These are the validated project
baseline, not a claim that every other Node version is incompatible. Provision
these tools separately; validation commands must not download or repair them.
The pinned Node baseline satisfies the current React Native and Supabase engines.

Use only `pnpm-lock.yaml` for dependencies. Do not generate an npm or Yarn
lockfile. The lockfile remains in its existing v9 format with its reviewed
resolutions and integrity hashes.

`pnpm-workspace.yaml` explicitly denies `unrs-resolver`'s postinstall script.
Its platform binding is supplied by the locked optional dependencies; retain
optional dependencies. The script is a fallback installer, not a required compile
step on the validated Linux x64/glibc environment. Missing or broken bindings
must fail validation and receive separate investigation, not automatic build
approval. This policy does not prevent loading the prebuilt native binding.
No dependency build script is approved. Unreviewed builds fail under
`strictDepBuilds: true`.

`verifyDepsBeforeRun: error` prevents implicit dependency repair on `pnpm run` or
`pnpm exec`. `pmOnFail: ignore` disables pnpm 12's own tool-pin resolution and
lockfile writes; Corepack still reads `packageManager`, and the configuration
check independently requires the exact running Node/pnpm versions. Do not skip
that check when provisioning CI or validating an unfamiliar checkout.

## Setup in a separately approved environment

With the exact tools already provisioned, validate configuration before any
installation:

```sh
node scripts/check-pnpm-config.cjs
```

A future approved installation must use the frozen lockfile and retain optional
packages:

```sh
pnpm install --frozen-lockfile
```

Do not use approval, rebuild, force or repair commands to bypass a failure.
Review any new build requirement explicitly. A clean frozen installation has
not been executed as part of Finding 12. The proposed CI file is outside
`.github/workflows/`, pending review:
[ROS-03C-offline-ci.yml](docs/events/ros-03c-review/proposals/ROS-03C-offline-ci.yml).

## Safe local Expo profile

The existing `.env` targets isolated staging. Keep it unchanged. Do not start
the ordinary app against it. The client now requires an explicit local profile
and validates the target before creating Supabase or loading a stored session.
Only HTTP loopback URLs with an explicit port are enabled; hosted targets and
secret/service-role keys are rejected. No hosted profile is enabled by this change.

After separately provisioning a **new disposable local Supabase instance**, use
its actual API origin and `sb_publishable_` client key:

```sh
ROS_LOCAL_SUPABASE_URL='http://127.0.0.1:55321' \
ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY='<publishable key from the new local instance>' \
node scripts/start-local.cjs
```

Port 55321 is a candidate for the new instance, not a provisioned service. The
launcher refuses missing/invalid inputs before starting Expo. It clears inherited
Supabase/public variables, disables all dotenv loading, sets the local profile,
and runs `pnpm exec expo start --offline --localhost`. pnpm dependency verification
remains enabled. The public key is intended for the client bundle; never supply
a database password, access token, secret key or service-role key. There is no
fallback to the staging `.env`. The initial profile supports browser/loopback
development; physical-device or emulator host addresses need separate configuration
review rather than expanding the allowlist automatically.

Docker Desktop WSL integration is not available yet. Local provisioning remains
a separate step: select a new unlinked project/work directory and unused ports,
then review a bootstrap of the original 29 unchanged migrations plus a local-only
ACL setup for the two migration 30 functions. Migration 30's staging TLS, exact
PostgreSQL patch and history guards must remain unchanged; do not replay it locally
or fabricate its history entry. Keep hosted signup, Data API, Realtime and ordinary
application access disabled. Create synthetic Partner A/B/C through real **local**
Auth only after that setup is approved. Use separate browser profiles for distinct
sessions. No local backend, account or fixture is created by the Expo launcher.

Focused isolation checks make no SDK/network calls:

```sh
pnpm exec node --test --experimental-test-isolation=none --test-reporter=spec tests/local-supabase-target.test.cjs
```

## Offline validation with existing dependencies

Run these against matching, already-installed dependencies. They perform no
installation or dependency builds. The explicit overrides below allow a verified
temporary validation copy to reuse installed dependencies without pnpm trying to
reconcile workspace-specific `node_modules` metadata.

```sh
node scripts/check-pnpm-config.cjs
node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
```

On the proposed Linux x64/glibc CI platform, also run:

```sh
node scripts/check-resolver-binding.cjs
```

That check loads the prebuilt binary directly and never invokes a fallback
installer. Other platforms need their own clean-install and native-binding
validation. If a Windows shim cannot be launched directly, set
`PNPM_CONFIG_CHECK_BIN` to the already-installed native pnpm executable. The
configuration check invokes only version and project-specific config reads,
blocks Corepack network/auto-pinning and does not require application dependencies.

Expo normally generates ignored `expo-env.d.ts`. A temporary offline copy may
supply only its standard `/// <reference types="expo/types" />` reference for
TypeScript; do not commit generated types or run package installation to get them.

These checks exercise mocked frontend/privacy workflows, not PostgreSQL or native
UI integration. Database validation requires separate authorization and verified
runtime/storage isolation. Finding 5's runtime-preservation incident remains
unresolved; no existing development stack should be reused or inspected as a
shortcut. See the current [engineering handoff](docs/engineering/ROS-03C-handoff.md)
and the [Finding 12 report](docs/events/ros-03c-review/ROS-03C-finding12-implementation.md).
