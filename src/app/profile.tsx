import { tokens } from "@/components/couply-tokens";
import {
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ----------------------------------------------------
// TYPES & CONSTANTS
// ----------------------------------------------------

export type ProfileView = "me" | "partner" | "us";

interface CoupleImportantDate {
  id: string;
  couple_id: string;
  label: string;
  event_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const RELATIONSHIP_STAGES: { value: string; label: string }[] = [
  { value: "dating", label: "Dating" },
  { value: "committed_relationship", label: "In a committed relationship" },
  { value: "engaged", label: "Engaged" },
  { value: "married", label: "Married" },
  { value: "civil_partnership", label: "Civil partnership" },
  { value: "other", label: "Something else" },
];

const PERSONALITY_PRESETS = [
  "Thoughtful",
  "Playful",
  "Quiet at first",
  "Planner",
  "Spontaneous",
  "Morning person",
];

const INTEREST_PRESETS = [
  "Cooking",
  "Travel",
  "Music",
  "Films",
  "Walking",
  "Gardening",
];

const IMPORTANT_DATE_PRESETS = [
  "First met",
  "Our anniversary",
  "Moved in together",
];

// Helper functions
function getDaysInMonth(month: number, year: number = 2024): number {
  if (month === 2) return 29; // Allows leap-year day 29 per database check
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function formatBirthday(month: number | null, day: number | null): string {
  if (!month || !day || month < 1 || month > 12) return "";
  return `${day} ${MONTH_NAMES[month - 1]}`;
}

function formatTogetherSince(
  dateStr: string | null,
  precision: string | null
): string {
  if (!dateStr) return "Not added";
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (precision === "year") {
    return `${year}`;
  }
  if (precision === "month") {
    if (month >= 1 && month <= 12) {
      return `${MONTH_NAMES[month - 1]} ${year}`;
    }
    return `${year}`;
  }
  if (month >= 1 && month <= 12 && day >= 1) {
    return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
  }
  return dateStr;
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (month >= 1 && month <= 12 && day >= 1) {
    return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
  }
  return dateStr;
}

function getStageLabel(stage: string | null): string {
  if (!stage) return "Not added";
  const match = RELATIONSHIP_STAGES.find((s) => s.value === stage);
  return match ? match.label : stage;
}

function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of rawTags) {
    if (!tag) continue;
    const trimmed = tag.trim();
    if (trimmed.length < 1 || trimmed.length > 40) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(trimmed);
    if (normalized.length >= 12) break;
  }

  return normalized;
}

// ----------------------------------------------------
// MAIN PROFILE SCREEN
// ----------------------------------------------------

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { refreshIdentity } = useUserIdentity();

  // Profile View State (Me | Partner | Us)
  const [activeProfileView, setActiveProfileView] = useState<ProfileView>(() => {
    const rawSection = Array.isArray(params.section)
      ? params.section[0]
      : params.section;
    return rawSection === "important-dates" ? "us" : "me";
  });
  const [prioritizeImportantDates, setPrioritizeImportantDates] = useState(() => {
    const rawSection = Array.isArray(params.section)
      ? params.section[0]
      : params.section;
    return rawSection === "important-dates";
  });
  const scrollViewRef = useRef<ScrollView>(null);
  const importantDatesY = useRef<number>(0);
  const hasConsumedSectionParam = useRef(false);

  // Direct Important Dates navigation handler
  useEffect(() => {
    const rawSection = Array.isArray(params.section)
      ? params.section[0]
      : params.section;

    if (rawSection === "important-dates" && !hasConsumedSectionParam.current) {
      hasConsumedSectionParam.current = true;
      setActiveProfileView("us");
      setPrioritizeImportantDates(true);
      router.setParams({ section: undefined });
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    } else if (!rawSection) {
      hasConsumedSectionParam.current = false;
    }
  }, [params.section]);

  const handleSelectProfileView = useCallback((view: ProfileView) => {
    setActiveProfileView(view);
    setPrioritizeImportantDates(false);
  }, []);

  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isFirstMount = useRef(true);

  // 1. Identity & Account details
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editedName, setEditedName] = useState("");
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalFeedback, setPersonalFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 2. Relationship space context
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");

  // 3. What I share with my partner (user_partner_profiles)
  const [hasOwnPartnerProfileRow, setHasOwnPartnerProfileRow] = useState(false);
  const [ownBirthMonth, setOwnBirthMonth] = useState<number | null>(null);
  const [ownBirthDay, setOwnBirthDay] = useState<number | null>(null);
  const [ownIntro, setOwnIntro] = useState("");
  const [ownSupport, setOwnSupport] = useState("");
  const [ownTraits, setOwnTraits] = useState<string[]>([]);
  const [ownInterests, setOwnInterests] = useState<string[]>([]);

  // What I share - Edit state
  const [isEditingPartnerProfile, setIsEditingPartnerProfile] = useState(false);
  const [isSavingPartnerProfile, setIsSavingPartnerProfile] = useState(false);
  const [partnerProfileFeedback, setPartnerProfileFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [draftBirthMonth, setDraftBirthMonth] = useState<number | null>(null);
  const [draftBirthDay, setDraftBirthDay] = useState<number | null>(null);
  const [draftIntro, setDraftIntro] = useState("");
  const [draftSupport, setDraftSupport] = useState("");
  const [draftTraits, setDraftTraits] = useState<string[]>([]);
  const [draftInterests, setDraftInterests] = useState<string[]>([]);
  const [newTraitInput, setNewTraitInput] = useState("");
  const [newInterestInput, setNewInterestInput] = useState("");

  // 4. About my partner (user_partner_profiles read-only)
  const [partnerBirthMonth, setPartnerBirthMonth] = useState<number | null>(null);
  const [partnerBirthDay, setPartnerBirthDay] = useState<number | null>(null);
  const [partnerIntro, setPartnerIntro] = useState<string | null>(null);
  const [partnerSupport, setPartnerSupport] = useState<string | null>(null);
  const [partnerTraits, setPartnerTraits] = useState<string[]>([]);
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);

  // 5. Our relationship (couple_profiles)
  const [hasCoupleProfileRow, setHasCoupleProfileRow] = useState(false);
  const [relStage, setRelStage] = useState<string | null>(null);
  const [togetherSince, setTogetherSince] = useState<string | null>(null);
  const [togetherSincePrecision, setTogetherSincePrecision] = useState<
    "day" | "month" | "year" | null
  >(null);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [relDescription, setRelDescription] = useState("");

  // Our relationship - Edit state
  const [isEditingRelationship, setIsEditingRelationship] = useState(false);
  const [isSavingRelationship, setIsSavingRelationship] = useState(false);
  const [relationshipFeedback, setRelationshipFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [draftRelStage, setDraftRelStage] = useState<string | null>(null);
  const [draftTogetherPrecision, setDraftTogetherPrecision] = useState<
    "day" | "month" | "year" | null
  >(null);
  const [draftTogetherYear, setDraftTogetherYear] = useState("");
  const [draftTogetherMonth, setDraftTogetherMonth] = useState<number | null>(null);
  const [draftTogetherDay, setDraftTogetherDay] = useState<number | null>(null);
  const [draftSharedInterests, setDraftSharedInterests] = useState<string[]>([]);
  const [draftRelDescription, setDraftRelDescription] = useState("");
  const [newSharedInterestInput, setNewSharedInterestInput] = useState("");

  // 6. Important dates (couple_important_dates)
  const [importantDates, setImportantDates] = useState<CoupleImportantDate[]>([]);
  const [isAddingDate, setIsAddingDate] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));
  const [dateMonth, setDateMonth] = useState(new Date().getMonth() + 1);
  const [dateDay, setDateDay] = useState(new Date().getDate());
  const [isSavingImportantDate, setIsSavingImportantDate] = useState(false);
  const [importantDatesFeedback, setImportantDatesFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Important dates - Delete confirmation dialog
  const [dateToDelete, setDateToDelete] = useState<CoupleImportantDate | null>(null);
  const [isDeletingImportantDate, setIsDeletingImportantDate] = useState(false);

  // Month & Day picker modal state (accessible selector reusable across sections)
  const [pickerModal, setPickerModal] = useState<{
    isOpen: boolean;
    title: string;
    type: "month" | "day";
    maxDays: number;
    selectedValue: number | null;
    onSelect: (val: number) => void;
  }>({
    isOpen: false,
    title: "",
    type: "month",
    maxDays: 31,
    selectedValue: null,
    onSelect: () => {},
  });

  // ----------------------------------------------------
  // DATA LOADING & FOCUS REFRESH
  // ----------------------------------------------------

  const loadAllData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setIsInitialLoading(true);
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/");
          return;
        }

        setEmail(user.email ?? "");

        // 1. Current user display name
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();

        const currentDisplayName = profile?.display_name ?? "";
        setDisplayName(currentDisplayName);
        if (!isEditingPersonal) {
          setEditedName(currentDisplayName);
        }

        // 2. Relationship space & membership
        const { data: membership } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentCoupleId = membership?.couple_id ?? null;
        setCoupleId(currentCoupleId);

        let resolvedPartnerUserId: string | null = null;
        let isPartnerConn = false;

        if (currentCoupleId) {
          const { data: members } = await supabase
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", currentCoupleId);

          const partnerMember = members?.find((m) => m.user_id !== user.id);

          if (partnerMember) {
            isPartnerConn = true;
            resolvedPartnerUserId = partnerMember.user_id;
            setPartnerConnected(true);

            const { data: pName } = await supabase.rpc(
              "get_partner_display_name"
            );
            setPartnerName(
              typeof pName === "string" ? pName.trim() || null : null
            );
          } else {
            setPartnerConnected(false);
            setPartnerName(null);

            // Check pending invite
            const { data: existingInvite } = await supabase
              .from("couple_invites")
              .select("code")
              .eq("couple_id", currentCoupleId)
              .eq("created_by", user.id)
              .eq("status", "pending")
              .gt("expires_at", new Date().toISOString())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            setInviteCode(existingInvite?.code ?? null);
          }
        } else {
          setPartnerConnected(false);
          setPartnerName(null);
          setInviteCode(null);
        }

        // 3. Own partner-visible profile (user_partner_profiles)
        const { data: ownPartnerData } = await supabase
          .from("user_partner_profiles")
          .select(
            "birth_month, birth_day, introduction, support_preferences, personality_traits, interests"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (ownPartnerData) {
          setHasOwnPartnerProfileRow(true);
          setOwnBirthMonth(ownPartnerData.birth_month);
          setOwnBirthDay(ownPartnerData.birth_day);
          setOwnIntro(ownPartnerData.introduction ?? "");
          setOwnSupport(ownPartnerData.support_preferences ?? "");
          setOwnTraits(
            Array.isArray(ownPartnerData.personality_traits)
              ? ownPartnerData.personality_traits
              : []
          );
          setOwnInterests(
            Array.isArray(ownPartnerData.interests)
              ? ownPartnerData.interests
              : []
          );
        } else {
          setHasOwnPartnerProfileRow(false);
          setOwnBirthMonth(null);
          setOwnBirthDay(null);
          setOwnIntro("");
          setOwnSupport("");
          setOwnTraits([]);
          setOwnInterests([]);
        }

        // 4. Partner's partner-visible profile (read-only)
        if (isPartnerConn && resolvedPartnerUserId) {
          const { data: partnerData } = await supabase
            .from("user_partner_profiles")
            .select(
              "birth_month, birth_day, introduction, support_preferences, personality_traits, interests"
            )
            .eq("user_id", resolvedPartnerUserId)
            .maybeSingle();

          if (partnerData) {
            setPartnerBirthMonth(partnerData.birth_month);
            setPartnerBirthDay(partnerData.birth_day);
            setPartnerIntro(partnerData.introduction ?? null);
            setPartnerSupport(partnerData.support_preferences ?? null);
            setPartnerTraits(
              Array.isArray(partnerData.personality_traits)
                ? partnerData.personality_traits
                : []
            );
            setPartnerInterests(
              Array.isArray(partnerData.interests)
                ? partnerData.interests
                : []
            );
          } else {
            setPartnerBirthMonth(null);
            setPartnerBirthDay(null);
            setPartnerIntro(null);
            setPartnerSupport(null);
            setPartnerTraits([]);
            setPartnerInterests([]);
          }
        } else {
          setPartnerBirthMonth(null);
          setPartnerBirthDay(null);
          setPartnerIntro(null);
          setPartnerSupport(null);
          setPartnerTraits([]);
          setPartnerInterests([]);
        }

        // 5. Shared couple profile (couple_profiles)
        if (currentCoupleId) {
          const { data: coupleProfileData } = await supabase
            .from("couple_profiles")
            .select(
              "relationship_stage, together_since, together_since_precision, shared_interests, relationship_description"
            )
            .eq("couple_id", currentCoupleId)
            .maybeSingle();

          if (coupleProfileData) {
            setHasCoupleProfileRow(true);
            setRelStage(coupleProfileData.relationship_stage);
            setTogetherSince(coupleProfileData.together_since);
            setTogetherSincePrecision(
              coupleProfileData.together_since_precision as
                | "day"
                | "month"
                | "year"
                | null
            );
            setSharedInterests(
              Array.isArray(coupleProfileData.shared_interests)
                ? coupleProfileData.shared_interests
                : []
            );
            setRelDescription(
              coupleProfileData.relationship_description ?? ""
            );
          } else {
            setHasCoupleProfileRow(false);
            setRelStage(null);
            setTogetherSince(null);
            setTogetherSincePrecision(null);
            setSharedInterests([]);
            setRelDescription("");
          }

          // 6. Important dates (couple_important_dates)
          const { data: datesData } = await supabase
            .from("couple_important_dates")
            .select(
              "id, couple_id, label, event_date, created_by, created_at, updated_at"
            )
            .eq("couple_id", currentCoupleId)
            .order("event_date", { ascending: true });

          setImportantDates(datesData ?? []);
        } else {
          setHasCoupleProfileRow(false);
          setRelStage(null);
          setTogetherSince(null);
          setTogetherSincePrecision(null);
          setSharedInterests([]);
          setRelDescription("");
          setImportantDates([]);
        }
      } catch (err) {
        console.error("Error loading profile screen:", err);
      } finally {
        if (isInitial) {
          setIsInitialLoading(false);
        }
      }
    },
    [isEditingPersonal, router]
  );

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        void loadAllData(true);
      } else {
        void loadAllData(false);
      }
    }, [loadAllData])
  );

  // ----------------------------------------------------
  // ACTIONS: PERSONAL DETAILS
  // ----------------------------------------------------

  function startEditingPersonal() {
    setEditedName(displayName);
    setIsEditingPersonal(true);
    setPersonalFeedback(null);
  }

  function cancelEditingPersonal() {
    setEditedName(displayName);
    setIsEditingPersonal(false);
    setPersonalFeedback(null);
  }

  async function savePersonalName() {
    const cleanName = editedName.trim();
    if (!cleanName) {
      setPersonalFeedback({
        type: "error",
        text: "Please enter a preferred name.",
      });
      return;
    }

    if (isSavingPersonal) return;
    setIsSavingPersonal(true);
    setPersonalFeedback(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPersonalFeedback({
          type: "error",
          text: "Please sign in again.",
        });
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      setDisplayName(cleanName);
      setEditedName(cleanName);
      setIsEditingPersonal(false);
      setPersonalFeedback({
        type: "success",
        text: "Preferred name saved.",
      });
      void refreshIdentity();
    } catch (err: any) {
      console.error(err);
      setPersonalFeedback({
        type: "error",
        text: "Could not save your name. Please try again.",
      });
    } finally {
      setIsSavingPersonal(false);
    }
  }

  // ----------------------------------------------------
  // ACTIONS: WHAT I SHARE WITH MY PARTNER
  // ----------------------------------------------------

  function startEditingPartnerProfile() {
    setDraftBirthMonth(ownBirthMonth);
    setDraftBirthDay(ownBirthDay);
    setDraftIntro(ownIntro);
    setDraftSupport(ownSupport);
    setDraftTraits([...ownTraits]);
    setDraftInterests([...ownInterests]);
    setNewTraitInput("");
    setNewInterestInput("");
    setPartnerProfileFeedback(null);
    setIsEditingPartnerProfile(true);
  }

  function cancelEditingPartnerProfile() {
    setIsEditingPartnerProfile(false);
    setPartnerProfileFeedback(null);
  }

  async function saveWhatIShare() {
    if (isSavingPartnerProfile) return;

    // Birthday validation: both or neither
    if (
      (draftBirthMonth !== null && draftBirthDay === null) ||
      (draftBirthMonth === null && draftBirthDay !== null)
    ) {
      setPartnerProfileFeedback({
        type: "error",
        text: "Please select both a month and a day, or remove the birthday.",
      });
      return;
    }

    if (draftBirthMonth !== null && draftBirthDay !== null) {
      const maxDays = getDaysInMonth(draftBirthMonth);
      if (draftBirthDay > maxDays) {
        setPartnerProfileFeedback({
          type: "error",
          text: `The selected month only has ${maxDays} days.`,
        });
        return;
      }
    }

    const cleanIntro = draftIntro.trim() || null;
    if (cleanIntro && cleanIntro.length > 300) {
      setPartnerProfileFeedback({
        type: "error",
        text: "Introduction must be 300 characters or fewer.",
      });
      return;
    }

    const cleanSupport = draftSupport.trim() || null;
    if (cleanSupport && cleanSupport.length > 300) {
      setPartnerProfileFeedback({
        type: "error",
        text: "Support preferences must be 300 characters or fewer.",
      });
      return;
    }

    const normTraits = normalizeTags(draftTraits);
    const normInterests = normalizeTags(draftInterests);

    setIsSavingPartnerProfile(true);
    setPartnerProfileFeedback(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in again.");
      }

      const editablePayload = {
        birth_month: draftBirthMonth,
        birth_day: draftBirthDay,
        introduction: cleanIntro,
        support_preferences: cleanSupport,
        personality_traits: normTraits,
        interests: normInterests,
      };

      if (hasOwnPartnerProfileRow) {
        const { error: updateError } = await supabase
          .from("user_partner_profiles")
          .update(editablePayload)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_partner_profiles")
          .insert({
            user_id: user.id,
            ...editablePayload,
          });

        if (insertError) {
          // Concurrent insert conflict fallback
          if (
            insertError.code === "23505" ||
            insertError.message?.includes("duplicate")
          ) {
            const { error: retryUpdateError } = await supabase
              .from("user_partner_profiles")
              .update(editablePayload)
              .eq("user_id", user.id);

            if (retryUpdateError) throw retryUpdateError;
          } else {
            throw insertError;
          }
        }
        setHasOwnPartnerProfileRow(true);
      }

      setOwnBirthMonth(draftBirthMonth);
      setOwnBirthDay(draftBirthDay);
      setOwnIntro(cleanIntro ?? "");
      setOwnSupport(cleanSupport ?? "");
      setOwnTraits(normTraits);
      setOwnInterests(normInterests);
      setIsEditingPartnerProfile(false);
      setPartnerProfileFeedback({
        type: "success",
        text: "What you share with your partner has been saved.",
      });
    } catch (err: any) {
      console.error(err);
      setPartnerProfileFeedback({
        type: "error",
        text: "Could not save your shared details. Please try again.",
      });
    } finally {
      setIsSavingPartnerProfile(false);
    }
  }

  // ----------------------------------------------------
  // ACTIONS: OUR RELATIONSHIP
  // ----------------------------------------------------

  function startEditingRelationship() {
    setDraftRelStage(relStage);
    setDraftTogetherPrecision(togetherSincePrecision);

    if (togetherSince) {
      const parts = togetherSince.split("-");
      setDraftTogetherYear(parts[0] || "");
      setDraftTogetherMonth(parts[1] ? parseInt(parts[1], 10) : null);
      setDraftTogetherDay(parts[2] ? parseInt(parts[2], 10) : null);
    } else {
      setDraftTogetherYear("");
      setDraftTogetherMonth(null);
      setDraftTogetherDay(null);
    }

    setDraftSharedInterests([...sharedInterests]);
    setDraftRelDescription(relDescription);
    setNewSharedInterestInput("");
    setRelationshipFeedback(null);
    setIsEditingRelationship(true);
  }

  function cancelEditingRelationship() {
    setIsEditingRelationship(false);
    setRelationshipFeedback(null);
  }

  async function saveOurRelationship() {
    if (isSavingRelationship || !coupleId) return;

    let parsedDate: string | null = null;
    const precision = draftTogetherPrecision;

    if (precision) {
      const yearNum = parseInt(draftTogetherYear.trim(), 10);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();

      if (
        !yearNum ||
        isNaN(yearNum) ||
        yearNum < 1900 ||
        yearNum > currentYear
      ) {
        setRelationshipFeedback({
          type: "error",
          text: `Please enter a valid year between 1900 and ${currentYear}.`,
        });
        return;
      }

      if (precision === "year") {
        parsedDate = `${yearNum}-01-01`;
      } else if (precision === "month") {
        if (!draftTogetherMonth || draftTogetherMonth < 1 || draftTogetherMonth > 12) {
          setRelationshipFeedback({
            type: "error",
            text: "Please select a month.",
          });
          return;
        }

        if (yearNum === currentYear && draftTogetherMonth > currentMonth) {
          setRelationshipFeedback({
            type: "error",
            text: "Together-since date cannot be in the future.",
          });
          return;
        }

        const mm = String(draftTogetherMonth).padStart(2, "0");
        parsedDate = `${yearNum}-${mm}-01`;
      } else if (precision === "day") {
        if (!draftTogetherMonth || !draftTogetherDay) {
          setRelationshipFeedback({
            type: "error",
            text: "Please select both a month and a day.",
          });
          return;
        }

        const maxDays = getDaysInMonth(draftTogetherMonth, yearNum);
        if (draftTogetherDay > maxDays) {
          setRelationshipFeedback({
            type: "error",
            text: `Selected month only has ${maxDays} days.`,
          });
          return;
        }

        if (
          yearNum === currentYear &&
          (draftTogetherMonth > currentMonth ||
            (draftTogetherMonth === currentMonth &&
              draftTogetherDay > currentDay))
        ) {
          setRelationshipFeedback({
            type: "error",
            text: "Together-since date cannot be in the future.",
          });
          return;
        }

        const mm = String(draftTogetherMonth).padStart(2, "0");
        const dd = String(draftTogetherDay).padStart(2, "0");
        parsedDate = `${yearNum}-${mm}-${dd}`;
      }
    }

    const cleanDesc = draftRelDescription.trim() || null;
    if (cleanDesc && cleanDesc.length > 500) {
      setRelationshipFeedback({
        type: "error",
        text: "Relationship description must be 500 characters or fewer.",
      });
      return;
    }

    const normSharedInterests = normalizeTags(draftSharedInterests);

    setIsSavingRelationship(true);
    setRelationshipFeedback(null);

    try {
      const editablePayload = {
        relationship_stage: draftRelStage || null,
        together_since: parsedDate,
        together_since_precision: precision || null,
        shared_interests: normSharedInterests,
        relationship_description: cleanDesc,
      };

      if (hasCoupleProfileRow) {
        const { error: updateError } = await supabase
          .from("couple_profiles")
          .update(editablePayload)
          .eq("couple_id", coupleId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("couple_profiles")
          .insert({
            couple_id: coupleId,
            ...editablePayload,
          });

        if (insertError) {
          if (
            insertError.code === "23505" ||
            insertError.message?.includes("duplicate")
          ) {
            const { error: retryUpdateError } = await supabase
              .from("couple_profiles")
              .update(editablePayload)
              .eq("couple_id", coupleId);

            if (retryUpdateError) throw retryUpdateError;
          } else {
            throw insertError;
          }
        }
        setHasCoupleProfileRow(true);
      }

      setRelStage(draftRelStage || null);
      setTogetherSince(parsedDate);
      setTogetherSincePrecision(precision || null);
      setSharedInterests(normSharedInterests);
      setRelDescription(cleanDesc ?? "");
      setIsEditingRelationship(false);
      setRelationshipFeedback({
        type: "success",
        text: "Our relationship details have been saved.",
      });
    } catch (err: any) {
      console.error(err);
      setRelationshipFeedback({
        type: "error",
        text: "Could not save relationship details. Please try again.",
      });
    } finally {
      setIsSavingRelationship(false);
    }
  }

  // ----------------------------------------------------
  // ACTIONS: IMPORTANT DATES
  // ----------------------------------------------------

  function openAddDateForm() {
    setEditingDateId(null);
    setDateLabel("");
    const now = new Date();
    setDateYear(String(now.getFullYear()));
    setDateMonth(now.getMonth() + 1);
    setDateDay(now.getDate());
    setIsAddingDate(true);
    setImportantDatesFeedback(null);
  }

  function openEditDateForm(item: CoupleImportantDate) {
    setEditingDateId(item.id);
    setDateLabel(item.label);
    const parts = item.event_date.split("-");
    setDateYear(parts[0] || String(new Date().getFullYear()));
    setDateMonth(parts[1] ? parseInt(parts[1], 10) : 1);
    setDateDay(parts[2] ? parseInt(parts[2], 10) : 1);
    setIsAddingDate(true);
    setImportantDatesFeedback(null);
  }

  function cancelDateForm() {
    setIsAddingDate(false);
    setEditingDateId(null);
    setDateLabel("");
  }

  async function saveImportantDate() {
    if (isSavingImportantDate || !coupleId) return;

    const cleanLabel = dateLabel.trim();
    if (!cleanLabel || cleanLabel.length > 80) {
      setImportantDatesFeedback({
        type: "error",
        text: "Please enter a milestone label between 1 and 80 characters.",
      });
      return;
    }

    const yearNum = parseInt(dateYear.trim(), 10);
    if (!yearNum || isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      setImportantDatesFeedback({
        type: "error",
        text: "Please enter a valid 4-digit year.",
      });
      return;
    }

    if (!dateMonth || dateMonth < 1 || dateMonth > 12) {
      setImportantDatesFeedback({
        type: "error",
        text: "Please select a month.",
      });
      return;
    }

    const maxDays = getDaysInMonth(dateMonth, yearNum);
    if (!dateDay || dateDay < 1 || dateDay > maxDays) {
      setImportantDatesFeedback({
        type: "error",
        text: `Please select a valid day (1–${maxDays}).`,
      });
      return;
    }

    const mm = String(dateMonth).padStart(2, "0");
    const dd = String(dateDay).padStart(2, "0");
    const eventDateStr = `${yearNum}-${mm}-${dd}`;

    setIsSavingImportantDate(true);
    setImportantDatesFeedback(null);

    try {
      if (editingDateId) {
        const { error } = await supabase
          .from("couple_important_dates")
          .update({
            label: cleanLabel,
            event_date: eventDateStr,
          })
          .eq("id", editingDateId)
          .eq("couple_id", coupleId);

        if (error) throw error;
        setImportantDatesFeedback({
          type: "success",
          text: "Milestone date updated.",
        });
      } else {
        const { error } = await supabase
          .from("couple_important_dates")
          .insert({
            couple_id: coupleId,
            label: cleanLabel,
            event_date: eventDateStr,
          });

        if (error) throw error;
        setImportantDatesFeedback({
          type: "success",
          text: "Milestone date added.",
        });
      }

      // Refetch dates
      const { data: updatedDates } = await supabase
        .from("couple_important_dates")
        .select(
          "id, couple_id, label, event_date, created_by, created_at, updated_at"
        )
        .eq("couple_id", coupleId)
        .order("event_date", { ascending: true });

      setImportantDates(updatedDates ?? []);
      setIsAddingDate(false);
      setEditingDateId(null);
      setDateLabel("");
    } catch (err: any) {
      console.error(err);
      setImportantDatesFeedback({
        type: "error",
        text: "Could not save milestone date. Please try again.",
      });
    } finally {
      setIsSavingImportantDate(false);
    }
  }

  async function confirmDeleteImportantDate() {
    if (!dateToDelete || !coupleId || isDeletingImportantDate) return;

    setIsDeletingImportantDate(true);
    try {
      const { error } = await supabase
        .from("couple_important_dates")
        .delete()
        .eq("id", dateToDelete.id)
        .eq("couple_id", coupleId);

      if (error) throw error;

      setImportantDates((prev) =>
        prev.filter((d) => d.id !== dateToDelete.id)
      );
      setDateToDelete(null);
      setImportantDatesFeedback({
        type: "success",
        text: "Milestone date removed.",
      });
    } catch (err: any) {
      console.error(err);
      setImportantDatesFeedback({
        type: "error",
        text: "Could not remove milestone date. Please try again.",
      });
    } finally {
      setIsDeletingImportantDate(false);
    }
  }

  // ----------------------------------------------------
  // ACTIONS: CONNECTION & PAIRING
  // ----------------------------------------------------

  async function createCouple() {
    setConnectionStatus("Creating relationship space...");
    const { error } = await supabase.from("couples").insert({});

    if (error) {
      console.error(error);
      setConnectionStatus(error.message);
      return;
    }

    setInviteCode(null);
    await loadAllData(false);
    setConnectionStatus("Relationship space created.");
    void refreshIdentity();
  }

  async function createPartnerInvite() {
    if (!coupleId) {
      setConnectionStatus("Create a relationship space first.");
      return;
    }

    if (partnerConnected) {
      setConnectionStatus("Your partner is already connected.");
      return;
    }

    setConnectionStatus("Creating invitation...");

    const { data, error } = await supabase
      .from("couple_invites")
      .insert({
        couple_id: coupleId,
      })
      .select("code")
      .single();

    if (error) {
      console.error(error);
      setConnectionStatus(error.message);
      return;
    }

    setInviteCode(data.code);
    setConnectionStatus("Invitation created.");
  }

  async function acceptPartnerInvite() {
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode) {
      setConnectionStatus("Please enter an invite code.");
      return;
    }

    setConnectionStatus("Joining relationship space...");

    const { error } = await supabase.rpc("accept_couple_invite", {
      invite_code: cleanCode,
    });

    if (error) {
      console.error(error);
      setConnectionStatus(error.message);
      return;
    }

    setJoinCode("");
    await loadAllData(false);
    setConnectionStatus("Partner connected.");
    void refreshIdentity();
  }

  // ----------------------------------------------------
  // DATE / MONTH PICKER MODAL OPENER
  // ----------------------------------------------------

  function openMonthPicker(
    title: string,
    currentVal: number | null,
    onSelect: (val: number) => void
  ) {
    setPickerModal({
      isOpen: true,
      title,
      type: "month",
      maxDays: 31,
      selectedValue: currentVal,
      onSelect,
    });
  }

  function openDayPicker(
    title: string,
    currentVal: number | null,
    maxDays: number,
    onSelect: (val: number) => void
  ) {
    setPickerModal({
      isOpen: true,
      title,
      type: "day",
      maxDays,
      selectedValue: currentVal,
      onSelect,
    });
  }

  // ----------------------------------------------------
  // COMPUTED PRESENTATION VALUES
  // ----------------------------------------------------

  const userInitial =
    (displayName.trim() || email.trim() || "?")[0]?.toUpperCase() ?? "•";

  const partnerInitial =
    (partnerName?.trim() || "?")[0]?.toUpperCase() ?? "•";

  const isPartnerProfileEmpty =
    partnerBirthMonth === null &&
    partnerBirthDay === null &&
    !partnerIntro &&
    !partnerSupport &&
    partnerTraits.length === 0 &&
    partnerInterests.length === 0;

  // ----------------------------------------------------
  // INITIAL LOADING SCREEN
  // ----------------------------------------------------

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* -------------------------------------------
                1. HEADER (Full Width)
               ------------------------------------------- */}
            <CouplyHeader
              overline="YOUR SPACE"
              title="Your profile"
              subtitle="A few details about you and the space you share."
              onBack={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/settings");
                }
              }}
              backLabel="‹ Settings"
              titleStyle={{ color: theme.primaryText }}
              subtitleStyle={{ color: theme.secondaryText }}
              backTextStyle={{ color: theme.primaryAccent }}
              style={styles.headerCouply}
            />

            {/* Quick link to My Rhythm */}
            <CouplyQuietButton
              label="Go to My Rhythm"
              onPress={() => router.push("/home")}
              accessibilityLabel="Go to My Rhythm"
              variant="soft"
              style={styles.homeLinkBtnCouply}
            />

            {/* Segmented Profile Navigation Control */}
            <View style={styles.segmentControlContainer} role="tablist">
              {(
                [
                  { key: "me", label: "Me" },
                  { key: "partner", label: "Partner" },
                  { key: "us", label: "Us" },
                ] as const
              ).map(({ key, label }) => {
                const isSelected = activeProfileView === key;

                return (
                  <Pressable
                    key={key}
                    onPress={() => handleSelectProfileView(key)}
                    style={[
                      styles.segmentTab,
                      isSelected
                        ? styles.segmentTabActive
                        : styles.segmentTabInactive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${label} profile view`}
                  >
                    <Text
                      style={[
                        styles.segmentTabText,
                        isSelected
                          ? styles.segmentTabTextActive
                          : styles.segmentTabTextInactive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* General connection status feedback banner if present */}
            {connectionStatus !== "" && (
              <View
                style={styles.statusBanner}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.statusBannerText}>{connectionStatus}</Text>
              </View>
            )}

            {/* -------------------------------------------
                VIEW: ME (Personal Details + What I Share)
               ------------------------------------------- */}
            {activeProfileView === "me" && (
              <>
                {/* 2. PERSONAL DETAILS (Compact Account Summary, Full Width) */}
                <CouplySectionCard style={styles.cardCouply}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardSectionHeading}>Personal details</Text>
                <Text style={styles.privacyTag}>
                  Your account details stay yours.
                </Text>
              </View>

              {personalFeedback && (
                <View
                  style={[
                    styles.feedbackBanner,
                    personalFeedback.type === "error"
                      ? styles.feedbackBannerError
                      : styles.feedbackBannerSuccess,
                  ]}
                  accessibilityRole={
                    personalFeedback.type === "error" ? "alert" : undefined
                  }
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      personalFeedback.type === "error"
                        ? styles.feedbackTextError
                        : styles.feedbackTextSuccess,
                    ]}
                  >
                    {personalFeedback.text}
                  </Text>
                </View>
              )}

              {!isEditingPersonal ? (
                <View style={styles.profileSummaryRow}>
                  <View
                    style={styles.avatarBubble}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no"
                  >
                    <Text style={styles.avatarInitial}>{userInitial}</Text>
                  </View>

                  <View style={styles.profileInfoColumn}>
                    <Text style={styles.profileDisplayName}>
                      {displayName || "Add your name"}
                    </Text>
                    <Text style={styles.profileEmail}>{email}</Text>
                    <Text style={styles.personalPrivacyNote}>
                      Your account details stay yours.
                    </Text>
                  </View>

                  <CouplyQuietButton
                    label="Edit"
                    onPress={startEditingPersonal}
                    accessibilityLabel="Edit preferred name"
                    variant="soft"
                    style={styles.smallActionBtn}
                  />
                </View>
              ) : (
                <View style={styles.formGap}>
                  <Text style={styles.fieldLabel}>Preferred name</Text>

                  <TextInput
                    style={styles.textInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Your preferred name"
                    placeholderTextColor={theme.mutedText}
                    autoCapitalize="words"
                    autoFocus
                    maxLength={60}
                    editable={!isSavingPersonal}
                    accessibilityLabel="Preferred name"
                  />

                  <Text style={styles.helperText}>
                    This is the name your partner will see.
                  </Text>

                  <View style={styles.actionButtonsRow}>
                    <CouplyPrimaryButton
                      label={isSavingPersonal ? "Saving..." : "Save"}
                      onPress={savePersonalName}
                      disabled={
                        isSavingPersonal ||
                        !editedName.trim() ||
                        editedName.trim() === displayName
                      }
                      loading={isSavingPersonal}
                      accessibilityLabel="Save preferred name"
                      style={styles.flexButton}
                    />

                    <CouplyQuietButton
                      label="Cancel"
                      onPress={cancelEditingPersonal}
                      disabled={isSavingPersonal}
                      accessibilityLabel="Cancel editing preferred name"
                      variant="soft"
                      style={styles.flexButton}
                    />
                  </View>
                </View>
              )}
            </CouplySectionCard>

            {/* -------------------------------------------
                3. WHAT I SHARE WITH MY PARTNER
               ------------------------------------------- */}
            <CouplySectionCard style={styles.cardCouply}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.cardSectionHeading}>
                      What I share with my partner
                    </Text>
                  </View>

                  <Text style={styles.sectionPurposeText}>
                    Optional details that help your partner know and care for you.
                    Only you can edit them.
                  </Text>

                  {partnerConnected ? (
                    <View style={styles.privacyNoticeCard}>
                      <Text style={styles.privacyNoticeText}>
                        Visible to {partnerName || "your partner"}. Private
                        reflections are never included.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.privacyNoticeCard}>
                      <Text style={styles.privacyNoticeText}>
                        These details stay ready for you and will only become
                        visible after you connect with a partner.
                      </Text>
                    </View>
                  )}

                  <Text style={styles.optionalHelperText}>
                    Everything in this section is optional.
                  </Text>

                  {partnerProfileFeedback && (
                    <View
                      style={[
                        styles.feedbackBanner,
                        partnerProfileFeedback.type === "error"
                          ? styles.feedbackBannerError
                          : styles.feedbackBannerSuccess,
                      ]}
                      accessibilityRole={
                        partnerProfileFeedback.type === "error"
                          ? "alert"
                          : undefined
                      }
                    >
                      <Text
                        style={[
                          styles.feedbackText,
                          partnerProfileFeedback.type === "error"
                            ? styles.feedbackTextError
                            : styles.feedbackTextSuccess,
                        ]}
                      >
                        {partnerProfileFeedback.text}
                      </Text>
                    </View>
                  )}

                  {!isEditingPartnerProfile ? (
                    <View style={styles.contentColumn}>
                      {/* Birthday display */}
                      <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>Birthday</Text>
                        <Text style={styles.detailValue}>
                          {formatBirthday(ownBirthMonth, ownBirthDay) ||
                            "Not added"}
                        </Text>
                      </View>

                      <View style={styles.divider} />

                      {/* Introduction display */}
                      <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>
                          Short introduction
                        </Text>
                        <Text style={styles.detailValue}>
                          {ownIntro || "Not added"}
                        </Text>
                      </View>

                      <View style={styles.divider} />

                      {/* Support preferences display */}
                      <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>
                          How I prefer to receive support
                        </Text>
                        <Text style={styles.detailValue}>
                          {ownSupport || "Not added"}
                        </Text>
                      </View>

                      <View style={styles.divider} />

                      {/* Personality traits display */}
                      <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>
                          Personality traits
                        </Text>
                        {ownTraits.length > 0 ? (
                          <View style={styles.chipsRow}>
                            {ownTraits.map((trait) => (
                              <View key={trait} style={styles.readOnlyChip}>
                                <Text style={styles.readOnlyChipText}>
                                  {trait}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.detailValue}>Not added</Text>
                        )}
                      </View>

                      <View style={styles.divider} />

                      {/* Interests display */}
                      <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>
                          Interests & hobbies
                        </Text>
                        {ownInterests.length > 0 ? (
                          <View style={styles.chipsRow}>
                            {ownInterests.map((interest) => (
                              <View key={interest} style={styles.readOnlyChip}>
                                <Text style={styles.readOnlyChipText}>
                                  {interest}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.detailValue}>Not added</Text>
                        )}
                      </View>

                      <CouplyQuietButton
                        label="Edit what I share"
                        onPress={startEditingPartnerProfile}
                        accessibilityLabel="Edit what I share with my partner"
                        variant="soft"
                        style={styles.alignSelfStart}
                      />
                    </View>
                  ) : (
                    <View style={styles.formGap}>
                      {/* Birthday picker controls */}
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Birthday</Text>
                        <Text style={styles.helperText}>
                          Month and day only; year and age are never requested
                          or shown.
                        </Text>

                        <View style={styles.dateSelectorRow}>
                          <Pressable
                            style={styles.selectorButton}
                            onPress={() =>
                              openMonthPicker(
                                "Select birth month",
                                draftBirthMonth,
                                (m) => {
                                  setDraftBirthMonth(m);
                                  if (draftBirthDay) {
                                    const maxD = getDaysInMonth(m);
                                    if (draftBirthDay > maxD) {
                                      setDraftBirthDay(maxD);
                                    }
                                  }
                                }
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={
                              draftBirthMonth
                                ? `Month: ${MONTH_NAMES[draftBirthMonth - 1]}`
                                : "Choose month"
                            }
                          >
                            <Text style={styles.selectorButtonText}>
                              {draftBirthMonth
                                ? MONTH_NAMES[draftBirthMonth - 1]
                                : "Choose month"}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.selectorButton}
                            onPress={() => {
                              const maxD = getDaysInMonth(
                                draftBirthMonth || 1
                              );
                              openDayPicker(
                                "Select birth day",
                                draftBirthDay,
                                maxD,
                                (d) => setDraftBirthDay(d)
                              );
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={
                              draftBirthDay
                                ? `Day: ${draftBirthDay}`
                                : "Choose day"
                            }
                          >
                            <Text style={styles.selectorButtonText}>
                              {draftBirthDay
                                ? `Day ${draftBirthDay}`
                                : "Choose day"}
                            </Text>
                          </Pressable>

                          {(draftBirthMonth !== null ||
                            draftBirthDay !== null) && (
                            <CouplyQuietButton
                              label="Remove"
                              onPress={() => {
                                setDraftBirthMonth(null);
                                setDraftBirthDay(null);
                              }}
                              accessibilityLabel="Remove birthday"
                              variant="soft"
                              style={styles.removeDateBtn}
                            />
                          )}
                        </View>
                      </View>

                      {/* Introduction input */}
                      <View style={styles.fieldBlock}>
                        <View style={styles.fieldLabelRow}>
                          <Text style={styles.fieldLabel}>
                            Short introduction
                          </Text>
                          <Text style={styles.counterText}>
                            {draftIntro.length}/300
                          </Text>
                        </View>
                        <TextInput
                          style={styles.textArea}
                          value={draftIntro}
                          onChangeText={setDraftIntro}
                          placeholder="A short note about where you are right now"
                          placeholderTextColor={theme.mutedText}
                          multiline
                          maxLength={300}
                          accessibilityLabel="Short introduction"
                        />
                      </View>

                      {/* Support preferences input */}
                      <View style={styles.fieldBlock}>
                        <View style={styles.fieldLabelRow}>
                          <Text style={styles.fieldLabel}>
                            How I prefer to receive support
                          </Text>
                          <Text style={styles.counterText}>
                            {draftSupport.length}/300
                          </Text>
                        </View>
                        <TextInput
                          style={styles.textArea}
                          value={draftSupport}
                          onChangeText={setDraftSupport}
                          placeholder="What helps when you're overwhelmed, tired, or quiet"
                          placeholderTextColor={theme.mutedText}
                          multiline
                          maxLength={300}
                          accessibilityLabel="How I prefer to receive support"
                        />
                      </View>

                      {/* Personality traits tag editor */}
                      <View style={styles.fieldBlock}>
                        <View style={styles.fieldLabelRow}>
                          <Text style={styles.fieldLabel}>
                            Personality traits
                          </Text>
                          <Text style={styles.counterText}>
                            {draftTraits.length}/12 tags
                          </Text>
                        </View>
                        <Text style={styles.helperText}>
                          Choose from suggestions or write your own (max 40
                          chars each).
                        </Text>

                        {draftTraits.length > 0 && (
                          <View style={styles.chipsRow}>
                            {draftTraits.map((trait) => (
                              <View key={trait} style={styles.editableChip}>
                                <Text style={styles.editableChipText}>
                                  {trait}
                                </Text>
                                <Pressable
                                  style={styles.chipRemovePressable}
                                  onPress={() =>
                                    setDraftTraits((prev) =>
                                      prev.filter((t) => t !== trait)
                                    )
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove trait ${trait}`}
                                >
                                  <Text style={styles.chipRemoveText}>✕</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}

                        {draftTraits.length < 12 && (
                          <>
                            <View style={styles.tagInputRow}>
                              <TextInput
                                style={styles.tagInput}
                                value={newTraitInput}
                                onChangeText={setNewTraitInput}
                                placeholder="Add personality trait"
                                placeholderTextColor={theme.mutedText}
                                maxLength={40}
                                accessibilityLabel="Add personality trait"
                                onSubmitEditing={() => {
                                  const trimmed = newTraitInput.trim();
                                  if (trimmed) {
                                    setDraftTraits((prev) =>
                                      normalizeTags([...prev, trimmed])
                                    );
                                    setNewTraitInput("");
                                  }
                                }}
                              />
                              <CouplyQuietButton
                                label="Add"
                                onPress={() => {
                                  const trimmed = newTraitInput.trim();
                                  if (trimmed) {
                                    setDraftTraits((prev) =>
                                      normalizeTags([...prev, trimmed])
                                    );
                                    setNewTraitInput("");
                                  }
                                }}
                                disabled={!newTraitInput.trim()}
                                accessibilityLabel="Add trait"
                                variant="soft"
                                style={styles.tagAddBtn}
                              />
                            </View>

                            <View style={styles.presetsBlock}>
                              <Text style={styles.presetLabel}>
                                Suggestions:
                              </Text>
                              <View style={styles.chipsRow}>
                                {PERSONALITY_PRESETS.filter(
                                  (p) =>
                                    !draftTraits.some(
                                      (t) =>
                                        t.toLowerCase() === p.toLowerCase()
                                    )
                                ).map((preset) => (
                                  <Pressable
                                    key={preset}
                                    style={styles.presetChip}
                                    onPress={() =>
                                      setDraftTraits((prev) =>
                                        normalizeTags([...prev, preset])
                                      )
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Add suggestion ${preset}`}
                                  >
                                    <Text style={styles.presetChipText}>
                                      + {preset}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </>
                        )}
                      </View>

                      {/* Interests tag editor */}
                      <View style={styles.fieldBlock}>
                        <View style={styles.fieldLabelRow}>
                          <Text style={styles.fieldLabel}>
                            Interests & hobbies
                          </Text>
                          <Text style={styles.counterText}>
                            {draftInterests.length}/12 tags
                          </Text>
                        </View>
                        <Text style={styles.helperText}>
                          Things you enjoy doing or exploring (max 40 chars each).
                        </Text>

                        {draftInterests.length > 0 && (
                          <View style={styles.chipsRow}>
                            {draftInterests.map((interest) => (
                              <View key={interest} style={styles.editableChip}>
                                <Text style={styles.editableChipText}>
                                  {interest}
                                </Text>
                                <Pressable
                                  style={styles.chipRemovePressable}
                                  onPress={() =>
                                    setDraftInterests((prev) =>
                                      prev.filter((i) => i !== interest)
                                    )
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove interest ${interest}`}
                                >
                                  <Text style={styles.chipRemoveText}>✕</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}

                        {draftInterests.length < 12 && (
                          <>
                            <View style={styles.tagInputRow}>
                              <TextInput
                                style={styles.tagInput}
                                value={newInterestInput}
                                onChangeText={setNewInterestInput}
                                placeholder="Add interest"
                                placeholderTextColor={theme.mutedText}
                                maxLength={40}
                                accessibilityLabel="Add interest"
                                onSubmitEditing={() => {
                                  const trimmed = newInterestInput.trim();
                                  if (trimmed) {
                                    setDraftInterests((prev) =>
                                      normalizeTags([...prev, trimmed])
                                    );
                                    setNewInterestInput("");
                                  }
                                }}
                              />
                              <CouplyQuietButton
                                label="Add"
                                onPress={() => {
                                  const trimmed = newInterestInput.trim();
                                  if (trimmed) {
                                    setDraftInterests((prev) =>
                                      normalizeTags([...prev, trimmed])
                                    );
                                    setNewInterestInput("");
                                  }
                                }}
                                disabled={!newInterestInput.trim()}
                                accessibilityLabel="Add interest"
                                variant="soft"
                                style={styles.tagAddBtn}
                              />
                            </View>

                            <View style={styles.presetsBlock}>
                              <Text style={styles.presetLabel}>
                                Suggestions:
                              </Text>
                              <View style={styles.chipsRow}>
                                {INTEREST_PRESETS.filter(
                                  (p) =>
                                    !draftInterests.some(
                                      (i) =>
                                        i.toLowerCase() === p.toLowerCase()
                                    )
                                ).map((preset) => (
                                  <Pressable
                                    key={preset}
                                    style={styles.presetChip}
                                    onPress={() =>
                                      setDraftInterests((prev) =>
                                        normalizeTags([...prev, preset])
                                      )
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Add suggestion ${preset}`}
                                  >
                                    <Text style={styles.presetChipText}>
                                      + {preset}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </>
                        )}
                      </View>

                      {/* Actions */}
                      <View style={styles.actionButtonsRow}>
                        <CouplyPrimaryButton
                          label={
                            isSavingPartnerProfile
                              ? "Saving..."
                              : "Save what I share"
                          }
                          onPress={saveWhatIShare}
                          disabled={isSavingPartnerProfile}
                          loading={isSavingPartnerProfile}
                          accessibilityLabel="Save what I share"
                          style={styles.flexButton}
                        />

                        <CouplyQuietButton
                          label="Cancel"
                          onPress={cancelEditingPartnerProfile}
                          disabled={isSavingPartnerProfile}
                          accessibilityLabel="Cancel editing what I share"
                          variant="soft"
                          style={styles.flexButton}
                        />
                      </View>
                    </View>
                  )}
                </CouplySectionCard>
              </>
            )}

            {/* -------------------------------------------
                VIEW: PARTNER (About Partner - Read Only)
               ------------------------------------------- */}
            {activeProfileView === "partner" && (
              <CouplySectionCard
                style={[styles.cardCouply, styles.partnerCard]}
              >
                  {/* Compact Identity Header */}
                  <View style={styles.partnerIdentityHeader}>
                    <View
                      style={styles.avatarBubblePartner}
                      accessibilityElementsHidden={true}
                      importantForAccessibility="no"
                    >
                      <Text style={styles.avatarInitial}>{partnerInitial}</Text>
                    </View>
                    <View style={styles.partnerHeaderTextCol}>
                      <Text
                        style={styles.cardSectionHeading}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        accessibilityLabel={`About ${partnerName || "your partner"}`}
                      >
                        About {partnerName || "your partner"}
                      </Text>
                      <Text style={styles.sharedByLabel}>
                        Shared by {partnerName || "your partner"}
                      </Text>
                    </View>
                  </View>

                  {partnerConnected ? (
                    <View style={styles.contentColumn}>
                      <Text style={styles.sectionPurposeText}>
                        Details your partner has chosen to share with you.
                      </Text>

                      {isPartnerProfileEmpty ? (
                        <View style={styles.emptyCardContainer}>
                          <Text style={styles.emptyCardText}>
                            {partnerName || "Your partner"} hasn’t added any
                            shared details yet.
                          </Text>
                        </View>
                      ) : (
                        <>
                          {partnerBirthMonth && partnerBirthDay ? (
                            <>
                              <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>Birthday</Text>
                                <Text style={styles.detailValue}>
                                  {formatBirthday(
                                    partnerBirthMonth,
                                    partnerBirthDay
                                  )}
                                </Text>
                              </View>
                              <View style={styles.divider} />
                            </>
                          ) : null}

                          {partnerIntro ? (
                            <>
                              <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>
                                  Introduction
                                </Text>
                                <Text style={styles.detailValue}>
                                  {partnerIntro}
                                </Text>
                              </View>
                              <View style={styles.divider} />
                            </>
                          ) : null}

                          {partnerSupport ? (
                            <>
                              <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>
                                  How they prefer to receive support
                                </Text>
                                <Text style={styles.detailValue}>
                                  {partnerSupport}
                                </Text>
                              </View>
                              <View style={styles.divider} />
                            </>
                          ) : null}

                          {partnerTraits.length > 0 ? (
                            <>
                              <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>
                                  Personality traits
                                </Text>
                                <View style={styles.chipsRow}>
                                  {partnerTraits.map((trait) => (
                                    <View
                                      key={trait}
                                      style={styles.readOnlyChip}
                                    >
                                      <Text style={styles.readOnlyChipText}>
                                        {trait}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                              {partnerInterests.length > 0 && (
                                <View style={styles.divider} />
                              )}
                            </>
                          ) : null}

                          {partnerInterests.length > 0 ? (
                            <View style={styles.detailBlock}>
                              <Text style={styles.detailLabel}>
                                Interests & hobbies
                              </Text>
                              <View style={styles.chipsRow}>
                                {partnerInterests.map((interest) => (
                                  <View
                                    key={interest}
                                    style={styles.readOnlyChip}
                                  >
                                    <Text style={styles.readOnlyChipText}>
                                      {interest}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyCardContainer}>
                      <Text style={styles.emptyCardText}>
                        Connect with a partner to see the details they choose
                        to share.
                      </Text>
                    </View>
                  )}
                </CouplySectionCard>
            )}

            {/* -------------------------------------------
                VIEW: US (Our Relationship + Important Dates + Relationship Space)
               ------------------------------------------- */}
            {activeProfileView === "us" &&
              (() => {
                const ourRelationshipCard = (
                  <CouplySectionCard style={styles.cardCouply}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.cardSectionHeading}>
                        Our relationship
                      </Text>
                    <Text style={styles.privacyTag}>
                      Shared in your relationship space.
                    </Text>
                  </View>

                  <Text style={styles.sectionPurposeText}>
                    Shared details that either of you can gently keep up to date.
                  </Text>

                  {coupleId ? (
                    <>
                      {relationshipFeedback && (
                        <View
                          style={[
                            styles.feedbackBanner,
                            relationshipFeedback.type === "error"
                              ? styles.feedbackBannerError
                              : styles.feedbackBannerSuccess,
                          ]}
                          accessibilityRole={
                            relationshipFeedback.type === "error"
                              ? "alert"
                              : undefined
                          }
                        >
                          <Text
                            style={[
                              styles.feedbackText,
                              relationshipFeedback.type === "error"
                                ? styles.feedbackTextError
                                : styles.feedbackTextSuccess,
                            ]}
                          >
                            {relationshipFeedback.text}
                          </Text>
                        </View>
                      )}

                      {!isEditingRelationship ? (
                        <View style={styles.contentColumn}>
                          <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>
                              Relationship stage
                            </Text>
                            <Text style={styles.detailValue}>
                              {getStageLabel(relStage)}
                            </Text>
                          </View>

                          <View style={styles.divider} />

                          <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>Together since</Text>
                            <Text style={styles.detailValue}>
                              {formatTogetherSince(
                                togetherSince,
                                togetherSincePrecision
                              )}
                            </Text>
                          </View>

                          <View style={styles.divider} />

                          <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>
                              Shared interests
                            </Text>
                            {sharedInterests.length > 0 ? (
                              <View style={styles.chipsRow}>
                                {sharedInterests.map((interest) => (
                                  <View
                                    key={interest}
                                    style={styles.readOnlyChip}
                                  >
                                    <Text style={styles.readOnlyChipText}>
                                      {interest}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.detailValue}>Not added</Text>
                            )}
                          </View>

                          <View style={styles.divider} />

                          <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>
                              A little about us
                            </Text>
                            <Text style={styles.detailValue}>
                              {relDescription || "Not added"}
                            </Text>
                          </View>

                          <CouplyQuietButton
                            label="Edit relationship details"
                            onPress={startEditingRelationship}
                            accessibilityLabel="Edit relationship details"
                            variant="soft"
                            style={styles.alignSelfStart}
                          />
                        </View>
                      ) : (
                        <View style={styles.formGap}>
                          {/* Relationship stage choice selector */}
                          <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>
                              Relationship stage
                            </Text>
                            <View style={styles.chipsRow}>
                              <Pressable
                                style={[
                                  styles.choiceChip,
                                  draftRelStage === null &&
                                    styles.choiceChipSelected,
                                ]}
                                onPress={() => setDraftRelStage(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Relationship stage: Not specified"
                                accessibilityState={{
                                  selected: draftRelStage === null,
                                }}
                              >
                                <Text
                                  style={[
                                    styles.choiceChipText,
                                    draftRelStage === null &&
                                      styles.choiceChipTextSelected,
                                  ]}
                                >
                                  Not specified
                                </Text>
                              </Pressable>

                              {RELATIONSHIP_STAGES.map((s) => {
                                const isSelected = draftRelStage === s.value;
                                return (
                                  <Pressable
                                    key={s.value}
                                    style={[
                                      styles.choiceChip,
                                      isSelected && styles.choiceChipSelected,
                                    ]}
                                    onPress={() => setDraftRelStage(s.value)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Relationship stage: ${s.label}`}
                                    accessibilityState={{
                                      selected: isSelected,
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.choiceChipText,
                                        isSelected &&
                                          styles.choiceChipTextSelected,
                                      ]}
                                    >
                                      {s.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>

                          {/* Together since precision & date inputs */}
                          <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>Together since</Text>
                            <Text style={styles.helperText}>
                              Choose how precise you'd like to be. Cannot be in
                              the future.
                            </Text>

                            {/* Precision chips */}
                            <View style={styles.chipsRow}>
                              {(
                                [
                                  { val: null, label: "Not added" },
                                  { val: "year", label: "Year only" },
                                  { val: "month", label: "Month & year" },
                                  { val: "day", label: "Exact date" },
                                ] as const
                              ).map((p) => {
                                const isSelected =
                                  draftTogetherPrecision === p.val;
                                return (
                                  <Pressable
                                    key={p.label}
                                    style={[
                                      styles.choiceChip,
                                      isSelected && styles.choiceChipSelected,
                                    ]}
                                    onPress={() =>
                                      setDraftTogetherPrecision(p.val)
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Together since precision: ${p.label}`}
                                    accessibilityState={{
                                      selected: isSelected,
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.choiceChipText,
                                        isSelected &&
                                          styles.choiceChipTextSelected,
                                      ]}
                                    >
                                      {p.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>

                            {/* Date fields based on chosen precision */}
                            {draftTogetherPrecision !== null && (
                              <View style={styles.dateSelectorRow}>
                                <View style={styles.yearInputWrap}>
                                  <Text style={styles.miniLabel}>Year</Text>
                                  <TextInput
                                    style={styles.yearInput}
                                    value={draftTogetherYear}
                                    onChangeText={setDraftTogetherYear}
                                    placeholder="YYYY"
                                    placeholderTextColor={theme.mutedText}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    accessibilityLabel="Together since year"
                                  />
                                </View>

                                {(draftTogetherPrecision === "month" ||
                                  draftTogetherPrecision === "day") && (
                                  <View style={styles.selectorCol}>
                                    <Text style={styles.miniLabel}>Month</Text>
                                    <Pressable
                                      style={styles.selectorButton}
                                      onPress={() =>
                                        openMonthPicker(
                                          "Select anniversary month",
                                          draftTogetherMonth,
                                          (m) => {
                                            setDraftTogetherMonth(m);
                                            if (draftTogetherDay) {
                                              const yearNum =
                                                parseInt(
                                                  draftTogetherYear,
                                                  10
                                                ) || 2024;
                                              const maxD = getDaysInMonth(
                                                m,
                                                yearNum
                                              );
                                              if (draftTogetherDay > maxD) {
                                                setDraftTogetherDay(maxD);
                                              }
                                            }
                                          }
                                        )
                                      }
                                      accessibilityRole="button"
                                      accessibilityLabel={
                                        draftTogetherMonth
                                          ? `Month: ${MONTH_NAMES[draftTogetherMonth - 1]}`
                                          : "Choose month"
                                      }
                                    >
                                      <Text style={styles.selectorButtonText}>
                                        {draftTogetherMonth
                                          ? MONTH_NAMES[draftTogetherMonth - 1]
                                          : "Choose month"}
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}

                                {draftTogetherPrecision === "day" && (
                                  <View style={styles.selectorCol}>
                                    <Text style={styles.miniLabel}>Day</Text>
                                    <Pressable
                                      style={styles.selectorButton}
                                      onPress={() => {
                                        const yearNum =
                                          parseInt(draftTogetherYear, 10) ||
                                          2024;
                                        const maxD = getDaysInMonth(
                                          draftTogetherMonth || 1,
                                          yearNum
                                        );
                                        openDayPicker(
                                          "Select anniversary day",
                                          draftTogetherDay,
                                          maxD,
                                          (d) => setDraftTogetherDay(d)
                                        );
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={
                                        draftTogetherDay
                                          ? `Day: ${draftTogetherDay}`
                                          : "Choose day"
                                      }
                                    >
                                      <Text style={styles.selectorButtonText}>
                                        {draftTogetherDay
                                          ? `Day ${draftTogetherDay}`
                                          : "Choose day"}
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Shared interests tag editor */}
                          <View style={styles.fieldBlock}>
                            <View style={styles.fieldLabelRow}>
                              <Text style={styles.fieldLabel}>
                                Shared interests
                              </Text>
                              <Text style={styles.counterText}>
                                {draftSharedInterests.length}/12 tags
                              </Text>
                            </View>
                            <Text style={styles.helperText}>
                              Things you love doing together (max 40 chars each).
                            </Text>

                            {draftSharedInterests.length > 0 && (
                              <View style={styles.chipsRow}>
                                {draftSharedInterests.map((interest) => (
                                  <View
                                    key={interest}
                                    style={styles.editableChip}
                                  >
                                    <Text style={styles.editableChipText}>
                                      {interest}
                                    </Text>
                                    <Pressable
                                      style={styles.chipRemovePressable}
                                      onPress={() =>
                                        setDraftSharedInterests((prev) =>
                                          prev.filter((i) => i !== interest)
                                        )
                                      }
                                      accessibilityRole="button"
                                      accessibilityLabel={`Remove shared interest ${interest}`}
                                    >
                                      <Text style={styles.chipRemoveText}>
                                        ✕
                                      </Text>
                                    </Pressable>
                                  </View>
                                ))}
                              </View>
                            )}

                            {draftSharedInterests.length < 12 && (
                              <>
                                <View style={styles.tagInputRow}>
                                  <TextInput
                                    style={styles.tagInput}
                                    value={newSharedInterestInput}
                                    onChangeText={setNewSharedInterestInput}
                                    placeholder="Add shared interest"
                                    placeholderTextColor={theme.mutedText}
                                    maxLength={40}
                                    accessibilityLabel="Add shared interest"
                                    onSubmitEditing={() => {
                                      const trimmed =
                                        newSharedInterestInput.trim();
                                      if (trimmed) {
                                        setDraftSharedInterests((prev) =>
                                          normalizeTags([...prev, trimmed])
                                        );
                                        setNewSharedInterestInput("");
                                      }
                                    }}
                                  />
                                  <CouplyQuietButton
                                    label="Add"
                                    onPress={() => {
                                      const trimmed =
                                        newSharedInterestInput.trim();
                                      if (trimmed) {
                                        setDraftSharedInterests((prev) =>
                                          normalizeTags([...prev, trimmed])
                                        );
                                        setNewSharedInterestInput("");
                                      }
                                    }}
                                    disabled={!newSharedInterestInput.trim()}
                                    accessibilityLabel="Add shared interest"
                                    variant="soft"
                                    style={styles.tagAddBtn}
                                  />
                                </View>

                                <View style={styles.presetsBlock}>
                                  <Text style={styles.presetLabel}>
                                    Suggestions:
                                  </Text>
                                  <View style={styles.chipsRow}>
                                    {INTEREST_PRESETS.filter(
                                      (p) =>
                                        !draftSharedInterests.some(
                                          (i) =>
                                            i.toLowerCase() ===
                                            p.toLowerCase()
                                        )
                                    ).map((preset) => (
                                      <Pressable
                                        key={preset}
                                        style={styles.presetChip}
                                        onPress={() =>
                                          setDraftSharedInterests((prev) =>
                                            normalizeTags([...prev, preset])
                                          )
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`Add suggestion ${preset}`}
                                      >
                                        <Text style={styles.presetChipText}>
                                          + {preset}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </View>
                              </>
                            )}
                          </View>

                          {/* Relationship description */}
                          <View style={styles.fieldBlock}>
                            <View style={styles.fieldLabelRow}>
                              <Text style={styles.fieldLabel}>
                                A little about us
                              </Text>
                              <Text style={styles.counterText}>
                                {draftRelDescription.length}/500
                              </Text>
                            </View>
                            <Text style={styles.helperText}>
                              A shared note about the relationship you are
                              building together.
                            </Text>
                            <TextInput
                              style={styles.textArea}
                              value={draftRelDescription}
                              onChangeText={setDraftRelDescription}
                              placeholder="What makes your shared rhythm feel like home"
                              placeholderTextColor={theme.mutedText}
                              multiline
                              maxLength={500}
                              accessibilityLabel="A little about us"
                            />
                          </View>

                          {/* Actions */}
                          <View style={styles.actionButtonsRow}>
                            <CouplyPrimaryButton
                              label={
                                isSavingRelationship
                                  ? "Saving..."
                                  : "Save our relationship details"
                              }
                              onPress={saveOurRelationship}
                              disabled={isSavingRelationship}
                              loading={isSavingRelationship}
                              accessibilityLabel="Save our relationship details"
                              style={styles.flexButton}
                            />

                            <CouplyQuietButton
                              label="Cancel"
                              onPress={cancelEditingRelationship}
                              disabled={isSavingRelationship}
                              accessibilityLabel="Cancel editing relationship details"
                              variant="soft"
                              style={styles.flexButton}
                            />
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyCardContainer}>
                      <Text style={styles.emptyCardText}>
                        Create or join a relationship space before adding shared
                        relationship details.
                      </Text>
                    </View>
                  )}
                </CouplySectionCard>
                );

                const importantDatesCard = (
                  <CouplySectionCard
                    style={styles.cardCouply}
                    onLayout={(event) => {
                      importantDatesY.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.cardSectionHeading}>
                        Important dates
                      </Text>
                    </View>

                  <Text style={styles.sectionPurposeText}>
                    Milestones you both may want to remember.
                  </Text>

                  {coupleId ? (
                    <>
                      {importantDatesFeedback && (
                        <View
                          style={[
                            styles.feedbackBanner,
                            importantDatesFeedback.type === "error"
                              ? styles.feedbackBannerError
                              : styles.feedbackBannerSuccess,
                          ]}
                          accessibilityRole={
                            importantDatesFeedback.type === "error"
                              ? "alert"
                              : undefined
                          }
                        >
                          <Text
                            style={[
                              styles.feedbackText,
                              importantDatesFeedback.type === "error"
                                ? styles.feedbackTextError
                                : styles.feedbackTextSuccess,
                            ]}
                          >
                            {importantDatesFeedback.text}
                          </Text>
                        </View>
                      )}

                      {/* List of important dates */}
                      {importantDates.length > 0 ? (
                        <View style={styles.datesList}>
                          {importantDates.map((item) => (
                            <View key={item.id} style={styles.dateItemCard}>
                              <View style={styles.dateItemTextCol}>
                                <Text style={styles.dateItemLabel}>
                                  {item.label}
                                </Text>
                                <Text style={styles.dateItemDate}>
                                  {formatEventDate(item.event_date)}
                                </Text>
                              </View>
                              <View style={styles.dateItemActions}>
                                <CouplyQuietButton
                                  label="Edit"
                                  onPress={() => openEditDateForm(item)}
                                  accessibilityLabel={`Edit date ${item.label}`}
                                  variant="soft"
                                  style={styles.smallActionBtn}
                                />
                                <CouplyQuietButton
                                  label="Remove"
                                  onPress={() => setDateToDelete(item)}
                                  accessibilityLabel={`Remove date ${item.label}`}
                                  variant="soft"
                                  style={styles.smallActionBtn}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        !isAddingDate && (
                          <View style={styles.emptyCardContainer}>
                            <Text style={styles.emptyCardText}>
                              No important dates added yet.
                            </Text>
                          </View>
                        )
                      )}

                      {/* Add / Edit Form */}
                      {isAddingDate ? (
                        <View style={styles.dateFormCard}>
                          <Text style={styles.subHeading}>
                            {editingDateId
                              ? "Edit milestone date"
                              : "Add an important date"}
                          </Text>

                          <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>
                              Milestone label
                            </Text>
                            <TextInput
                              style={styles.textInput}
                              value={dateLabel}
                              onChangeText={setDateLabel}
                              placeholder="e.g. First met, Our anniversary"
                              placeholderTextColor={theme.mutedText}
                              maxLength={80}
                              accessibilityLabel="Milestone label"
                            />

                            <View style={styles.presetsBlock}>
                              <Text style={styles.presetLabel}>
                                Suggestions:
                              </Text>
                              <View style={styles.chipsRow}>
                                {IMPORTANT_DATE_PRESETS.map((preset) => (
                                  <Pressable
                                    key={preset}
                                    style={styles.presetChip}
                                    onPress={() => setDateLabel(preset)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Use preset ${preset}`}
                                  >
                                    <Text style={styles.presetChipText}>
                                      {preset}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </View>

                          <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>Date</Text>
                            <View style={styles.dateSelectorRow}>
                              <View style={styles.yearInputWrap}>
                                <Text style={styles.miniLabel}>Year</Text>
                                <TextInput
                                  style={styles.yearInput}
                                  value={dateYear}
                                  onChangeText={setDateYear}
                                  placeholder="YYYY"
                                  placeholderTextColor={theme.mutedText}
                                  keyboardType="number-pad"
                                  maxLength={4}
                                  accessibilityLabel="Milestone year"
                                />
                              </View>

                              <View style={styles.selectorCol}>
                                <Text style={styles.miniLabel}>Month</Text>
                                <Pressable
                                  style={styles.selectorButton}
                                  onPress={() =>
                                    openMonthPicker(
                                      "Select milestone month",
                                      dateMonth,
                                      (m) => {
                                        setDateMonth(m);
                                        const yearNum =
                                          parseInt(dateYear, 10) || 2024;
                                        const maxD = getDaysInMonth(
                                          m,
                                          yearNum
                                        );
                                        if (dateDay > maxD) {
                                          setDateDay(maxD);
                                        }
                                      }
                                    )
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Month: ${MONTH_NAMES[dateMonth - 1]}`}
                                >
                                  <Text style={styles.selectorButtonText}>
                                    {MONTH_NAMES[dateMonth - 1]}
                                  </Text>
                                </Pressable>
                              </View>

                              <View style={styles.selectorCol}>
                                <Text style={styles.miniLabel}>Day</Text>
                                <Pressable
                                  style={styles.selectorButton}
                                  onPress={() => {
                                    const yearNum =
                                      parseInt(dateYear, 10) || 2024;
                                    const maxD = getDaysInMonth(
                                      dateMonth,
                                      yearNum
                                    );
                                    openDayPicker(
                                      "Select milestone day",
                                      dateDay,
                                      maxD,
                                      (d) => setDateDay(d)
                                    );
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Day: ${dateDay}`}
                                >
                                  <Text style={styles.selectorButtonText}>
                                    Day {dateDay}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>

                          <View style={styles.actionButtonsRow}>
                            <CouplyPrimaryButton
                              label={
                                isSavingImportantDate
                                  ? "Saving..."
                                  : "Save milestone date"
                              }
                              onPress={saveImportantDate}
                              disabled={
                                isSavingImportantDate || !dateLabel.trim()
                              }
                              loading={isSavingImportantDate}
                              accessibilityLabel="Save milestone date"
                              style={styles.flexButton}
                            />
                            <CouplyQuietButton
                              label="Cancel"
                              onPress={cancelDateForm}
                              disabled={isSavingImportantDate}
                              accessibilityLabel="Cancel date form"
                              variant="soft"
                              style={styles.flexButton}
                            />
                          </View>
                        </View>
                      ) : (
                        <CouplyPrimaryButton
                          label="Add an important date"
                          onPress={openAddDateForm}
                          accessibilityLabel="Add an important date"
                          style={styles.alignSelfStart}
                        />
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyCardContainer}>
                      <Text style={styles.emptyCardText}>
                        Create or join a relationship space before adding
                        important dates.
                      </Text>
                    </View>
                  )}
                </CouplySectionCard>
                );

                const relationshipSpaceCard = (
                  <CouplySectionCard
                    style={[styles.cardCouply, styles.infrastructureCard]}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <Text
                        style={[
                          styles.cardSectionHeading,
                          styles.infrastructureHeading,
                        ]}
                      >
                        Relationship space
                      </Text>
                      <Text style={styles.privacyTag}>
                        Account infrastructure
                      </Text>
                    </View>

              <Text style={styles.sectionPurposeText}>
                Pairing and connection settings for your shared space.
              </Text>

              {coupleId ? (
                <View style={styles.spaceContent}>
                  {partnerConnected ? (
                    <View style={styles.connectedCard}>
                      <Text style={styles.connectedHeading}>
                        {partnerName
                          ? `Connected with ${partnerName}`
                          : "Connected with your partner"}
                      </Text>
                      <Text style={styles.connectedBody}>
                        You share this intentional space together.
                      </Text>
                    </View>
                  ) : inviteCode ? (
                    <View style={styles.pendingInviteSection}>
                      <Text style={styles.stateHeading}>
                        Waiting for your partner
                      </Text>
                      <Text style={styles.stateBody}>
                        Share this invitation code whenever it feels right.
                      </Text>

                      <View style={styles.inviteBadgeCard}>
                        <Text style={styles.inviteBadgeLabel}>
                          Partner invite code
                        </Text>
                        <Text
                          style={styles.inviteBadgeCode}
                          selectable={true}
                        >
                          {inviteCode}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.spaceReadySection}>
                      <Text style={styles.stateHeading}>
                        Your space is ready
                      </Text>
                      <Text style={styles.stateBody}>
                        Invite your partner whenever you feel ready.
                      </Text>

                      <CouplyPrimaryButton
                        label="Invite partner"
                        onPress={createPartnerInvite}
                        accessibilityLabel="Invite partner"
                      />
                    </View>
                  )}

                  {/* Moments shortcut */}
                  <CouplyQuietButton
                    label="View moments in your space"
                    onPress={() => router.push("/events")}
                    accessibilityLabel="View moments in your space"
                    variant="soft"
                  />
                </View>
              ) : (
                <View style={styles.noSpaceSection}>
                  <Text style={styles.stateHeading}>
                    Create or join a space
                  </Text>
                  <Text style={styles.stateBody}>
                    Start a space for the two of you, or join one your partner
                    has already created.
                  </Text>

                  <CouplyPrimaryButton
                    label="Create relationship space"
                    onPress={createCouple}
                    accessibilityLabel="Create relationship space"
                  />

                  <View style={styles.orDividerRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.orLine} />
                  </View>

                  <View style={styles.joinSection}>
                    <Text style={styles.fieldLabel}>
                      Have a partner invite?
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={joinCode}
                      onChangeText={setJoinCode}
                      placeholder="Enter invite code"
                      placeholderTextColor={theme.mutedText}
                      autoCapitalize="characters"
                      accessibilityLabel="Partner invite code"
                    />

                    <CouplyPrimaryButton
                      label="Join partner"
                      onPress={acceptPartnerInvite}
                      accessibilityLabel="Join partner space"
                    />
                  </View>
                </View>
              )}
            </CouplySectionCard>
                );

                return prioritizeImportantDates ? (
                  <>
                    {importantDatesCard}
                    {ourRelationshipCard}
                    {relationshipSpaceCard}
                  </>
                ) : (
                  <>
                    {ourRelationshipCard}
                    {importantDatesCard}
                    {relationshipSpaceCard}
                  </>
                );
              })()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* -------------------------------------------
          MONTH / DAY SELECTOR MODAL
         ------------------------------------------- */}
      <Modal
        visible={pickerModal.isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setPickerModal((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() =>
            setPickerModal((prev) => ({ ...prev, isOpen: false }))
          }
        >
          <View
            style={styles.modalCard}
            onStartShouldSetResponder={() => true}
            accessibilityLabel={pickerModal.title}
          >
            <Text style={styles.modalHeading}>{pickerModal.title}</Text>

            {pickerModal.type === "month" ? (
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((name, idx) => {
                  const mNum = idx + 1;
                  const isSelected = pickerModal.selectedValue === mNum;
                  return (
                    <Pressable
                      key={name}
                      style={[
                        styles.gridChoiceBtn,
                        isSelected && styles.gridChoiceBtnSelected,
                      ]}
                      onPress={() => {
                        pickerModal.onSelect(mNum);
                        setPickerModal((prev) => ({ ...prev, isOpen: false }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={name}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.gridChoiceBtnText,
                          isSelected && styles.gridChoiceBtnTextSelected,
                        ]}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ScrollView
                style={styles.dayScroll}
                contentContainerStyle={styles.dayGrid}
                showsVerticalScrollIndicator={false}
              >
                {Array.from(
                  { length: pickerModal.maxDays },
                  (_, i) => i + 1
                ).map((dayNum) => {
                  const isSelected = pickerModal.selectedValue === dayNum;
                  return (
                    <Pressable
                      key={dayNum}
                      style={[
                        styles.dayChoiceBtn,
                        isSelected && styles.dayChoiceBtnSelected,
                      ]}
                      onPress={() => {
                        pickerModal.onSelect(dayNum);
                        setPickerModal((prev) => ({
                          ...prev,
                          isOpen: false,
                        }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Day ${dayNum}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.dayChoiceBtnText,
                          isSelected && styles.dayChoiceBtnTextSelected,
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <CouplyQuietButton
              label="Cancel"
              onPress={() =>
                setPickerModal((prev) => ({ ...prev, isOpen: false }))
              }
              accessibilityLabel="Cancel selection"
              variant="soft"
              style={styles.modalCancelBtn}
            />
          </View>
        </Pressable>
      </Modal>

      {/* -------------------------------------------
          IMPORTANT DATE DELETE CONFIRMATION DIALOG
         ------------------------------------------- */}
      <Modal
        visible={Boolean(dateToDelete)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDateToDelete(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDateToDelete(null)}
        >
          <View
            style={styles.modalCard}
            onStartShouldSetResponder={() => true}
            accessibilityRole="alert"
            accessibilityLabel="Remove this important date?"
          >
            <Text style={styles.modalHeading}>
              Remove this important date?
            </Text>
            <Text style={styles.modalBodyText}>
              It will disappear from your shared relationship profile for both
              of you.
            </Text>

            <View style={styles.confirmModalActions}>
              <CouplyPrimaryButton
                label={isDeletingImportantDate ? "Removing..." : "Remove date"}
                onPress={confirmDeleteImportantDate}
                disabled={isDeletingImportantDate}
                loading={isDeletingImportantDate}
                accessibilityLabel="Remove date"
                style={styles.dangerButton}
              />
              <CouplyQuietButton
                label="Keep it"
                onPress={() => setDateToDelete(null)}
                disabled={isDeletingImportantDate}
                accessibilityLabel="Keep it"
                variant="soft"
                style={styles.flexButton}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    container: {
      width: "100%",
      maxWidth: tokens.layout.appShell,
      alignSelf: "center",
      paddingHorizontal: tokens.layout.pagePaddingMobile,
      paddingTop: 20,
      paddingBottom: 48,
      gap: 16,
    },

    /* Header */
    headerCouply: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 2,
    },
    homeLinkBtnCouply: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: "flex-start",
    },

    /* Segmented Navigation Control */
    segmentControlContainer: {
      flexDirection: "row",
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      padding: 4,
      gap: 4,
      borderWidth: 1.2,
      borderColor: theme.borderSoft,
      width: "100%",
    },
    segmentTab: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    segmentTabActive: {
      backgroundColor: theme.surface,
      borderWidth: 1.2,
      borderColor: theme.border,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentTabInactive: {
      backgroundColor: "transparent",
      borderWidth: 1.2,
      borderColor: "transparent",
    },
    segmentTabText: {
      fontSize: 14.5,
      letterSpacing: -0.1,
    },
    segmentTabTextActive: {
      fontWeight: "700",
      color: theme.primaryText,
    },
    segmentTabTextInactive: {
      fontWeight: "600",
      color: theme.secondaryText,
    },
    infrastructureHeading: {
      fontSize: 16.5,
      fontWeight: "600",
      color: theme.secondaryText,
    },

    /* Cards */
    cardCouply: {
      marginHorizontal: 0,
      marginBottom: 0,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 20,
      padding: 20,
      gap: 14,
    },
    partnerCard: {
      backgroundColor: theme.surface,
      borderColor: theme.borderSoft,
    },
    infrastructureCard: {
      backgroundColor: theme.surface,
      borderColor: theme.borderSoft,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    cardSectionHeading: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    privacyTag: {
      fontSize: 12,
      color: theme.mutedText,
      fontWeight: "500",
    },
    sectionPurposeText: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    optionalHelperText: {
      fontSize: 12.5,
      color: theme.mutedText,
      fontStyle: "italic",
    },

    /* Subtle Divider */
    divider: {
      height: 1,
      backgroundColor: theme.borderSoft,
      marginVertical: 4,
    },

    /* Privacy Notices */
    privacyNoticeCard: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    privacyNoticeText: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },

    /* Personal Details (Account Summary) */
    profileSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatarBubble: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.secondarySurface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarBubblePartner: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.blushSurface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarInitial: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    profileInfoColumn: {
      flex: 1,
      minWidth: 0,
    },
    profileDisplayName: {
      fontSize: 16.5,
      fontWeight: "600",
      color: theme.primaryText,
      marginBottom: 2,
    },
    profileEmail: {
      fontSize: 13,
      color: theme.secondaryText,
    },
    personalPrivacyNote: {
      fontSize: 12,
      color: theme.mutedText,
      marginTop: 2,
    },

    /* Partner Identity Header */
    partnerIdentityHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 2,
    },
    partnerHeaderTextCol: {
      flex: 1,
      minWidth: 0,
    },
    sharedByLabel: {
      fontSize: 12,
      color: theme.mutedText,
      fontWeight: "500",
      marginTop: 1,
    },

    /* Form Fields & Inputs */
    formGap: {
      gap: 16,
    },
    contentColumn: {
      gap: 12,
    },
    fieldBlock: {
      gap: 6,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    fieldLabel: {
      fontSize: 13.5,
      fontWeight: "600",
      color: theme.primaryText,
    },
    counterText: {
      fontSize: 12,
      color: theme.mutedText,
    },
    helperText: {
      fontSize: 12.5,
      color: theme.secondaryText,
      lineHeight: 17,
    },
    miniLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    textInput: {
      minHeight: 46,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.primaryText,
    },
    textArea: {
      minHeight: 80,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14.5,
      color: theme.primaryText,
      textAlignVertical: "top",
    },

    /* Details Display Blocks */
    detailBlock: {
      gap: 4,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
      letterSpacing: 0.3,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.primaryText,
      lineHeight: 21,
    },

    /* Chips & Tags */
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    readOnlyChip: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    readOnlyChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.primaryText,
    },
    editableChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      paddingVertical: 4,
      paddingLeft: 12,
      paddingRight: 6,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    editableChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.primaryText,
    },
    chipRemovePressable: {
      minWidth: 28,
      minHeight: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
    },
    chipRemoveText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    choiceChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1.2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    choiceChipSelected: {
      borderColor: theme.primaryAccent,
      backgroundColor: theme.secondarySurface,
    },
    choiceChipText: {
      fontSize: 13.5,
      fontWeight: "500",
      color: theme.secondaryText,
    },
    choiceChipTextSelected: {
      color: theme.primaryAccent,
      fontWeight: "700",
    },

    /* Tag Add Input Row */
    tagInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    tagInput: {
      flex: 1,
      minHeight: 44,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.primaryText,
    },
    tagAddBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      minHeight: 44,
    },
    presetsBlock: {
      marginTop: 4,
      gap: 6,
    },
    presetLabel: {
      fontSize: 12,
      color: theme.mutedText,
    },
    presetChip: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: "dashed",
      paddingVertical: 6,
      paddingHorizontal: 10,
      minHeight: 34,
      justifyContent: "center",
    },
    presetChipText: {
      fontSize: 12.5,
      color: theme.secondaryText,
    },

    /* Date Selectors */
    dateSelectorRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      flexWrap: "wrap",
      gap: 8,
    },
    yearInputWrap: {
      width: 86,
      gap: 4,
    },
    yearInput: {
      minHeight: 46,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 12,
      fontSize: 15,
      color: theme.primaryText,
      textAlign: "center",
    },
    selectorCol: {
      flex: 1,
      minWidth: 110,
      gap: 4,
    },
    selectorButton: {
      minHeight: 46,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    selectorButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primaryText,
    },
    removeDateBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      minHeight: 46,
      justifyContent: "center",
    },

    /* Action Rows */
    actionButtonsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    flexButton: {
      flex: 1,
      minHeight: 46,
    },
    alignSelfStart: {
      alignSelf: "flex-start",
    },
    smallActionBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      minHeight: 38,
    },

    /* Feedback & Status */
    feedbackBanner: {
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
    },
    feedbackBannerSuccess: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.borderSoft,
    },
    feedbackBannerError: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.status.error.border,
    },
    feedbackText: {
      fontSize: 13,
      fontWeight: "500",
    },
    feedbackTextSuccess: {
      color: theme.primaryAccent,
    },
    feedbackTextError: {
      color: theme.status.error.text,
    },
    statusBanner: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: "center",
    },
    statusBannerText: {
      fontSize: 13.5,
      color: theme.primaryText,
      fontWeight: "500",
    },

    /* Empty Card Containers */
    emptyCardContainer: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyCardText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 20,
    },

    /* Important Dates List */
    datesList: {
      gap: 8,
    },
    dateItemCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    dateItemTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    dateItemLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.primaryText,
    },
    dateItemDate: {
      fontSize: 13,
      color: theme.secondaryText,
    },
    dateItemActions: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    dateFormCard: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    subHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
    },

    /* Connection & Relationship Space */
    spaceContent: {
      gap: 12,
    },
    connectedCard: {
      backgroundColor: theme.blushSurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 4,
    },
    connectedHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    connectedBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    pendingInviteSection: {
      gap: 8,
    },
    stateHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
    },
    stateBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    inviteBadgeCard: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginTop: 6,
    },
    inviteBadgeLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    inviteBadgeCode: {
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "monospace",
      }),
      fontSize: 22,
      fontWeight: "700",
      color: theme.primaryAccent,
      letterSpacing: 3,
    },
    spaceReadySection: {
      gap: 12,
    },
    noSpaceSection: {
      gap: 12,
    },
    orDividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 4,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    orText: {
      fontSize: 13,
      color: theme.mutedText,
      fontWeight: "500",
    },
    joinSection: {
      gap: 8,
    },

    /* Loading screen */
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 24,
    },
    loadingText: {
      fontSize: 15,
      color: theme.secondaryText,
    },

    /* Modals & Dialogs */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: tokens.layout.dialogCompact,
      alignSelf: "center",
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    modalHeading: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primaryText,
      textAlign: "center",
    },
    modalBodyText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 20,
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    gridChoiceBtn: {
      width: "30%",
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    gridChoiceBtnSelected: {
      borderColor: theme.primaryAccent,
      backgroundColor: theme.secondarySurface,
    },
    gridChoiceBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.primaryText,
      textAlign: "center",
    },
    gridChoiceBtnTextSelected: {
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    dayScroll: {
      maxHeight: 220,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      paddingVertical: 4,
    },
    dayChoiceBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dayChoiceBtnSelected: {
      borderColor: theme.primaryAccent,
      backgroundColor: theme.secondarySurface,
    },
    dayChoiceBtnText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.primaryText,
    },
    dayChoiceBtnTextSelected: {
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    modalCancelBtn: {
      marginTop: 4,
      minHeight: 44,
    },
    confirmModalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    dangerButton: {
      flex: 1,
      backgroundColor: theme.status.error.border || "#e05252",
      minHeight: 44,
    },
  });
