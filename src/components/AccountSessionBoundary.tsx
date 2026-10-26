import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useFocusEffect, useRouter } from "expo-router";
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState, type ReactNode,
} from "react";
import { Button, Text, View } from "react-native";

type Identity = { userId: string | null; generation: number };
type Visit = { routeKey: string; generation: number };

export type AuthorizedIdentity = { user: User; token: string };
export type AccountSessionScope = {
  userId: string;
  isCurrent: () => boolean;
  authorize: (committedNotice?: string) => Promise<AuthorizedIdentity | null>;
};

const ScopeContext = createContext<AccountSessionScope | null>(null);

export function useAccountSessionScope() {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error("AccountSessionBoundary is required");
  return scope;
}

/** Screen-local isolation, not a cache of profile data or an authorization policy. */
export function AccountSessionBoundary({ routeKey, children }: {
  routeKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const account = useRef<Identity | null>(null);
  const visit = useRef<Visit | null>(null);
  const accountGeneration = useRef(0);
  const visitGeneration = useRef(0);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [currentVisit, setCurrentVisit] = useState<Visit | null>(null);
  const blocked = useRef(false);
  const retryRequest = useRef<object | null>(null);
  const [verification, setVerification] = useState<{
    phase: "failed" | "checking"; visit: Visit | null; notice?: string;
  } | null>(null);

  // Invalidate before passive cleanup can let an old promise continue.
  useLayoutEffect(() => () => {
    account.current = null;
    visit.current = null;
  }, []);

  useLayoutEffect(() => () => {
    visit.current = null;
  }, [routeKey]);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const userId = session?.user.id ?? null;
      if (account.current?.userId === userId && event !== "SIGNED_OUT") return;
      const next = { userId, generation: ++accountGeneration.current };
      account.current = next;
      blocked.current = false;
      retryRequest.current = null;
      setVerification(null);
      setIdentity(next);
      // Same-account token refreshes/repeated SIGNED_IN events keep drafts.
      // No asynchronous Supabase calls run inside the auth callback.
      if (!userId) router.replace("/");
    });
    return () => {
      active = false;
      account.current = null;
      data.subscription.unsubscribe();
    };
  }, [router]);

  useFocusEffect(useCallback(() => {
    retryRequest.current = null;
    const next = { routeKey, generation: ++visitGeneration.current };
    if (blocked.current) setVerification({ phase: "failed", visit: next });
    visit.current = next;
    setCurrentVisit(next);
    return () => {
      visit.current = null;
      setCurrentVisit(null);
    };
  }, [routeKey]));

  const { scope, retry } = useMemo(() => {
    const matches = () => identity !== null && currentVisit !== null &&
      account.current === identity && visit.current === currentVisit &&
      currentVisit.routeKey === routeKey;
    const isCurrent = () => matches() && !blocked.current;
    const invalidate = () => {
      if (!matches()) return;
      account.current = null;
      setIdentity(null);
      setVerification(null);
      router.replace("/");
    };
    const suspend = (notice?: string) => {
      if (!matches()) return;
      blocked.current = true;
      // A new generation prevents any old operation from reviving after retry.
      const next = { userId: identity!.userId, generation: ++accountGeneration.current };
      account.current = next;
      setIdentity(next);
      setVerification((previous) => ({
        phase: "failed", visit: currentVisit,
        notice: notice || (previous?.visit === currentVisit ? previous.notice : undefined),
      }));
    };
    const verify = async (allowBlocked = false, notice?: string): Promise<AuthorizedIdentity | null> => {
      const valid = () => matches() && (allowBlocked || !blocked.current);
      if (!valid()) return null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!valid()) return null;
        if (error) { suspend(notice); return null; }
        const session = data.session;
        if (!session || session.user.id !== identity?.userId) {
          invalidate();
          return null;
        }
        const { data: auth, error: authError } = await supabase.auth.getUser(
          session.access_token,
        );
        if (!valid()) return null;
        // A failed token/network check does not prove the account signed out.
        if (authError || !auth.user) { suspend(notice); return null; }
        if (auth.user.id !== identity?.userId) {
          invalidate();
          return null;
        }
        return { user: auth.user, token: session.access_token };
      } catch {
        if (valid()) suspend(notice);
        return null;
      }
    };
    const scope: AccountSessionScope = {
      userId: identity?.userId ?? "",
      isCurrent,
      authorize: (notice) => verify(false, notice),
    };
    return {
      scope,
      retry: async () => {
        if (!matches() || !blocked.current || retryRequest.current) return;
        const request = {};
        retryRequest.current = request;
        setVerification((previous) => ({
          phase: "checking", visit: currentVisit,
          notice: previous?.visit === currentVisit ? previous.notice : undefined,
        }));
        try {
          const auth = await verify(true);
          if (auth && matches()) {
            blocked.current = false;
            setVerification(null);
          }
        } finally {
          if (retryRequest.current === request) retryRequest.current = null;
        }
      },
    };
  }, [currentVisit, identity, routeKey, router]);

  if (!identity?.userId || !currentVisit || currentVisit.routeKey !== routeKey) {
    return <View><Text>Loading...</Text></View>;
  }

  if (verification) {
    return (
      <View>
        {verification.visit === currentVisit && verification.notice && <Text>{verification.notice}</Text>}
        <Text>Could not verify your session. Private data has been cleared. Retry to continue.</Text>
        <Text>Completed changes are kept. Retry only reloads this screen.</Text>
        <Button title="Retry" onPress={() => { void retry(); }} disabled={verification.phase === "checking"} />
      </View>
    );
  }

  return (
    <View key={`${identity.generation}:${identity.userId}:${currentVisit.generation}:${routeKey}`} style={{ flex: 1 }}>
      <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>
    </View>
  );
}
