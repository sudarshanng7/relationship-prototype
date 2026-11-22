# Purple Garden — Push Notifications Deployment Checklist & Architecture

This document describes the configuration, operational requirements, and security guarantees for remote push notifications in Purple Garden.

---

## 1. Architecture Overview

Purple Garden implements **opt-in, privacy-preserving push notifications** for shared moments:
- **Client Side**: Uses `expo-notifications` to register for standard Expo push tokens (`ExponentPushToken[...]`), passing EAS project ID `6fe9f272-713b-46f1-957d-51f6bb0fd0f7`.
- **Database Storage**:
  - `public.user_notification_preferences`: stores opt-in consent (`notify_on_partner_shared_moment BOOLEAN DEFAULT false`).
  - `public.user_device_push_tokens`: stores device tokens with a global `UNIQUE (expo_push_token)` constraint and atomic registration RPC (`register_device_push_token`) to prevent token multi-tenant leaks.
  - `public.shared_moment_notification_deliveries`: guarantees delivery idempotency (`UNIQUE (event_id, recipient_id)`) across network retries or double taps.
- **Backend Edge Function**: `supabase/functions/send-shared-moment-notification` handles authorized event dispatch:
  1. Verifies caller JWT and confirms caller is the creator of the moment.
  2. Confirms moment visibility is strictly `'ours'`.
  3. Checks `shared_moment_notification_deliveries` for prior dispatch (idempotency).
  4. Verifies partner has explicitly enabled `notify_on_partner_shared_moment = true`.
  5. Retrieves partner's active push tokens.
  6. Dispatches generic push payload through the Expo Push API with error status verification (`response.ok`).
  7. Supports optional `EXPO_ACCESS_TOKEN` bearer authorization.
  8. Prunes dead device tokens if Expo returns `DeviceNotRegistered`.

---

## 2. Privacy & Emotional Safety Guarantees

In accordance with Purple Garden's core values:
- **Zero Content Leakage**: Push notification text NEVER includes categories, custom category labels, private reflections, notes, emotions, intensity, topic, or relationship context.
- **Strictly Generic Visible Content**:
  - Title: `"Purple Garden"`
  - Body: `"[Partner name] shared a moment with you."` (or fallback `"Your partner shared a moment with you."`)
  - Data: strictly `{ eventId: "<id>" }`
- **Zero Pressure**: Notification payload contains no badge counts, urgency flags, or alarm sounds.
- **Dedicated Android Icon**: Configured with dedicated monochrome icon (`./assets/images/android-icon-monochrome.png`) in `app.json`.

---

## 3. Remote Push Prerequisites (Why Expo Go Cannot Test Remote Push)

1. **Expo Go Limitations**:
   - Starting with modern Expo SDK releases (SDK 51+ and SDK 57), Expo Go cannot receive native push notifications directly associated with custom project credentials.
   - Android requires Google Firebase Cloud Messaging (FCM v1) credentials linked to the package name (`com.purplegarden.alpha`).
   - iOS requires Apple Push Notification service (APNs) credentials linked to the bundle identifier (`com.purplegarden.alpha`).
   - Testing remote push requires an EAS Development Build (`pnpm dlx eas-cli build --profile development`) or an internal preview APK (`pnpm dlx eas-cli build --profile preview`).

---

## 4. EAS & Platform Credentials Checklist

### A. EAS Project Configuration
- [ ] Connect repository to EAS project via `pnpm dlx eas-cli project:init` (or ensure `extra.eas.projectId` is set in `app.json`).
- [ ] Ensure `expo-notifications` plugin is configured in `app.json` with dedicated monochrome icon (`./assets/images/android-icon-monochrome.png`) and accent color (`#6B4C82`).

### B. Android FCM v1 Setup
- [ ] In Google Firebase Console, create or select the Purple Garden project.
- [ ] Register Android app with package name `com.purplegarden.alpha`.
- [ ] Generate private key JSON for the Firebase Service Account (FCM v1).
- [ ] Upload the service account key to EAS:
  ```bash
  pnpm dlx eas-cli credentials
  # Select Android -> Manage FCM Credentials -> Upload Service Account Key
  ```

### C. iOS APNs Setup
- [ ] In Apple Developer Portal, create an APNs Authentication Key (.p8).
- [ ] Record Key ID and Team ID.
- [ ] Upload the APNs key to EAS:
  ```bash
  pnpm dlx eas-cli credentials
  # Select iOS -> Push Notifications -> Set up Apple Push Notification service
  ```

### D. Supabase Edge Function Deployment & EXPO_ACCESS_TOKEN
- [ ] If Enhanced Push Security is enabled on your Expo account, set the `EXPO_ACCESS_TOKEN` secret:
  ```bash
  pnpm exec supabase secrets set EXPO_ACCESS_TOKEN="<expo-access-token>" --project-ref taxxvpkgzyevrhbytlqi
  ```
- [ ] Deploy the notification dispatch function:
  ```bash
  pnpm exec supabase functions deploy send-shared-moment-notification --project-ref taxxvpkgzyevrhbytlqi
  ```
- [ ] Note: The Edge Function inspects `Deno.env.get("EXPO_ACCESS_TOKEN")` and attaches `Authorization: Bearer ${expoAccessToken}` if present, ensuring complete compatibility with Expo's authenticated Push API.

---

## 5. Local Development & Verification
- For local unit testing and continuous integration, verify edge function logic, database constraints, and RLS policies using:
  ```bash
  pnpm exec supabase test db
  node --experimental-strip-types scripts/test-notifications.mjs
  ```
