import { supabase } from "@/lib/supabase";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type UserIdentityContextType = {
  userId: string | null;
  displayName: string | null;
  greetingName: string;
  coupleId: string | null;
  partnerConnected: boolean;
  partnerName: string | null;
  partnerRef: string;
  isLoading: boolean;
  refreshIdentity: () => Promise<void>;
};

const defaultIdentity: UserIdentityContextType = {
  userId: null,
  displayName: null,
  greetingName: "there",
  coupleId: null,
  partnerConnected: false,
  partnerName: null,
  partnerRef: "your partner",
  isLoading: true,
  refreshIdentity: async () => {},
};

const UserIdentityContext = createContext<UserIdentityContextType>(defaultIdentity);

export function UserIdentityProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState<boolean>(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchIdentity = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setUserId(null);
        setDisplayName(null);
        setCoupleId(null);
        setPartnerConnected(false);
        setPartnerName(null);
        return;
      }

      setUserId(user.id);

      // 1. Current user display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const cleanDisplayName = profile?.display_name?.trim() || null;
      setDisplayName(cleanDisplayName);

      // 2. Couple membership
      const { data: membership, error: membershipError } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        setCoupleId(null);
        setPartnerConnected(false);
        setPartnerName(null);
        return;
      }

      const activeCoupleId = membership.couple_id;
      setCoupleId(activeCoupleId);

      // 3. Check for partner in couple
      const { data: members, error: membersError } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", activeCoupleId);

      if (membersError || !members) {
        setPartnerConnected(false);
        setPartnerName(null);
        return;
      }

      const partnerMember = members.find((m) => m.user_id !== user.id);

      if (partnerMember) {
        setPartnerConnected(true);
        const { data: partnerDisplayName } = await supabase.rpc(
          "get_partner_display_name",
        );

        if (
          typeof partnerDisplayName === "string" &&
          partnerDisplayName.trim().length > 0
        ) {
          setPartnerName(partnerDisplayName.trim());
        } else {
          setPartnerName(null);
        }
      } else {
        setPartnerConnected(false);
        setPartnerName(null);
      }
    } catch (err) {
      console.error("Failed to load user identity:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIdentity();

    // Listen for auth state changes to reload identity if session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void fetchIdentity();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchIdentity]);

  const greetingName = displayName || "there";
  const partnerRef = partnerName || "your partner";

  return (
    <UserIdentityContext.Provider
      value={{
        userId,
        displayName,
        greetingName,
        coupleId,
        partnerConnected,
        partnerName,
        partnerRef,
        isLoading,
        refreshIdentity: fetchIdentity,
      }}
    >
      {children}
    </UserIdentityContext.Provider>
  );
}

export function useUserIdentity(): UserIdentityContextType {
  return useContext(UserIdentityContext);
}
