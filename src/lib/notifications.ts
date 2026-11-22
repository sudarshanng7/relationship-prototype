import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

// Configure how notifications should behave when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreference {
  notify_on_partner_shared_moment: boolean;
}

export interface PushRegistrationResult {
  success: boolean;
  token: string | null;
  error?: string;
}

/**
 * Gets the configured EAS project ID from app configuration.
 */
export function getEasProjectId(): string {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    "6fe9f272-713b-46f1-957d-51f6bb0fd0f7"
  );
}

/**
 * Registers device for Expo Push Notifications and saves token to user_device_push_tokens via safe RPC.
 * Surfaces specific reasons if registration is unsupported or denied.
 */
export async function registerForPushNotificationsAsync(
  supabase: SupabaseClient,
  userId: string,
): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return {
      success: false,
      token: null,
      error: "Push notifications are not supported on the web.",
    };
  }

  if (!Device.isDevice) {
    return {
      success: false,
      token: null,
      error: "Push notifications require a physical Android or iOS device.",
    };
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return {
        success: false,
        token: null,
        error: "Notification permission was denied. Please allow notifications in device settings.",
      };
    }

    // Android notification channel setup with dedicated styling
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6B4C82",
      });
    }

    const projectId = getEasProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;

    if (!token) {
      return {
        success: false,
        token: null,
        error: "Failed to generate push token from device.",
      };
    }

    const platformName = Platform.OS === "android" ? "android" : "ios";

    // Atomically transfer and register token to current user via SECURITY DEFINER RPC
    const { error: rpcError } = await supabase.rpc("register_device_push_token", {
      p_token: token,
      p_platform: platformName,
    });

    if (rpcError) {
      return {
        success: false,
        token: null,
        error: `Database registration error: ${rpcError.message}`,
      };
    }

    return {
      success: true,
      token,
    };
  } catch (err: any) {
    return {
      success: false,
      token: null,
      error: err?.message || "An unexpected error occurred while registering notifications.",
    };
  }
}

/**
 * Removes the device's push token from Supabase upon opt-out or sign-out.
 */
export async function unregisterDevicePushTokenAsync(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === "web") {
    return { success: true };
  }

  try {
    const projectId = getEasProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    ).catch(() => null);

    if (tokenData?.data) {
      const { error: rpcError } = await supabase.rpc("unregister_device_push_token", {
        p_token: tokenData.data,
      });

      if (rpcError) {
        return { success: false, error: rpcError.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to unregister push token." };
  }
}

/**
 * Fetches user notification preference. Defaults to false (opt-in).
 */
export async function fetchNotificationPreference(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("notify_on_partner_shared_moment")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return false;
    return Boolean(data.notify_on_partner_shared_moment);
  } catch {
    return false;
  }
}

/**
 * Updates user notification preference.
 */
export async function updateNotificationPreference(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: userId,
          notify_on_partner_shared_moment: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Calls server-side Edge Function to trigger a partner notification for a shared moment.
 * Strictly non-blocking.
 */
export async function triggerSharedMomentNotification(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  if (!eventId) return;
  try {
    await supabase.functions.invoke("send-shared-moment-notification", {
      body: { eventId },
    });
  } catch {
    // Non-blocking: background notification failure never interrupts the UI
  }
}
