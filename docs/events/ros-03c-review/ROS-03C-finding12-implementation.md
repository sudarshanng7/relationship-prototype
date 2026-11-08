# PR #7 Finding 12 — pnpm policy and reproducibility

Prepared 2026-11-08 (Europe/Berlin), repository
`sudarshanng7/relationship-prototype`, worktree
`/home/sud/ros03c-tests/pr7-pnpm-reproducibility`, branch
`fix/pr7-pnpm-reproducibility`, base/HEAD
`da0afadee827e440d25c258b93be50afb9ef4ab3`.

Source correction and safe offline validation are complete for review. No
installation, upgrade, rebuild, build approval, package-manager repair, database
connection, SQL execution, Docker/Supabase operation, commit, push, merge,
deployment or PR edit occurred. The original feature worktree remains untouched.
Finding 5's runtime-preservation incident remains unresolved.

## Root cause and tooling evidence

The original workspace file was syntactically valid YAML, but its build decision
was a string, not a boolean:

```yaml
allowBuilds:
  unrs-resolver: set this to true or false
```

The cached pnpm 12.5.1 native executable's project-specific config read returned
that string with exit 0. Config retrieval alone therefore did not establish a
valid authorization policy. pnpm documents that unresolved build decisions can
be written as placeholders; `true` authorizes and `false` denies. Unreviewed
builds fail when strictDepBuilds is enabled. See
[build policy settings](https://pnpm.io/settings/build#allowbuilds).

`allowBuilds` was introduced in **pnpm 10.26.0**, then retained in pnpm 11 and 12;
an older pnpm that can read lockfile v9 is not sufficient evidence that it
understands this policy. See the
[10.26 release](https://pnpm.io/blog/releases/10.26) and
[10.x versioned setting](https://pnpm.io/10.x/settings#allowbuilds).

The repository had no packageManager, engines, Node version file, other package
manager lockfile or active GitHub workflow. README still instructed `npm install`
and `npx expo start`, conflicting with its pnpm lockfile/workspace policy. Existing
review reports recorded successful offline pnpm checks and Finding 4 identified
pnpm 12, but did **not** record the exact patch version. That historical evidence
alone cannot prove every earlier run's exact version.

Local evidence supplies a supported pin without choosing the latest release:

- Current Node: **22.23.2**. The pnpm command on PATH is a Corepack shim; its
  already-cached native distribution and `--version` identify **12.5.1**.
- Existing matching `node_modules/.modules.yaml` records
  `packageManager: pnpm@12.5.1` and `ignoredBuilds: [unrs-resolver@1.12.2]`.
- The borrowed installed dependencies match the original manifest and lockfile.
  This turn's actual successful offline checks used those tools and dependencies.
- Installed React Native 0.86.3 declares Node
  `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0`; Supabase JS 2.116.0 declares
  `>=22.0.0`. Node 22.23.2 satisfies both. It is the adopted validated project/CI
  baseline, not a claim that it is the mathematical minimum for the full graph
  or that all other Node versions are unsupported.

## Why the decision is false

The lockfile and installed source show the tooling path:
`eslint-config-expo → eslint-import-resolver-typescript@3.10.1 →
unrs-resolver@1.12.2`. The package is used by import resolution during linting;
it is not a newly approved mobile native module.

Installed `unrs-resolver/package.json` has
`postinstall: node postinstall.js`; that file calls
`napi-postinstall.checkAndPreparePackage(packageJson, true)`.
The pinned napi-postinstall 0.3.7 source first looks for a prebuilt binding. If it
is missing, it can invoke **npm install**, download a tarball directly and write
binding files. No such script or fallback installer was run here.

The package's normal loader can load a locked optional platform binding directly.
The present Linux x64/glibc binding is
`@unrs/resolver-binding-linux-x64-gnu@1.12.2`, containing
`resolver.linux-x64-gnu.node` and no installation script. It matches the lockfile
and loader version. A direct binary smoke check instantiated ResolverFactory and
resolved `./src/lib/repair-states` to the project's TypeScript file. Existing lint
also passed through the actual tooling graph. The dependency metadata and prior
reports corroborate that the postinstall remained ignored.

An installed-package source scan found unrs-resolver as the only present package
with preinstall/install/postinstall or binding.gyp. This is evidence for this
installed platform, not an audit of packages skipped on other platforms.

Consequently **false** records the existing no-build behavior and avoids an
unnecessary fallback installer. It does not disable the prebuilt native module.
Keep locked optional dependencies enabled; a missing or broken platform binding
must fail and receive investigation, not silently enable the installer. Neither
package presence nor this decision is a general claim that executing its script
would be safe. Clean installation and other platforms still need validation.

## Exact changes and reproducibility contract

| File | Change |
| --- | --- |
| `pnpm-workspace.yaml` | Explicit `unrs-resolver: false`, strict unreviewed-build failure, no implicit application dependency repair, and the tool-pin compatibility setting explained below |
| `package.json` | Add `packageManager: pnpm@12.5.1` and read-only `check:config` script; dependency declarations and existing scripts unchanged |
| `.node-version` | Record validated Node 22.23.2 baseline |
| `scripts/check-pnpm-config.cjs` | Dependency-free read-only check of tools, YAML/policy and lockfile format |
| `scripts/check-resolver-binding.cjs` | Linux x64/glibc prebuilt-binding smoke check with no fallback installer |
| `README.md` | Replace npm template instructions with the pnpm contract, future frozen install and existing-dependency offline checks |
| `proposals/ROS-03C-offline-ci.yml` in this review directory | Separate, inactive CI proposal; no active workflow added |
| This report | Evidence, validation and remaining limits |

The existing application lockfile remains byte-identical, including resolutions
and integrity hashes. Its SHA-256 is
`41b430ef700890b4a3d0be997cfb67a710eb63ec49090f11f55c757529a73aa9`.
It declares lockfileVersion 9.0. The installed metadata and
[pnpm's own 12.5.1 source lockfile](https://raw.githubusercontent.com/pnpm/pnpm/v12.5.1/pnpm-lock.yaml)
support format compatibility; a fresh frozen application installation was not
executed and is not claimed to have passed.

`verifyDepsBeforeRun: error` prevents pnpm's default implicit install/repair before
run/exec, a behavior encountered in Finding 4. The documented setting supports
error instead of automatic installation; see
[dependency verification](https://pnpm.io/settings/build#verifydepsbeforerun).
Temporary validation copies explicitly disable that verification only after
matching the installed dependency graph, as in previous findings.

### pnpm 12 tool-pin interaction

Adding the otherwise appropriate packageManager pin exposed a pnpm 12 behavior:
ordinary commands can resolve/record `packageManagerDependencies` in the
application lockfile. With pmOnFail set to error, even the cached 12.5.1 native
executable's project config read attempted tool-pin resolution and failed offline
with ERR_PNPM_BAD_CONFIG_DEP because its package mirror metadata was absent.
No online retry, installation or lockfile regeneration was performed.

The installed 12.5.1 CHANGELOG explicitly describes tool-pin recording by every
command and the pmOnFail=ignore opt-out. The repository therefore records
**pmOnFail: ignore**. This disables pnpm's own version switching/resolution and
tool-pin lockfile writes, while **Corepack still reads packageManager**. The
configuration checker independently requires exact running pnpm 12.5.1 and Node
22.23.2. CI provisions them explicitly and checks before installing. This avoids
an unreviewed package-manager resolution/integrity addition to the lockfile;
see [pmOnFail semantics](https://pnpm.io/settings/cli#pmonfail).

This is a deliberate tradeoff: direct invocation of a wrong pnpm without the
checker is not blocked by pmOnFail. Use Corepack or explicitly provisioned tools
and run the checker before validation/installation. No latest-version download,
second package manager or automatic tool upgrade is part of the contract.

## Read-only validation and CI proposal

The config checker uses only Node built-ins and an already-provisioned pnpm. It
delegates YAML parsing to narrow `config get --location=project --json` reads,
using offline mode and pmOnFail=ignore to suppress tool resolution. It checks
actual boolean values and the sole false entry, rejects extra approvals and
alternative build policy keys, verifies strictDepBuilds/no implicit repair, and
requires the known lockfile format/tool pins. Corepack network and auto-pinning
are disabled in subprocesses. No global config dump, approval, run/exec, install
or package dependency is involved. See the documented
[config get operation](https://pnpm.io/cli/config#get-key).

The native CLI can silently omit settings it does not know, so reading a missing
key is insufficient. The checker also restricts the small workspace file's shape
to its reviewed keys, rejecting unknown policy keys, YAML indirection and legacy
alternatives. This strictness is intentional; expanding the workspace file
requires reviewing the checker. It checks repository configuration, not a hostile
global environment or an arbitrarily replaced pnpm executable.

No existing CI configuration was found. The proposed YAML remains under
`docs/events/ros-03c-review/proposals/`, outside `.github/workflows/`. It is not
active and was not executed. When separately approved and activated, it would
provision exact Node/pnpm, check policy before a frozen install, reject install
changes to reviewed files, check the prebuilt resolver, typecheck, lint and run
the three existing offline client suites. It requests read-only repository
permissions and no secrets, databases, deployments or Supabase lifecycle actions.
The proposal uses reviewed action families with major tags; resolve/review
immutable action commit pins before activation. Node/pnpm versions are already
exact. See [pnpm action setup inputs](https://github.com/pnpm/action-setup/tree/v4).

The future approved `pnpm install --frozen-lockfile` keeps optional dependencies.
It uses the explicit denial and strict unreviewed-build policy, rather than
approving everything or suppressing build-policy failures. New build needs must
fail and be reviewed individually. A first clean CI rehearsal remains necessary;
the proposal is not evidence that a frozen installation succeeds.

## Actual offline results

Validation ran in `/tmp/ros03c-f12-stage`, a copy of the designated worktree with
the prepared changes, a symlink to already-installed matching dependencies and
the standard ignored Expo types reference. No dependencies or generated files
were added to the original feature checkout or named worktree.

| Actual check | Result |
| --- | --- |
| Node/native pnpm version | 22.23.2 / 12.5.1, read from running tools and corroborated by cached metadata |
| Config checker with native binary and normal Corepack entry point | Exit 0; genuine boolean false and expected tool/policy checks passed |
| Configuration fixtures | **11 passed**: valid fixture accepted; ten invalid configurations rejected; every fixture file hash unchanged |
| Independent YAML parser | Workspace and CI proposal parsed with existing yaml module, duplicate-key checking enabled |
| Native prebuilt resolver smoke check | Exit 0, TypeScript module resolved without postinstall initialization |
| Three existing client suites | **221 passed, 0 failed**, exit 0 |
| TypeScript | Exit 0, no diagnostics |
| Expo lint | Exit 0, no diagnostics, including final checker changes |
| Scope/integrity | All dependency/devDependency declarations, existing scripts, lockfile, 28 migrations, application source and existing tests unchanged |
| Git/patch whitespace | No errors; full patch applicability and reverse applicability checked |

Fixture coverage includes the original placeholder, quoted false, numeric policy,
unjustified true, extra approval, invalid/duplicate YAML, implicit repair,
dangerouslyAllowAllBuilds and an alternative permissions policy. A first fixture
run exposed pnpm's omission of that unknown permissions key; adding the explicit
workspace-shape check resolved it, and all 11 final cases passed. Initial checker
development also handled the native CLI's JSON null for unset project keys. No
final implementation assertion remains failing.

Commands actually run successfully in the validation copy:

```sh
node scripts/check-pnpm-config.cjs
node scripts/check-resolver-binding.cjs
node --test --experimental-test-isolation=none --test-reporter=spec tests/repair-states.test.cjs tests/event-deletion.test.cjs tests/onboarding-account-isolation.test.cjs
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec tsc --noEmit
COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_AUTO_PIN=0 EXPO_NO_TELEMETRY=1 CI=1 pnpm --config.verify-deps-before-run=false --config.ignore-scripts=true --offline exec expo lint --no-cache
```

Logs: `/tmp/finding12-config.log`, `/tmp/finding12-resolver.log`,
`/tmp/finding12-config-fixtures.log`, `/tmp/finding12-client-tests.log`,
`/tmp/finding12-typecheck.log` and `/tmp/finding12-lint.log`.
The offline fixture driver is `/tmp/finding12-config-fixtures.py`. Neither
validator nor fixture execution ran an install/build script. The initial
tool-pin metadata failure above remained offline and left the lockfile unchanged.

## Complete diff and remaining checks

The complete eight-file implementation diff is
`/tmp/ros03c-finding12-implementation.patch`. All changes remain unstaged and
uncommitted for independent review; the CI proposal is separately reviewable.
No dependency graph, Expo/React Native version, SQL or privacy behavior changed.

Fresh frozen installation, hosted CI execution, clean cache/tool bootstrap and
other CPU/OS/libc combinations remain unexecuted. The installed native binary is
existing local evidence, not proof that every fresh environment will supply it.
Do not omit optional packages or enable its fallback installer to hide a failure.
The Linux smoke check deliberately fails on other platforms; add appropriate
platform validation rather than claiming cross-platform installation coverage.
Windows wrapper invocation may require PNPM_CONFIG_CHECK_BIN pointing to the
pre-provisioned native executable. External configuration overrides and mutable
action tags need controlled CI review. Native app/EAS builds, database acceptance
and Finding 5 incident resolution remain outside these offline results. No merge
or deployment readiness is implied.
