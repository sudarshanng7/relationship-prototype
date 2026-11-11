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

After approved setup, start the app with `pnpm exec expo start`.

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
