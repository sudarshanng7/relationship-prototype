import { tokens } from "@/components/couply-tokens";
import { AppBottomNav } from "@/components/AppBottomNav";
import {
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import {
  deriveWhatMattersNowActivity,
  markHomeActivitySeen,
  type HomeActivityCandidate,
  type HomeActivityReceipt,
  type HomeRelationshipEvent,
  type HomeRepairResponse,
  type HomeRepairOutcome,
  type HomeCoupleTask,
  type HomeImportantDate,
  type HomeAttentionState,
  TWENTY_FOUR_HOURS_MS,
} from "@/lib/home-activity";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AppState,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export type ThemeKey =
  | "lilac_morning"
  | "violet_garden"
  | "plum_evening"
  | "lavender"
  | "sunrise"
  | "sage";

export interface ThemeConfig {
  key: ThemeKey;
  name: string;
  description: string;
  paletteCircles: string[];
  background: string;
  surface: string;
  surfaceBorder: string;
  privateSurface: string;
  privateBorder: string;
  privateText: string;
  sharedSurface: string;
  sharedBorder: string;
  sharedText: string;
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  border: string;
  selectedNavigation: string;
  iconMuted: string;
  badgeBackground: string;
  badgeDot: string;
  avatarCircle: string;
  avatarBorder: string;
  savedBoxBg: string;
  savedBoxBorder: string;
  buttonSecondaryBg: string;
  buttonSecondaryBorder: string;
}

const lilacMorningTheme: ThemeConfig = {
  key: "lilac_morning",
  name: "Lilac Morning",
  description: "Light, clear, and gently welcoming.",
  paletteCircles: ["#FAF7FA", "#F2EDF7", "#6E416D"],
  background: "#FAF7FA",
  surface: "#FFFFFF",
  surfaceBorder: "#E8DCE9",
  privateSurface: "#F2EDF7",
  privateBorder: "#E2D3E4",
  privateText: "#453448",
  sharedSurface: "#FAF0F7",
  sharedBorder: "#EBD7E8",
  sharedText: "#683462",
  primaryText: "#362739",
  secondaryText: "#66566B",
  mutedText: "#8B7C90",
  accent: "#6E416D",
  accentPressed: "#583257",
  accentText: "#FFFFFF",
  border: "#E8DCE9",
  selectedNavigation: "#EFE4F1",
  iconMuted: "#7B6A80",
  badgeBackground: "#F3EBF5",
  badgeDot: "#6E416D",
  avatarCircle: "#F1DDF0",
  avatarBorder: "#DFBFDE",
  savedBoxBg: "#F8EFF8",
  savedBoxBorder: "#E6D6E8",
  buttonSecondaryBg: "#F5EEF6",
  buttonSecondaryBorder: "#E5D7E6",
};

const violetGardenTheme: ThemeConfig = {
  key: "violet_garden",
  name: "Violet Garden",
  description: "The Purple Garden signature look.",
  paletteCircles: ["#F4EFF7", "#5E336A", "#42684E"],
  background: "#F4EFF7",
  surface: "#FAF7FC",
  surfaceBorder: "#DECDE3",
  privateSurface: "#ECE3F2",
  privateBorder: "#DAC9E0",
  privateText: "#3C2B42",
  sharedSurface: "#EAE4F2",
  sharedBorder: "#D8CDE2",
  sharedText: "#4B335A",
  primaryText: "#2D1F33",
  secondaryText: "#5D4D63",
  mutedText: "#837389",
  accent: "#5E336A",
  accentPressed: "#4A2554",
  accentText: "#FFFFFF",
  border: "#DECDE3",
  selectedNavigation: "#E8DCED",
  iconMuted: "#75647C",
  badgeBackground: "#EAF1EC",
  badgeDot: "#42684E",
  avatarCircle: "#EEDDEF",
  avatarBorder: "#DCBEE0",
  savedBoxBg: "#F2EBF5",
  savedBoxBorder: "#DCCFE0",
  buttonSecondaryBg: "#EFE6F3",
  buttonSecondaryBorder: "#DCCFE0",
};

const plumEveningTheme: ThemeConfig = {
  key: "plum_evening",
  name: "Plum Evening",
  description: "A quieter, lower-light way to reflect.",
  paletteCircles: ["#1E1523", "#2A1F31", "#985AA3"],
  background: "#1E1523",
  surface: "#2A1F31",
  surfaceBorder: "#493554",
  privateSurface: "#34253D",
  privateBorder: "#543C60",
  privateText: "#EDE5F2",
  sharedSurface: "#3A2744",
  sharedBorder: "#5C3E68",
  sharedText: "#EBD6F0",
  primaryText: "#F3EDF6",
  secondaryText: "#C5B6CC",
  mutedText: "#9A89A2",
  accent: "#985AA3",
  accentPressed: "#7E4488",
  accentText: "#FFFFFF",
  border: "#493554",
  selectedNavigation: "#3F2A4A",
  iconMuted: "#8E7D96",
  badgeBackground: "#3A2742",
  badgeDot: "#B775C5",
  avatarCircle: "#452E50",
  avatarBorder: "#654575",
  savedBoxBg: "#322339",
  savedBoxBorder: "#4E3858",
  buttonSecondaryBg: "#35253E",
  buttonSecondaryBorder: "#523B5E",
};

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  lilac_morning: lilacMorningTheme,
  violet_garden: violetGardenTheme,
  plum_evening: plumEveningTheme,
  // Backwards compatibility aliases
  lavender: violetGardenTheme,
  sunrise: lilacMorningTheme,
  sage: plumEveningTheme,
};

export const THEME_LIST: ThemeConfig[] = [
  THEMES.lilac_morning,
  THEMES.violet_garden,
  THEMES.plum_evening,
];

type PreviewState =
  | "calm_day"
  | "evening_reflection"
  | "open_repair"
  | "positive_moment"
  | "recently_resolved";

type ReflectionFeeling =
  | "special"
  | "regular"
  | "distant"
  | "annoyed"
  | "friction";

interface FeelingOption {
  key: ReflectionFeeling;
  label: string;
  symbol: string;
  accentColor: string;
  description: string;
}

const FEELING_OPTIONS: FeelingOption[] = [
  {
    key: "special",
    label: "Special",
    symbol: "✦",
    accentColor: "#6E416D",
    description: "Something felt warm or meaningful",
  },
  {
    key: "regular",
    label: "Regular",
    symbol: "☼",
    accentColor: "#564458",
    description: "It was an ordinary day",
  },
  {
    key: "distant",
    label: "Distant",
    symbol: "〰",
    accentColor: "#756777",
    description: "You felt a little apart",
  },
  {
    key: "annoyed",
    label: "Annoyed",
    symbol: "⏺",
    accentColor: "#9E6326",
    description: "Something small got under your skin",
  },
  {
    key: "friction",
    label: "Friction",
    symbol: "∿",
    accentColor: "#934762",
    description: "Something needs care",
  },
];

const PREVIEW_SCENARIOS: {
  key: PreviewState;
  label: string;
  description: string;
}[] = [
  {
    key: "calm_day",
    label: "Calm day",
    description: "Nothing needs your attention right now.",
  },
  {
    key: "evening_reflection",
    label: "Evening reflection",
    description: "Check-in prompt and feelings before day ends.",
  },
  {
    key: "open_repair",
    label: "Open shared moment",
    description: "One shared moment is waiting when ready.",
  },
  {
    key: "positive_moment",
    label: "Shared positive moment",
    description: "Your partner shared something good with you.",
  },
  {
    key: "recently_resolved",
    label: "Recently resolved moment",
    description: "A recent moment was marked reconnected.",
  },
];

function getDeviceGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }
  return "Welcome back";
}

export type { HomeRelationshipEvent, HomeActivityCandidate };

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    openReflection?: string | string[];
  }>();
  const mainScrollRef = useRef<ScrollView>(null);
  const reflectionCardY = useRef<number>(0);
  const [personalCoverUri, setPersonalCoverUri] = useState<string | null>(null);
  const identity = useUserIdentity();
  const { activeInvitation } = useChallengePreview();
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    identity.userId,
  );
  const [coupleId, setCoupleId] = useState<string | null>(identity.coupleId);
  const [relationshipEvents, setRelationshipEvents] = useState<
    HomeRelationshipEvent[]
  >([]);
  const [repairResponses, setRepairResponses] = useState<
    HomeRepairResponse[]
  >([]);
  const [repairOutcomes, setRepairOutcomes] = useState<HomeRepairOutcome[]>([]);
  const [coupleTasks, setCoupleTasks] = useState<HomeCoupleTask[]>([]);
  const [importantDates, setImportantDates] = useState<HomeImportantDate[]>([]);
  const [attentionStates, setAttentionStates] = useState<HomeAttentionState[]>(
    [],
  );
  const [activityReceipts, setActivityReceipts] = useState<
    HomeActivityReceipt[]
  >([]);
  const [optimisticSeenKeys, setOptimisticSeenKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const isNavigatingActivityRef = useRef<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const cleanDisplayName =
    (identity.displayName || displayName)?.trim() || null;
  const effectiveDisplayName = cleanDisplayName;
  const effectivePartnerName = identity.partnerName ?? partnerName;
  const effectivePartnerConnected =
    identity.partnerConnected || partnerConnected;
  const effectivePartnerRef =
    identity.partnerRef || effectivePartnerName || "your partner";

  const rhythmTitle =
    cleanDisplayName && cleanDisplayName.toLowerCase() !== "there"
      ? `${cleanDisplayName}’s Rhythm`
      : "My Rhythm";

  const hasPendingChallengePreview = Boolean(
    activeInvitation &&
      activeInvitation.status === "pending" &&
      (activeInvitation.participant === "partner" ||
        activeInvitation.participant === "both"),
  );

  const challengeRecipientHeading = useMemo(() => {
    if (!activeInvitation) return "";
    const creator = activeInvitation.creatorName?.trim();
    const isCurrentUser =
      !creator ||
      creator.toLowerCase() === "you" ||
      (effectiveDisplayName &&
        creator.toLowerCase() === effectiveDisplayName.trim().toLowerCase());
    if (isCurrentUser) {
      return "Your tiny invitation is ready to preview";
    }
    return `${creator} shared a tiny invitation`;
  }, [activeInvitation, effectiveDisplayName]);

  const screenInstanceIdRef = useRef<string>(
    `home_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
  );
  const subscriptionSeqRef = useRef<number>(0);
  const requestSeqRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const refreshPendingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef<boolean>(true);
  const hasLoadedOnceRef = useRef<boolean>(false);
  const lastRecordedResurfacedKeyRef = useRef<string | null>(null);
  const isScreenFocusedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshHomeData = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const silent = options.silent ?? false;
      if (!mountedRef.current) return false;

      // Prevent overlapping concurrent refreshes; queue exactly one follow-up if busy
      if (isRefreshingRef.current) {
        refreshPendingRef.current = true;
        return false;
      }

      isRefreshingRef.current = true;
      const currentRequestSeq = ++requestSeqRef.current;

      try {
        void identity.refreshIdentity();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!mountedRef.current) return false;

        if (userError || !user) {
          setIsIdentityLoading(false);
          return false;
        }

        setCurrentUserId(user.id);

        // 1. Fetch current user display_name and membership in parallel
        const [profileRes, memberRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("couple_members")
            .select("couple_id")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!mountedRef.current) return false;

        if (profileRes.data?.display_name?.trim()) {
          setDisplayName(profileRes.data.display_name.trim());
        }

        const activeCoupleId = memberRes.data?.couple_id;
        if (!activeCoupleId) {
          setPartnerConnected(false);
          setPartnerName(null);
          setCoupleId(null);
          setRelationshipEvents([]);
          setRepairResponses([]);
          setRepairOutcomes([]);
          setCoupleTasks([]);
          setImportantDates([]);
          setAttentionStates([]);
          setActivityReceipts([]);
          setOptimisticSeenKeys(new Set());
          setIsIdentityLoading(false);
          return false;
        }

        setCoupleId(activeCoupleId);

        // 2. Fetch partner details, 6 activity sources and private receipts in parallel
        const [
          partnerNameRes,
          membersRes,
          eventsRes,
          responsesRes,
          outcomesRes,
          tasksRes,
          datesRes,
          attRes,
          receiptsRes,
        ] = await Promise.all([
          supabase.rpc("get_partner_display_name"),
          supabase
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", activeCoupleId),
          supabase
            .from("relationship_events")
            .select(
              "id, creator_id, event_type, category, intensity, visibility, status, created_at, reconnected_at",
            )
            .eq("couple_id", activeCoupleId)
            .eq("visibility", "ours")
            .order("created_at", { ascending: false }),
          supabase
            .from("relationship_event_repair_responses")
            .select(
              "id, event_id, couple_id, user_id, phase, response_code, suggested_step_code, shared_at, updated_at",
            )
            .eq("couple_id", activeCoupleId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("relationship_event_repair_outcomes")
            .select(
              "event_id, couple_id, completed_by, takeaway_tag, takeaway_note, completed_at, updated_at",
            )
            .eq("couple_id", activeCoupleId),
          supabase
            .from("couple_tasks")
            .select(
              "id, couple_id, created_by, title, category, status, completed_at, created_at, updated_at",
            )
            .eq("couple_id", activeCoupleId)
            .order("created_at", { ascending: false }),
          supabase
            .from("couple_important_dates")
            .select(
              "id, couple_id, label, event_date, created_by, created_at, updated_at",
            )
            .eq("couple_id", activeCoupleId)
            .order("created_at", { ascending: false }),
          supabase
            .from("relationship_event_attention_states")
            .select(
              "event_id, couple_id, user_id, last_presented_at, snoozed_until, presentation_count, last_opened_at, created_at, updated_at",
            )
            .eq("couple_id", activeCoupleId),
          supabase
            .from("home_activity_receipts")
            .select(
              "id, couple_id, user_id, activity_key, activity_kind, source_id, attention_mode, seen_at, created_at, updated_at",
            )
            .eq("couple_id", activeCoupleId)
            .eq("user_id", user.id),
        ]);

        if (!mountedRef.current) return false;

        // Discard result if an even newer request already completed
        if (currentRequestSeq < requestSeqRef.current) {
          return false;
        }

        const partnerMember = membersRes.data?.find(
          (m) => m.user_id !== user.id,
        );
        setPartnerConnected(Boolean(partnerMember));
        if (
          typeof partnerNameRes.data === "string" &&
          partnerNameRes.data.trim().length > 0
        ) {
          setPartnerName(partnerNameRes.data.trim());
        }

        if (eventsRes.error && __DEV__) {
          console.warn(
            "Home relationship_events query failed:",
            eventsRes.error.message,
          );
        }

        if (!eventsRes.error && eventsRes.data) {
          const reconciledMap = new Map<string, HomeRelationshipEvent>();
          for (const row of eventsRes.data) {
            reconciledMap.set(row.id, row as HomeRelationshipEvent);
          }
          setRelationshipEvents(Array.from(reconciledMap.values()));
        }

        if (!responsesRes.error && responsesRes.data) {
          setRepairResponses(responsesRes.data as HomeRepairResponse[]);
        }

        if (!outcomesRes.error && outcomesRes.data) {
          setRepairOutcomes(outcomesRes.data as HomeRepairOutcome[]);
        }

        if (!tasksRes.error && tasksRes.data) {
          setCoupleTasks(tasksRes.data as HomeCoupleTask[]);
        }

        if (!datesRes.error && datesRes.data) {
          setImportantDates(datesRes.data as HomeImportantDate[]);
        }

        if (!attRes.error && attRes.data) {
          setAttentionStates(attRes.data as HomeAttentionState[]);
        }

        if (!receiptsRes.error && receiptsRes.data) {
          setActivityReceipts(receiptsRes.data as HomeActivityReceipt[]);
        }

        setNowMs(Date.now());
        return true;
      } catch (err) {
        if (__DEV__) {
          console.warn("refreshHomeData failed:", err);
        }
        return false;
      } finally {
        isRefreshingRef.current = false;
        if (mountedRef.current) {
          setIsIdentityLoading(false);
          hasLoadedOnceRef.current = true;
        }

        // If another update arrived while this refresh was running, queue follow-up
        if (refreshPendingRef.current && mountedRef.current) {
          refreshPendingRef.current = false;
          void refreshHomeDataRef.current({ silent: true });
        }
      }
    },
    [identity],
  );

  const refreshHomeDataRef = useRef(refreshHomeData);
  useEffect(() => {
    refreshHomeDataRef.current = refreshHomeData;
  }, [refreshHomeData]);

  // Focus fallback (silent refresh after initial load, no spinner flicker)
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      setNowMs(Date.now());
      void refreshHomeDataRef.current({ silent: hasLoadedOnceRef.current });
      return () => {
        isScreenFocusedRef.current = false;
        lastRecordedResurfacedKeyRef.current = null;
      };
    }, []),
  );

  // AppState active fallback (silent refresh when foregrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && mountedRef.current) {
        setNowMs(Date.now());
        void refreshHomeDataRef.current({ silent: true });
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const effectiveUserId = identity.userId ?? currentUserId;
  const effectiveCoupleId = identity.coupleId ?? coupleId;

  // Single stable screen-owned Realtime subscription scoped to active couple & authenticated user
  useEffect(() => {
    if (!effectiveCoupleId || !effectiveUserId) {
      return;
    }

    const subscriptionSeq = ++subscriptionSeqRef.current;
    const channelName = `home-activity-${effectiveCoupleId}-${screenInstanceIdRef.current}-${subscriptionSeq}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const scheduleSilentRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (mountedRef.current) {
          void refreshHomeDataRef.current({ silent: true });
        }
      }, 200);
    };

    // Synchronously register all listeners before subscribe()
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_events",
          filter: `couple_id=eq.${effectiveCoupleId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_event_repair_responses",
          filter: `couple_id=eq.${effectiveCoupleId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_event_repair_outcomes",
          filter: `couple_id=eq.${effectiveCoupleId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_tasks",
          filter: `couple_id=eq.${effectiveCoupleId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_important_dates",
          filter: `couple_id=eq.${effectiveCoupleId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_event_attention_states",
          filter: `user_id=eq.${effectiveUserId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "home_activity_receipts",
          filter: `user_id=eq.${effectiveUserId}`,
        },
        () => {
          scheduleSilentRefresh();
        },
      );

    channel.subscribe((subStatus, err) => {
      if (__DEV__) {
        if (subStatus === "SUBSCRIBED") {
          console.log(`[Home Realtime] Subscribed to ${channelName}`);
        } else if (
          subStatus === "CHANNEL_ERROR" ||
          subStatus === "TIMED_OUT" ||
          subStatus === "CLOSED"
        ) {
          console.warn(
            `[Home Realtime] Status: ${subStatus}`,
            err?.message || "",
          );
        }
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [effectiveCoupleId, effectiveUserId]);

  const [previewState, setPreviewState] =
    useState<PreviewState>("calm_day");
  const [selectedFeeling, setSelectedFeeling] =
    useState<ReflectionFeeling | null>(null);
  const [eveningClosureState, setEveningClosureState] = useState<
    "done" | "remind" | "skip" | null
  >(null);

  const rawOpenReflection = params.openReflection;
  const isOpenReflectionParam =
    rawOpenReflection === "true" ||
    (Array.isArray(rawOpenReflection) && rawOpenReflection[0] === "true");

  useEffect(() => {
    if (!isOpenReflectionParam) return;

    setPreviewState("evening_reflection");
    setEveningClosureState(null);
    setSelectedFeeling(null);

    // Consume the parameter cleanly
    router.setParams({ openReflection: undefined });

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, reflectionCardY.current - 16),
        animated: true,
      });
    });
  }, [isOpenReflectionParam]);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const greeting = getDeviceGreeting();

  const personalCoverSource = personalCoverUri
    ? { uri: personalCoverUri }
    : require("@/assets/images/shared-horizon.png");

  const isReflectionActive = previewState === "evening_reflection";

  const whatMattersNow = useMemo(
    () =>
      deriveWhatMattersNowActivity({
        events: relationshipEvents,
        repairResponses,
        outcomes: repairOutcomes,
        tasks: coupleTasks,
        importantDates,
        attentionStates,
        receipts: activityReceipts,
        seenKeys: optimisticSeenKeys,
        nowMs,
        currentUserId: effectiveUserId,
        coupleId: effectiveCoupleId,
        partnerName: effectivePartnerName,
        isReflectionActive,
      }),
    [
      relationshipEvents,
      repairResponses,
      repairOutcomes,
      coupleTasks,
      importantDates,
      attentionStates,
      activityReceipts,
      optimisticSeenKeys,
      nowMs,
      effectiveUserId,
      effectiveCoupleId,
      effectivePartnerName,
      isReflectionActive,
    ],
  );

  // Record gentle presentation when a resurfaced moment is rendered
  useEffect(() => {
    const targetEventId =
      whatMattersNow.targetEventId || whatMattersNow.sourceId;
    if (
      whatMattersNow.kind === "resurfaced_moment" &&
      whatMattersNow.isResurfaced &&
      targetEventId &&
      isScreenFocusedRef.current
    ) {
      if (lastRecordedResurfacedKeyRef.current !== whatMattersNow.key) {
        lastRecordedResurfacedKeyRef.current = whatMattersNow.key;
        void supabase
          .rpc("mark_relationship_event_attention_presented", {
            p_event_id: targetEventId,
          })
          .then(({ error }) => {
            if (error && __DEV__) {
              console.warn(
                "mark_relationship_event_attention_presented failed:",
                error.message,
              );
            }
          });
      }
    }
  }, [whatMattersNow]);

  const handleOpenResurfacedMoment = useCallback(
    async (
      eventId: string,
      targetRoute: string,
      candidate?: HomeActivityCandidate,
    ) => {
      const targetEventId = candidate?.targetEventId || eventId;
      if (candidate) {
        setOptimisticSeenKeys((prev) => new Set(prev).add(candidate.key));
        void markHomeActivitySeen({
          supabase,
          candidate,
          coupleId: effectiveCoupleId,
          userId: effectiveUserId,
        });
      }
      if (targetEventId) {
        try {
          void supabase.rpc("mark_relationship_event_attention_opened", {
            p_event_id: targetEventId,
          });
        } catch {}
      }
      router.push(targetRoute as any);
    },
    [effectiveCoupleId, effectiveUserId, router],
  );

  const handleOpenActivityCard = useCallback(
    async (candidate: HomeActivityCandidate) => {
      if (isNavigatingActivityRef.current) return;
      isNavigatingActivityRef.current = true;

      const keyToMark = candidate.key;
      const targetRoute = candidate.route;

      // Optimistic immediate suppression for smooth UI transition
      setOptimisticSeenKeys((prev) => new Set(prev).add(keyToMark));

      // Persist receipt asynchronously without blocking navigation
      void markHomeActivitySeen({
        supabase,
        candidate,
        coupleId: effectiveCoupleId,
        userId: effectiveUserId,
      });

      // If actionable event with an explicit targetEventId, update relationship_event_attention_states.last_opened_at
      if (candidate.actionable && candidate.targetEventId) {
        void supabase.rpc("mark_relationship_event_attention_opened", {
          p_event_id: candidate.targetEventId,
        });
      }

      try {
        router.push(targetRoute as any);
      } finally {
        setTimeout(() => {
          isNavigatingActivityRef.current = false;
        }, 800);
      }
    },
    [effectiveCoupleId, effectiveUserId, router],
  );

  const handleSnoozeResurfacedMoment = useCallback(
    async (eventId: string, duration: "day" | "week") => {
      try {
        const { error } = await supabase.rpc(
          "snooze_relationship_event_attention",
          {
            p_event_id: eventId,
            p_duration: duration,
          },
        );
        if (error && __DEV__) {
          console.warn("snooze_relationship_event_attention:", error.message);
        }
      } catch (err) {
        if (__DEV__) console.warn("snooze exception:", err);
      } finally {
        void refreshHomeDataRef.current({ silent: true });
      }
    },
    [],
  );

  // Lightweight timer to re-evaluate eligibility when the currently displayed event reaches 24h
  useEffect(() => {
    if (
      !whatMattersNow.occurredAt ||
      whatMattersNow.kind === "empty" ||
      whatMattersNow.kind === "reflection" ||
      whatMattersNow.kind === "resurfaced_moment"
    ) {
      return;
    }

    const itemTime = new Date(whatMattersNow.occurredAt).getTime();
    if (isNaN(itemTime)) return;

    const expiryTime = itemTime + TWENTY_FOUR_HOURS_MS;
    const remainingMs = expiryTime - nowMs;

    if (remainingMs <= 0) {
      setNowMs(Date.now());
      return;
    }

    const delay = Math.min(Math.max(remainingMs + 500, 1000), 3600000);
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setNowMs(Date.now());
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [whatMattersNow.occurredAt, whatMattersNow.kind, nowMs]);

  const handleOpenReflectionFromHome = () => {
    setPreviewState("evening_reflection");
    setEveningClosureState(null);
    setSelectedFeeling(null);
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, reflectionCardY.current - 16),
        animated: true,
      });
    });
  };

  const handleDismissReflection = () => {
    setPreviewState("calm_day");
    setSelectedFeeling(null);
    setEveningClosureState(null);
  };

  const handleReturnToHomeFromClosure = () => {
    setPreviewState("calm_day");
    setEveningClosureState(null);
    setSelectedFeeling(null);
  };

  const handleSelectFeeling = (feeling: FeelingOption) => {
    setSelectedFeeling(feeling.key);
    setEveningClosureState(null);
  };

  const handleReflectionAction = (action: "remind" | "skip") => {
    setEveningClosureState(action);
    setSelectedFeeling(null);
  };

  const handleUndoEveningState = () => {
    setEveningClosureState(null);
    setSelectedFeeling(null);
  };

  const handleRecordAction = (type: "good" | "off") => {
    setIsRecordSheetOpen(false);
    const eventType = type === "good" ? "positive" : "friction";
    router.push({
      pathname: "/record-moment",
      params: { type: eventType },
    });
  };

  const handleOpenRecordSheet = () => {
    setIsRecordSheetOpen(true);
  };

  const handleCloseRecordSheet = () => {
    setIsRecordSheetOpen(false);
  };

  const handleSpaceAction = (spaceName: "Mine" | "Ours") => {
    if (spaceName === "Mine") {
      router.push({
        pathname: "/events",
        params: { scope: "mine" },
      });
      return;
    }
    if (spaceName === "Ours") {
      router.push({
        pathname: "/events",
        params: { scope: "ours" },
      });
      return;
    }
    setLocalFeedback(`${spaceName} space: Feature preview only.`);
  };

  const handleChangePersonalPhoto = async () => {
    try {
      const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
      let hasPermission = currentPerm.granted;

      if (!hasPermission && currentPerm.canAskAgain) {
        const requestedPerm =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        hasPermission = requestedPerm.granted;
      }

      if (!hasPermission) {
        setLocalFeedback(
          "We couldn’t open your photo library. You can allow photo access in your device settings and try again."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedAsset = result.assets[0];
        if (pickedAsset?.uri) {
          setPersonalCoverUri(pickedAsset.uri);
        }
      }
    } catch {
      setLocalFeedback(
        "We couldn’t open your photo library. You can allow photo access in your device settings and try again."
      );
    }
  };

  const handleWeeklyGentlePress = () => {
    setLocalFeedback(
      "Your weekly reflection will appear here when it is connected."
    );
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Single Mobile Content Column (capped at 520px) */}
        <View style={styles.mainColumn}>
          {/* Top Title (Personalized, e.g. "Kaivlya’s Rhythm" or fallback "My Rhythm") */}
          <CouplyHeader
            title={rhythmTitle}
            style={styles.topHeaderCouply}
            titleStyle={styles.topHeaderTitle}
          />

          {/* 1. Relationship Header */}
          <View style={styles.headerContainer}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerGreetingBlock}>
                {effectivePartnerConnected ? (
                  <>
                    <Text style={styles.greetingText}>
                      {greeting}, {effectiveDisplayName || "there"}
                    </Text>
                    <Text style={styles.relationshipText}>
                      {effectivePartnerName
                        ? `You & ${effectivePartnerName} ♡`
                        : "You & your partner ♡"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.greetingText}>Your space</Text>
                    <Text style={styles.relationshipText}>
                      You can connect with a partner whenever you feel ready.
                    </Text>
                  </>
                )}
              </View>
              {effectivePartnerConnected && (
                <View
                  style={styles.connectionBadge}
                  accessible={true}
                  accessibilityRole="text"
                  accessibilityLabel="Connection status: Connected"
                >
                  <View style={styles.connectionDot} />
                  <Text style={styles.connectionLabel}>Connected</Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. Personal Cover Banner ("Your corner") */}
          <View style={styles.sharedBannerCard}>
            <Image
              source={personalCoverSource}
              style={styles.sharedBannerImage}
              resizeMode="cover"
              accessible={true}
              accessibilityLabel="Your personal cover photo"
            />
            {/* Quiet circular Change Photo icon button */}
            <Pressable
              style={({ pressed }) => [
                styles.changePhotoButton,
                pressed && styles.changePhotoButtonPressed,
              ]}
              onPress={handleChangePersonalPhoto}
              accessibilityRole="button"
              accessibilityLabel="Change your personal cover photo"
            >
              <Text style={styles.changePhotoIcon}>✎</Text>
            </Pressable>
            <View style={styles.sharedBannerOverlay}>
              <Text style={styles.sharedBannerHeading}>Your corner</Text>
              <Text style={styles.sharedBannerSubtitle}>
                Only you can see this.
              </Text>
            </View>
          </View>

          {/* 3. "What matters now" Primary Focus Card */}
          <CouplySectionCard
            style={styles.betweenUsCard}
            onLayout={(event) => {
              reflectionCardY.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderBubble}>
                <Text style={styles.sectionHeaderIcon}>✦</Text>
              </View>
              <Text style={styles.sectionOverline}>What matters now</Text>
            </View>

            {/* Priority 1: Explicit personal reflection in progress */}
            {whatMattersNow.kind === "reflection" ? (
              <View style={styles.reflectionContent}>
                {eveningClosureState !== null ? (
                  <View style={styles.reflectionClosureCard}>
                    <Text style={styles.reflectionClosureHeading}>
                      Thank you for checking in.
                    </Text>
                    <Text style={styles.reflectionClosureText}>
                      There is nothing else you need to do tonight.
                    </Text>
                    <Text style={styles.reflectionClosureNote}>
                      This is a local preview and will not be saved yet.
                    </Text>
                    <View style={styles.reflectionClosureActionCol}>
                      <CouplyQuietButton
                        label="Return to My Rhythm"
                        onPress={handleReturnToHomeFromClosure}
                        accessibilityLabel="Return to My Rhythm"
                        variant="soft"
                        style={styles.reflectionReturnBtn}
                      />
                      <Pressable
                        style={styles.reflectionUndoTextBtn}
                        onPress={handleUndoEveningState}
                        accessibilityRole="button"
                        accessibilityLabel="Undo and restore choices"
                      >
                        <Text style={styles.reflectionUndoTextBtnText}>Undo</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reflectionHeading}>
                      How did today feel between you two?
                    </Text>
                    <Text style={styles.reflectionSupportingText}>
                      Choose only what feels true right now. Nothing is expected from you.
                    </Text>

                    <View style={styles.feelingsList}>
                      {FEELING_OPTIONS.map((option) => {
                        const isSelected = selectedFeeling === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            style={[
                              styles.feelingCard,
                              isSelected && styles.feelingCardSelected,
                            ]}
                            onPress={() => handleSelectFeeling(option)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={`Feeling: ${option.label}. ${option.description}`}
                          >
                            <View
                              style={[
                                styles.feelingIconBubble,
                                isSelected && styles.feelingIconBubbleSelected,
                              ]}
                              accessible={false}
                            >
                              <Text
                                style={[
                                  styles.feelingSymbolText,
                                  { color: option.accentColor },
                                ]}
                                accessible={false}
                              >
                                {option.symbol}
                              </Text>
                            </View>
                            <View style={styles.feelingTextGroup}>
                              <Text
                                style={[
                                  styles.feelingTitle,
                                  isSelected && styles.feelingTitleSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                              <Text style={styles.feelingDescription}>
                                {option.description}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Inline outcome card beneath choices */}
                    {selectedFeeling !== null && (
                      <View style={styles.reflectionOutcomeCard}>
                        {selectedFeeling === "special" && (
                          <>
                            <Text style={styles.reflectionOutcomeHeading}>
                              That sounds worth keeping.
                            </Text>
                            <Text style={styles.reflectionOutcomeText}>
                              If you would like, you can add it as a good moment in your relationship space.
                            </Text>
                            <View style={styles.reflectionActionsRow}>
                              <Pressable
                                style={styles.reflectionPrimaryBtn}
                                onPress={() =>
                                  router.push({
                                    pathname: "/record-moment",
                                    params: { type: "positive", lockType: "true" },
                                  })
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Record something good"
                              >
                                <Text style={styles.reflectionPrimaryBtnText}>
                                  Record something good
                                </Text>
                              </Pressable>
                              <Pressable
                                style={styles.reflectionSecondaryBtn}
                                onPress={() => setEveningClosureState("done")}
                                accessibilityRole="button"
                                accessibilityLabel="Done for tonight"
                              >
                                <Text style={styles.reflectionSecondaryBtnText}>
                                  Done for tonight
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        )}

                        {selectedFeeling === "regular" && (
                          <>
                            <Text style={styles.reflectionOutcomeHeading}>
                              Thank you for noticing.
                            </Text>
                            <Text style={styles.reflectionOutcomeText}>
                              Ordinary, steady days can be the quiet foundation of a relationship.
                            </Text>
                            <View style={styles.reflectionActionsRow}>
                              <Pressable
                                style={styles.reflectionPrimaryBtn}
                                onPress={() => setEveningClosureState("done")}
                                accessibilityRole="button"
                                accessibilityLabel="Done for tonight"
                              >
                                <Text style={styles.reflectionPrimaryBtnText}>
                                  Done for tonight
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        )}

                        {selectedFeeling === "distant" && (
                          <>
                            <Text style={styles.reflectionOutcomeHeading}>
                              Thank you for noticing.
                            </Text>
                            <Text style={styles.reflectionOutcomeText}>
                              Closeness can ebb and flow. Noticing a little distance is already a gentle first step.
                            </Text>
                            <View style={styles.reflectionActionsRow}>
                              <Pressable
                                style={styles.reflectionPrimaryBtn}
                                onPress={() => setEveningClosureState("done")}
                                accessibilityRole="button"
                                accessibilityLabel="Done for tonight"
                              >
                                <Text style={styles.reflectionPrimaryBtnText}>
                                  Done for tonight
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        )}

                        {selectedFeeling === "annoyed" && (
                          <>
                            <Text style={styles.reflectionOutcomeHeading}>
                              That is okay to notice.
                            </Text>
                            <Text style={styles.reflectionOutcomeText}>
                              Little irritations are normal. You can let this settle for now, or try looking at it in a lighter way.
                            </Text>
                            <View style={styles.reflectionActionsRow}>
                              <Pressable
                                style={styles.reflectionPrimaryBtn}
                                onPress={() => router.push("/playful-reframe")}
                                accessibilityRole="button"
                                accessibilityLabel="Try a playful reframe"
                              >
                                <Text style={styles.reflectionPrimaryBtnText}>
                                  Try a playful reframe
                                </Text>
                              </Pressable>
                              <Pressable
                                style={styles.reflectionSecondaryBtn}
                                onPress={() => setEveningClosureState("done")}
                                accessibilityRole="button"
                                accessibilityLabel="Done for tonight"
                              >
                                <Text style={styles.reflectionSecondaryBtnText}>
                                  Done for tonight
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        )}

                        {selectedFeeling === "friction" && (
                          <>
                            <Text style={styles.reflectionOutcomeHeading}>
                              Give this a little care.
                            </Text>
                            <Text style={styles.reflectionOutcomeText}>
                              If it would help, you can take a quiet moment to record what felt off.
                            </Text>
                            <View style={styles.reflectionActionsRow}>
                              <Pressable
                                style={styles.reflectionPrimaryBtn}
                                onPress={() =>
                                  router.push({
                                    pathname: "/record-moment",
                                    params: { type: "friction", lockType: "true" },
                                  })
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Record what felt off"
                              >
                                <Text style={styles.reflectionPrimaryBtnText}>
                                  Record what felt off
                                </Text>
                              </Pressable>
                              <Pressable
                                style={styles.reflectionSecondaryBtn}
                                onPress={() => setEveningClosureState("done")}
                                accessibilityRole="button"
                                accessibilityLabel="Done for tonight"
                              >
                                <Text style={styles.reflectionSecondaryBtnText}>
                                  Done for tonight
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        )}

                        <Text style={styles.reflectionOutcomePreviewNote}>
                          For now, this daily check-in stays only on this screen.
                        </Text>

                        <Pressable
                          style={styles.reflectionChangeBtn}
                          onPress={() => setSelectedFeeling(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Change answer"
                        >
                          <Text style={styles.reflectionChangeBtnText}>
                            Change answer
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Secondary quiet dismissal before choosing a feeling */}
                    {selectedFeeling === null && (
                      <View style={styles.reflectionSecondaryActions}>
                        <Pressable
                          style={styles.quietSecondaryButton}
                          onPress={handleDismissReflection}
                          accessibilityRole="button"
                          accessibilityLabel="Not now"
                        >
                          <Text style={styles.quietSecondaryText}>Not now</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : whatMattersNow.kind === "resurfaced_moment" ? (
              /* Priority 9: Resurfaced gentle moment */
              <View style={styles.resurfacedMomentCard}>
                <View style={styles.incomingMomentHeader}>
                  <Text style={styles.resurfacedMomentOverline}>
                    {whatMattersNow.overline || "A MOMENT RESTING IN OUR SPACE"}
                  </Text>
                </View>
                <Text style={styles.incomingMomentHeading}>
                  {whatMattersNow.title}
                </Text>
                <Text style={styles.incomingMomentBody}>
                  {whatMattersNow.body}
                </Text>
                <View style={styles.resurfacedActionContainer}>
                  <CouplyPrimaryButton
                    label={whatMattersNow.actionLabel}
                    onPress={() =>
                      handleOpenResurfacedMoment(
                        whatMattersNow.sourceId,
                        whatMattersNow.route,
                        whatMattersNow,
                      )
                    }
                    accessibilityLabel={whatMattersNow.actionLabel}
                    style={styles.resurfacedPrimaryBtn}
                  />
                  <View style={styles.resurfacedQuietRow}>
                    <Pressable
                      style={styles.resurfacedQuietBtn}
                      onPress={() =>
                        handleSnoozeResurfacedMoment(
                          whatMattersNow.sourceId,
                          "day",
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Not today"
                      accessibilityHint="Snooze this reminder for 24 hours"
                    >
                      <Text style={styles.resurfacedQuietText}>Not today</Text>
                    </Pressable>
                    <Pressable
                      style={styles.resurfacedQuietBtn}
                      onPress={() =>
                        handleSnoozeResurfacedMoment(
                          whatMattersNow.sourceId,
                          "week",
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Give it a week"
                      accessibilityHint="Snooze this reminder for seven days"
                    >
                      <Text style={styles.resurfacedQuietText}>Give it a week</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : whatMattersNow.kind !== "empty" ? (
              /* Priority 1-8: Recent partner / shared activity */
              <Pressable
                style={({ pressed }) => [
                  styles.incomingMomentCard,
                  pressed && styles.incomingMomentCardPressed,
                ]}
                onPress={() => handleOpenActivityCard(whatMattersNow)}
                accessibilityRole="button"
                accessibilityLabel={`${whatMattersNow.title}. ${whatMattersNow.body}`}
              >
                <View style={styles.incomingMomentHeader}>
                  {whatMattersNow.icon ? (
                    <Text style={styles.incomingMomentIcon}>
                      {whatMattersNow.icon}
                    </Text>
                  ) : null}
                  <Text style={styles.incomingMomentOverline}>
                    {whatMattersNow.overline || "A SHARED MOMENT"}
                  </Text>
                </View>
                <Text style={styles.incomingMomentHeading}>
                  {whatMattersNow.title}
                </Text>
                <Text style={styles.incomingMomentBody}>
                  {whatMattersNow.body}
                </Text>
                <View style={styles.incomingMomentActionRow}>
                  <View style={styles.incomingMomentActionBtn}>
                    <Text style={styles.incomingMomentActionText}>
                      {whatMattersNow.actionLabel}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : (
              /* Priority 11: Calm empty state */
              <View style={styles.calmCheckInContent}>
                <Text style={styles.calmCheckInOverline}>WHAT MATTERS NOW</Text>
                <Text style={styles.calmCheckInHeading}>
                  {whatMattersNow.title}
                </Text>
                <Text style={styles.calmCheckInBody}>
                  {whatMattersNow.body}
                </Text>
                <View style={styles.calmCheckInActionRow}>
                  <CouplyQuietButton
                    label={whatMattersNow.actionLabel}
                    onPress={() =>
                      router.push(whatMattersNow.route as any)
                    }
                    accessibilityLabel={whatMattersNow.actionLabel}
                    variant="soft"
                    style={styles.calmCheckInPrimaryBtn}
                  />
                </View>
                <Pressable
                  style={styles.calmReflectSecondaryBtn}
                  onPress={handleOpenReflectionFromHome}
                  accessibilityRole="button"
                  accessibilityLabel="Reflect on today"
                >
                  <Text style={styles.calmReflectSecondaryText}>
                    Reflect on today
                  </Text>
                </Pressable>
              </View>
            )}
          </CouplySectionCard>

          {/* Separate Secondary Section: Invitation Preview (Demonstration) */}
          {hasPendingChallengePreview && (
            <CouplySectionCard
              variant="lilac"
              style={styles.invitationPreviewCard}
            >
              <View style={styles.invitationPreviewHeader}>
                <Text style={styles.invitationPreviewOverline}>
                  INVITATION PREVIEW
                </Text>
              </View>
              <Text style={styles.invitationPreviewHeading}>
                {challengeRecipientHeading}
              </Text>
              <Text style={styles.invitationPreviewBody}>
                See how this invitation would appear for your partner.
              </Text>
              <View style={styles.invitationPreviewActionRow}>
                <CouplyPrimaryButton
                  label="Open recipient view"
                  onPress={() =>
                    router.push({
                      pathname: "/challenge-lifecycle-preview",
                      params: { source: "home-preview" },
                    })
                  }
                  accessibilityLabel="Open recipient view"
                  style={styles.invitationPreviewActionBtn}
                />
              </View>
              <Text style={styles.invitationPreviewTruthfulNote}>
                Only active in this browser session. Nothing has been sent or saved.
              </Text>
            </CouplySectionCard>
          )}

          {/* 4. Mine (~34%) and Ours (~66%) Spaces */}
          <View style={styles.spacesContainer}>
            {/* Mine Tile (~34% width, quiet pale lavender-grey, whole tile tappable) */}
            <Pressable
              style={({ pressed }) => [
                styles.spaceTile,
                styles.mineTile,
                pressed && styles.mineTilePressed,
              ]}
              onPress={() => handleSpaceAction("Mine")}
              accessibilityRole="button"
              accessibilityLabel="Open Mine, your private space"
            >
              <View style={styles.mineTileTop}>
                <View style={styles.mineIconBadge}>
                  <Text style={styles.mineIcon}>🔒</Text>
                </View>
                <Text style={styles.mineRoomTitle}>Mine</Text>
              </View>
              <Text style={styles.mineTileBody}>
                Private reflections and notes.
              </Text>
              <View style={styles.tileFooterRow}>
                <Text style={styles.mineSummaryText}>2 private reflections</Text>
              </View>
            </Pressable>

            {/* Ours Tile (~66% width with real giggle otters image and space name, whole tile tappable) */}
            <Pressable
              style={({ pressed }) => [
                styles.spaceTile,
                styles.oursTile,
                pressed && styles.oursTilePressed,
              ]}
              onPress={() => handleSpaceAction("Ours")}
              accessibilityRole="button"
              accessibilityLabel="Open Ours, your shared space"
            >
              <View style={styles.oursTileTop}>
                {/* Paired otters illustration in soft circular lilac area */}
                <View
                  style={styles.oursAvatarCircle}
                  accessible={true}
                  accessibilityLabel="Giggle otters mascot"
                >
                  <Image
                    source={require("@/assets/images/giggle-otters.png")}
                    style={styles.oursAvatarImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.oursTitleColumn}>
                  <View style={styles.oursHeaderInline}>
                    <Text style={styles.oursHeart}>♡</Text>
                    <Text style={styles.oursRoomTitle}>Ours</Text>
                  </View>
                  <Text style={styles.oursSharedName}>
                    {effectivePartnerConnected
                      ? effectivePartnerName
                        ? `Shared with ${effectivePartnerName}`
                        : "Shared with your partner"
                      : "Shared space with partner"}
                  </Text>
                </View>
              </View>
              <Text style={styles.oursTileBody}>
                Shared memories, repairs, and progress.
              </Text>
              <View style={styles.tileFooterRow}>
                <Text style={styles.oursSummaryText}>
                  1 shared moment this week
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 5. "Your week, gently" - Look back card */}
          <Pressable
            style={({ pressed }) => [
              styles.sectionCard,
              styles.weeklyGentleCard,
              pressed && styles.weeklyGentleCardPressed,
            ]}
            onPress={handleWeeklyGentlePress}
            accessibilityRole="button"
            accessibilityLabel="Look back at your week"
          >
            <View style={styles.weeklyGentleHeaderRow}>
              <View style={styles.sectionHeaderBubble}>
                <Text style={styles.sectionHeaderIcon}>🌿</Text>
              </View>
              <Text style={styles.sectionOverline}>Your week, gently</Text>
            </View>
            <View style={styles.weeklyGentleBodyRow}>
              <Text style={styles.weeklyGentleContentText}>
                A quiet place to notice what has mattered lately.
              </Text>
              <View style={styles.weeklyGentleAffordanceWrap}>
                <Text style={styles.weeklyGentleAffordance}>Look back →</Text>
              </View>
            </View>
          </Pressable>

          {/* Local Mock Feedback Box */}
          {localFeedback && (
            <View
              style={styles.feedbackBanner}
              accessible={true}
              accessibilityRole="alert"
            >
              <Text style={styles.feedbackBannerText}>{localFeedback}</Text>
              <Pressable
                style={styles.feedbackDismissButton}
                onPress={() => setLocalFeedback(null)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notice"
              >
                <Text style={styles.feedbackDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button (constrained to 520px mobile column) */}
      <View
        style={styles.floatingButtonFixedContainer}
        pointerEvents="box-none"
      >
        <View
          style={styles.floatingButtonColumnWrapper}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.floatingRecordButton}
            onPress={handleOpenRecordSheet}
            accessibilityRole="button"
            accessibilityLabel="Record a moment"
          >
            <Text style={styles.floatingRecordPlus}>＋</Text>
            <Text style={styles.floatingRecordLabel}>Record a Moment</Text>
          </Pressable>
        </View>
      </View>

      {/* Local Mock Bottom Sheet Overlay (above navigation bar) */}
      {isRecordSheetOpen && (
        <View style={styles.sheetBackdrop} pointerEvents="box-none">
          <Pressable
            style={styles.sheetBackdropTouch}
            onPress={handleCloseRecordSheet}
            accessibilityRole="button"
            accessibilityLabel="Close record sheet"
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetContent}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetHeading}>
                What would you like to record?
              </Text>
              <Text style={styles.sheetSubtext}>
                Choose what feels closest to this moment.
              </Text>

              <View style={styles.sheetTilesRow}>
                {/* 🌷 Something good */}
                <Pressable
                  style={styles.sheetTile}
                  onPress={() => handleRecordAction("good")}
                  accessibilityRole="button"
                  accessibilityLabel="Something good: A kind moment, appreciation, or small joy."
                >
                  <View style={styles.sheetIconBubbleGood}>
                    <Text style={styles.sheetIcon}>🌷</Text>
                  </View>
                  <Text style={styles.sheetTileTitle}>Something good</Text>
                  <Text style={styles.sheetTileSubtitle}>
                    A kind moment, appreciation, or small joy.
                  </Text>
                </Pressable>

                {/* 🌧️ Something felt off */}
                <Pressable
                  style={styles.sheetTile}
                  onPress={() => handleRecordAction("off")}
                  accessibilityRole="button"
                  accessibilityLabel="Something felt off: Tension, hesitation, or a disconnect."
                >
                  <View style={styles.sheetIconBubbleOff}>
                    <Text style={styles.sheetIcon}>🌧️</Text>
                  </View>
                  <Text style={styles.sheetTileTitle}>Something felt off</Text>
                  <Text style={styles.sheetTileSubtitle}>
                    Tension, hesitation, or a disconnect.
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.sheetCloseButton}
                onPress={handleCloseRecordSheet}
                accessibilityRole="button"
                accessibilityLabel="Not now, close record sheet"
              >
                <Text style={styles.sheetCloseButtonText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Fixed Visual Bottom Navigation */}
      <AppBottomNav
        activeTab="rhythm"
        onPreviewPress={(msg) => setLocalFeedback(msg)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeConfig | ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 110,
    },
    /* Single Centered Column: Full width on mobile, capped at tokens.layout.appShell on desktop/wide viewports */
    mainColumn: {
      width: "100%",
      maxWidth: tokens.layout.appShell,
      alignSelf: "center",
      gap: 16,
    },

    /* Top Centred Title */
    topTitleContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 4,
      paddingBottom: 2,
    },
    topHeaderCouply: {
      paddingHorizontal: 0,
      paddingTop: 4,
      paddingBottom: 2,
      alignItems: "center",
    },
    topHeaderTitle: {
      textAlign: "center",
      flexShrink: 1,
    },
    topTitleText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },

    /* 1. Header */
    headerContainer: {
      paddingVertical: 4,
    },
    headerTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    headerGreetingBlock: {
      flex: 1,
    },
    greetingText: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.3,
      lineHeight: 28,
    },
    relationshipText: {
      fontSize: 15,
      color: theme.secondaryText,
      marginTop: 3,
      fontWeight: "500",
      letterSpacing: -0.1,
    },
    connectionBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.privateSurface,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    connectionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
      marginRight: 6,
    },
    connectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.accent,
    },

    /* 2. Shared Image Banner */
    sharedBannerCard: {
      borderRadius: 20,
      overflow: "hidden",
      height: 215,
      backgroundColor: theme.privateSurface,
      position: "relative",
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    sharedBannerImage: {
      width: "100%",
      height: "100%",
    },
    changePhotoButton: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(30, 20, 32, 0.5)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    changePhotoButtonPressed: {
      backgroundColor: "rgba(30, 20, 32, 0.75)",
    },
    changePhotoIcon: {
      color: "#FFFFFF",
      fontSize: 13,
      lineHeight: 16,
    },
    sharedBannerOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: "rgba(30, 20, 32, 0.5)",
      justifyContent: "flex-end",
    },
    sharedBannerHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: "#FFFFFF",
      lineHeight: 22,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    sharedBannerSubtitle: {
      fontSize: 13,
      color: "#FFFFFF",
      opacity: 0.92,
      lineHeight: 18,
      marginTop: 2,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },

    /* Generic Section Card */
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    betweenUsCard: {
      borderColor: theme.border,
      backgroundColor: theme.surface,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    sectionHeaderBubble: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.privateSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionHeaderIcon: {
      fontSize: 12,
    },
    sectionOverline: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.secondaryText,
      letterSpacing: 0.3,
    },
    cardMainHeading: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
      marginBottom: 4,
      lineHeight: 24,
    },

    /* 3. Calm Check-In */
    calmCheckInContent: {
      gap: 10,
      paddingVertical: 4,
    },
    calmCheckInOverline: {
      fontSize: 11.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: theme.accent,
      textTransform: "uppercase",
    },
    calmCheckInHeading: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    calmCheckInBody: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 21,
    },
    calmCheckInActionRow: {
      marginTop: 4,
      flexDirection: "row",
    },
    calmCheckInPrimaryBtn: {
      backgroundColor: theme.buttonSecondaryBg || "#F5EFF7",
      borderColor: theme.border,
      borderWidth: 1.2,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    calmCheckInPrimaryBtnPressed: {
      backgroundColor: theme.border,
      borderColor: theme.accent,
    },
    calmCheckInPrimaryBtnText: {
      color: theme.accent,
      fontSize: 13.5,
      fontWeight: "600",
    },
    calmCheckInSecondaryNote: {
      fontSize: 12.5,
      color: theme.mutedText,
      lineHeight: 18,
      fontStyle: "italic",
    },
    calmReflectSecondaryBtn: {
      alignSelf: "flex-start",
      paddingVertical: 4,
      marginTop: 2,
    },
    calmReflectSecondaryText: {
      fontSize: 13,
      color: theme.accent,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    /* Evening Reflection */
    reflectionContent: {
      gap: 12,
    },
    reflectionHeading: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.primaryText,
      lineHeight: 23,
    },
    reflectionSupportingText: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    reflectionQuestion: {
      fontSize: 14.5,
      color: theme.primaryText,
      lineHeight: 21,
    },
    feelingsList: {
      gap: 8,
      marginTop: 4,
    },
    feelingCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
    },
    feelingCardSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.sharedSurface,
    },
    feelingIconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.privateSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    feelingIconBubbleSelected: {
      backgroundColor: theme.surface,
    },
    feelingSymbolText: {
      fontSize: 18,
    },
    feelingTextGroup: {
      flex: 1,
      gap: 2,
    },
    feelingTitle: {
      fontSize: 14.5,
      fontWeight: "700",
      color: theme.primaryText,
    },
    feelingTitleSelected: {
      color: theme.accent,
    },
    feelingDescription: {
      fontSize: 12.5,
      color: theme.secondaryText,
      lineHeight: 17,
    },

    /* Evening Reflection Inline Outcome */
    reflectionOutcomeCard: {
      backgroundColor: theme.sharedSurface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.sharedBorder,
      marginTop: 10,
      gap: 8,
    },
    reflectionOutcomeHeading: {
      fontSize: 15.5,
      fontWeight: "700",
      color: theme.primaryText,
    },
    reflectionOutcomeText: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    reflectionOutcomePreviewNote: {
      fontSize: 12,
      color: theme.mutedText,
      fontStyle: "italic",
      marginTop: 2,
    },
    reflectionActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      flexWrap: "wrap",
    },
    reflectionPrimaryBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    reflectionPrimaryBtnText: {
      fontSize: 13.5,
      fontWeight: "600",
      color: theme.accentText,
    },
    reflectionSecondaryBtn: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    reflectionSecondaryBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryText,
    },
    reflectionChangeBtn: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginTop: 2,
    },
    reflectionChangeBtnText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.accent,
    },

    /* Evening Reflection Closure States */
    reflectionClosureCard: {
      backgroundColor: theme.sharedSurface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.sharedBorder,
      gap: 8,
    },
    reflectionClosureHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
    },
    reflectionClosureText: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    reflectionClosureNote: {
      fontSize: 12,
      color: theme.mutedText,
      fontStyle: "italic",
    },
    reflectionClosureActionCol: {
      marginTop: 6,
      gap: 10,
      alignItems: "flex-start",
    },
    reflectionReturnBtn: {
      backgroundColor: theme.buttonSecondaryBg || "#F5EFF7",
      borderColor: theme.border,
      borderWidth: 1.2,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    reflectionReturnBtnPressed: {
      backgroundColor: theme.border,
      borderColor: theme.accent,
    },
    reflectionReturnBtnText: {
      fontSize: 13.5,
      fontWeight: "600",
      color: theme.accent,
    },
    reflectionUndoTextBtn: {
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    reflectionUndoTextBtnText: {
      fontSize: 12.5,
      color: theme.mutedText,
      textDecorationLine: "underline",
    },
    reflectionSecondaryActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    quietSecondaryButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    quietSecondaryText: {
      fontSize: 12.5,
      color: theme.secondaryText,
      fontWeight: "600",
    },
    quietSeparatorDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.border,
    },
    savedNoticeBox: {
      backgroundColor: theme.sharedSurface,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    savedHeading: {
      fontSize: 14.5,
      fontWeight: "700",
      color: theme.accent,
    },
    savedDescription: {
      fontSize: 14,
      color: theme.primaryText,
      marginTop: 4,
      lineHeight: 19,
    },
    savedSubtext: {
      fontSize: 12.5,
      color: theme.secondaryText,
      marginTop: 5,
      fontStyle: "italic",
    },
    quietResetButton: {
      marginTop: 8,
      alignSelf: "flex-start",
      paddingVertical: 2,
    },
    quietResetText: {
      fontSize: 12.5,
      color: theme.accent,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    /* Partner Response */
    partnerResponseContent: {
      gap: 14,
      paddingVertical: 4,
    },
    partnerTextGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    partnerBubble: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.sharedSurface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    partnerIconMini: {
      fontSize: 22,
    },
    partnerResponseText: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.primaryText,
      lineHeight: 21,
    },
    resolvedTextCol: {
      flex: 1,
      gap: 2,
    },
    resolvedSupportingText: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },

    /* Incoming Shared Friction Moment Card */
    incomingMomentCard: {
      backgroundColor: theme.sharedSurface,
      borderColor: theme.sharedBorder,
      borderWidth: 1.2,
      borderRadius: 16,
      padding: 16,
      gap: 8,
      marginTop: 4,
    },
    incomingMomentCardPressed: {
      backgroundColor: theme.border,
      borderColor: theme.accent,
    },
    incomingMomentHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    incomingMomentIcon: {
      fontSize: 14,
    },
    incomingMomentOverline: {
      fontSize: 11.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: theme.accent,
      textTransform: "uppercase",
    },
    incomingMomentHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
      lineHeight: 22,
    },
    incomingMomentBody: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    incomingMomentActionRow: {
      marginTop: 6,
      flexDirection: "row",
    },
    incomingMomentActionBtn: {
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    incomingMomentActionText: {
      color: theme.accentText,
      fontSize: 13.5,
      fontWeight: "600",
    },

    /* Resurfaced Gentle Moment Card */
    resurfacedMomentCard: {
      backgroundColor: theme.sharedSurface,
      borderColor: theme.sharedBorder,
      borderWidth: 1.2,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      marginTop: 4,
    },
    resurfacedMomentOverline: {
      fontSize: 11.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: theme.accent,
      textTransform: "uppercase",
    },
    resurfacedActionContainer: {
      marginTop: 6,
      gap: 10,
    },
    resurfacedPrimaryBtn: {
      minHeight: 44,
    },
    resurfacedQuietRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
    },
    resurfacedQuietBtn: {
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.buttonSecondaryBg,
      borderWidth: 1,
      borderColor: theme.buttonSecondaryBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    resurfacedQuietText: {
      color: theme.secondaryText,
      fontSize: 13.5,
      fontWeight: "600",
    },

    /* Separate Secondary Section: Invitation Preview Card */
    invitationPreviewCard: {
      gap: 8,
      backgroundColor: theme.sharedSurface,
      borderColor: theme.sharedBorder,
      borderWidth: 1.2,
    },
    invitationPreviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    invitationPreviewOverline: {
      fontSize: 11.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: theme.accent,
      textTransform: "uppercase",
    },
    invitationPreviewHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
      lineHeight: 22,
    },
    invitationPreviewBody: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    invitationPreviewActionRow: {
      marginTop: 4,
      flexDirection: "row",
    },
    invitationPreviewActionBtn: {
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    invitationPreviewActionBtnPressed: {
      backgroundColor: theme.accentPressed || theme.accent,
      opacity: 0.9,
    },
    invitationPreviewActionText: {
      color: theme.accentText,
      fontSize: 13.5,
      fontWeight: "600",
    },
    invitationPreviewTruthfulNote: {
      fontSize: 12,
      color: theme.mutedText,
      lineHeight: 16,
      fontStyle: "italic",
      marginTop: 2,
    },

    /* 4. Mine and Ours Spaces (Asymmetric: Mine ~34%, Ours ~66%) */
    spacesContainer: {
      flexDirection: "row",
      gap: 10,
    },
    spaceTile: {
      borderRadius: 18,
      borderWidth: 1.2,
      justifyContent: "space-between",
      minHeight: 148,
    },
    mineTile: {
      flex: 34,
      backgroundColor: theme.privateSurface,
      borderColor: theme.border,
      padding: 12,
    },
    mineTilePressed: {
      backgroundColor: theme.border,
      borderColor: theme.border,
    },
    oursTile: {
      flex: 66,
      backgroundColor: theme.sharedSurface,
      borderColor: theme.border,
      padding: 12,
    },
    oursTilePressed: {
      backgroundColor: theme.border,
      borderColor: theme.border,
    },
    mineTileTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 26,
      marginBottom: 4,
    },
    mineIconBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    mineIcon: {
      fontSize: 12,
    },
    mineRoomTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      lineHeight: 22,
    },
    mineTileBody: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
      flex: 1,
      marginTop: 4,
      marginBottom: 6,
    },
    oursTileTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 4,
    },
    oursAvatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    oursAvatarImage: {
      width: 60,
      height: 60,
    },
    oursTitleColumn: {
      flex: 1,
      justifyContent: "flex-start",
    },
    oursHeaderInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 26,
    },
    oursHeart: {
      fontSize: 13,
      color: theme.accent,
      fontWeight: "700",
      lineHeight: 22,
    },
    oursRoomTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.accent,
      lineHeight: 22,
    },
    oursSharedName: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.accent,
      marginTop: 2,
      lineHeight: 16,
    },
    oursTileBody: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
      flex: 1,
      marginTop: 4,
      marginBottom: 6,
    },
    tileFooterRow: {
      alignSelf: "flex-start",
      marginTop: 2,
    },
    mineSummaryText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
      letterSpacing: 0.1,
    },
    oursSummaryText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.accent,
      letterSpacing: 0.1,
    },

    /* 5. Space below Mine and Ours: Compact Open Moments */
    compactOpenMomentCard: {
      borderColor: theme.border,
    },
    openMomentCompactContent: {
      gap: 10,
    },
    neutralNoticeHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    neutralTopicTag: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.primaryText,
      backgroundColor: theme.privateSurface,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 8,
    },
    neutralMetadata: {
      fontSize: 12,
      color: theme.secondaryText,
    },
    neutralPromptText: {
      fontSize: 14.5,
      color: theme.primaryText,
      lineHeight: 21,
    },

    /* Primary & Secondary Action Buttons */
    primaryActionButton: {
      backgroundColor: theme.accent,
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryActionText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: "600",
    },

    /* 6. Your week, gently */
    weeklyGentleCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      padding: 16,
      gap: 8,
    },
    weeklyGentleCardPressed: {
      backgroundColor: theme.privateSurface,
      borderColor: theme.border,
    },
    weeklyGentleHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    weeklyGentleBodyRow: {
      flexDirection: "column",
      gap: 8,
    },
    weeklyGentleContentText: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    weeklyGentleAffordanceWrap: {
      alignSelf: "flex-start",
      marginTop: 2,
    },
    weeklyGentleAffordance: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.accent,
      letterSpacing: 0.2,
    },

    /* Local Feedback Banner */
    feedbackBanner: {
      backgroundColor: theme.privateSurface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      gap: 8,
    },
    feedbackBannerText: {
      fontSize: 13.5,
      color: theme.primaryText,
      lineHeight: 18,
      textAlign: "center",
    },
    feedbackDismissButton: {
      paddingVertical: 3,
      paddingHorizontal: 12,
    },
    feedbackDismissText: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    /* Floating Action Button */
    floatingButtonFixedContainer: {
      position: "absolute",
      bottom: 74,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 10,
    },
    floatingButtonColumnWrapper: {
      width: "100%",
      maxWidth: tokens.layout.appShell,
      paddingHorizontal: 16,
      alignItems: "flex-end",
    },
    floatingRecordButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 24,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 5,
      minHeight: 44,
      gap: 6,
    },
    floatingRecordPlus: {
      fontSize: 16,
      color: theme.accentText,
      fontWeight: "700",
    },
    floatingRecordLabel: {
      fontSize: 14,
      color: theme.accentText,
      fontWeight: "600",
      letterSpacing: 0.2,
    },

    /* Bottom Sheet Overlay (Record a Moment) */
    sheetBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 64,
      backgroundColor: "rgba(20, 15, 22, 0.4)",
      justifyContent: "flex-end",
      zIndex: 20,
    },
    sheetBackdropTouch: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    sheetContainer: {
      width: "100%",
      maxWidth: tokens.layout.modal,
      alignSelf: "center",
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
    sheetContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
      alignItems: "center",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: 14,
    },
    sheetHeading: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primaryText,
      textAlign: "center",
      marginBottom: 4,
      lineHeight: 24,
    },
    sheetSubtext: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      marginBottom: 16,
      lineHeight: 20,
    },
    sheetTilesRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      marginBottom: 16,
    },
    sheetTile: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      minHeight: 124,
      justifyContent: "flex-start",
    },
    sheetIconBubbleGood: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.sharedSurface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    sheetIconBubbleOff: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.privateSurface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    sheetIcon: {
      fontSize: 20,
    },
    sheetTileTitle: {
      fontSize: 14.5,
      fontWeight: "700",
      color: theme.primaryText,
      marginBottom: 4,
    },
    sheetTileSubtitle: {
      fontSize: 12.5,
      color: theme.secondaryText,
      lineHeight: 16,
    },
    sheetCloseButton: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    sheetCloseButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.secondaryText,
    },
  });

