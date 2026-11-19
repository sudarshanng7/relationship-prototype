import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { getLocalSupabaseConfig } from "./local-supabase-target";

// Keep these direct environment references so Expo can inline the explicit
// profile. Validate before creating a client or loading any persisted session.
const { supabaseUrl, supabasePublishableKey } = getLocalSupabaseConfig(
  process.env.EXPO_PUBLIC_APP_ENV,
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
