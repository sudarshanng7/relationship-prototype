This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Relationship OS — Project-specific instructions

This repository implements Relationship OS, an early-stage
product for couples already in a relationship.

Product thesis:
Help couples understand how their particular relationship works,
rather than providing generic relationship advice.

Core lifecycle:
Meaningful moment -> Context -> Intent -> Conversation ->
Two perspectives -> Repair -> Learning.

Product guardrails:

- Each partner owns their own experience.
- Never treat one partner's report as joint truth.
- Never infer mutual repair from one partner's status.
- Private data must not leak through UI, RPCs, RLS,
  summaries or analytics.
- Mine and Ours have distinct visibility rules.
- Sharing must be explicit, not automatic.
- No relationship-health scores or conflict gamification.
- Do not introduce diagnosis or therapist-like authority.
- Preserve useful functionality when only one partner participates.

Engineering rules:

- Read the relevant product and engineering context before
  making architectural or privacy-related changes.
- Preserve existing RLS, RPC and trigger protections.
- Never replace tested SQL authorization with UI-only checks.
- Do not silently change approved product behavior.
- Prefer small, reviewable changes.
- Distinguish confirmed decisions from hypotheses.
- Do not merge TestBranch wholesale.
- Do not run destructive migrations, database resets or
  hosted Supabase operations without explicit approval.
- Do not push or merge to main without explicit approval.
- Never commit environment secrets, tokens or private user data.
- Run pnpm exec tsc --noEmit, pnpm exec expo lint,
  and git diff --check after code changes.

For ROS-03C changes, read the current engineering handoff
and the relevant docs/events/ros-03c-review documents.
