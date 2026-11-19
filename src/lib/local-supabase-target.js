/**
 * Shared by the Expo client and local launcher; no SDK import or network calls.
 * Only an explicitly selected local target is enabled at this stage.
 *
 * @param {unknown} profile
 * @param {unknown} supabaseUrl
 * @param {unknown} publishableKey
 * @returns {{ supabaseUrl: string, supabasePublishableKey: string }}
 */
function getLocalSupabaseConfig(profile, supabaseUrl, publishableKey) {
  if (profile !== "local") {
    throw new Error("Supabase is disabled without the explicit local development profile.");
  }

  let url;
  try {
    if (typeof supabaseUrl !== "string" || supabaseUrl !== supabaseUrl.trim()) {
      throw new Error();
    }
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("Configure an explicit local Supabase URL before starting Expo.");
  }

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.port || Number(url.port) < 1024 ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/"
  ) {
    throw new Error("Local Supabase must use an HTTP loopback origin with an explicit port; hosted targets are disabled.");
  }

  if (typeof publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error("Configure the local instance's sb_publishable_ client key; secret and service-role keys are not accepted.");
  }

  return { supabaseUrl: url.origin, supabasePublishableKey: publishableKey };
}

module.exports = { getLocalSupabaseConfig };
