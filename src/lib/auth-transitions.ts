import { supabase } from "@/lib/supabase";

let pending: Promise<unknown> = Promise.resolve();

/** Serialize app sign-in/sign-up/logout, including across same-origin tabs.
 * Token refresh and read APIs remain outside this queue. Auth callbacks must
 * stay synchronous and must never start a queued transition themselves.
 */
function transition<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(() => {
    const locks = globalThis.navigator?.locks;
    return locks
      ? locks.request("relationship-os:auth-transition", action)
      : action();
  });
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export function signInWithPassword(
  credentials: Parameters<typeof supabase.auth.signInWithPassword>[0],
) {
  return transition(() => supabase.auth.signInWithPassword(credentials));
}

export function signUp(credentials: Parameters<typeof supabase.auth.signUp>[0]) {
  return transition(() => supabase.auth.signUp(credentials));
}

export function signOutAccount(userId: string, isCurrent: () => boolean) {
  return transition(async () => {
    if (!isCurrent()) return null;
    const { data, error } = await supabase.auth.getSession();
    if (!isCurrent()) return null;
    if (error || data.session?.user.id !== userId) {
      throw new Error("Your session changed. Reopen your profile.");
    }
    const { data: auth, error: authError } = await supabase.auth.getUser(data.session.access_token);
    if (!isCurrent()) return null;
    if (authError || auth.user?.id !== userId) {
      throw new Error("Please sign in again.");
    }
    // No app login can replace this session until the SDK has removed it.
    // SDK signOut snapshots this user's token for its local-scope revocation.
    return supabase.auth.signOut({ scope: "local" });
  });
}
