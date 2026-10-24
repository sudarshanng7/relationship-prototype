import { AppBottomNav } from "@/components/AppBottomNav";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export type ThemeKey = "lavender" | "sunrise" | "sage";

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

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  lavender: {
    key: "lavender",
    name: "Lavender Calm",
    description: "Soft purple, warm and reflective",
    paletteCircles: ["#FBF7FC", "#F1EDF7", "#6E416D"],
    background: "#FBF7FC",
    surface: "#FFFFFF",
    surfaceBorder: "#E8DCE9",
    privateSurface: "#F1EDF7",
    privateBorder: "#E3DBEB",
    privateText: "#4E3F50",
    sharedSurface: "#FBEFF7",
    sharedBorder: "#EEDCEB",
    sharedText: "#703866",
    primaryText: "#3D3040",
    secondaryText: "#6D6072",
    mutedText: "#8E7E94",
    accent: "#6E416D",
    accentPressed: "#593258",
    accentText: "#FFFFFF",
    border: "#E8DCE9",
    selectedNavigation: "#EFE4F0",
    iconMuted: "#7E6D82",
    badgeBackground: "#F3ECF4",
    badgeDot: "#6E416D",
    avatarCircle: "#F3DEEF",
    avatarBorder: "#E3C9E1",
    savedBoxBg: "#F7EEF7",
    savedBoxBorder: "#E6D4E7",
    buttonSecondaryBg: "#F8F3F9",
    buttonSecondaryBorder: "#E5DAE6",
  },
  sunrise: {
    key: "sunrise",
    name: "Sunrise Warmth",
    description: "Ivory, peach, and quiet optimism",
    paletteCircles: ["#FDF9F5", "#FDF0EB", "#9E4D38"],
    background: "#FDF9F5",
    surface: "#FFFFFF",
    surfaceBorder: "#EFE1D5",
    privateSurface: "#F8EFE7",
    privateBorder: "#EADCCE",
    privateText: "#51392F",
    sharedSurface: "#FDF0EB",
    sharedBorder: "#F4D9CE",
    sharedText: "#8B412D",
    primaryText: "#3D2E28",
    secondaryText: "#735B50",
    mutedText: "#967A6E",
    accent: "#9E4D38",
    accentPressed: "#843E2C",
    accentText: "#FFFFFF",
    border: "#EFE1D5",
    selectedNavigation: "#F8E6DE",
    iconMuted: "#8A7369",
    badgeBackground: "#F7EDE5",
    badgeDot: "#9E4D38",
    avatarCircle: "#FCE5DC",
    avatarBorder: "#ECCDC1",
    savedBoxBg: "#FDF3EE",
    savedBoxBorder: "#F2D5C8",
    buttonSecondaryBg: "#FAF1EB",
    buttonSecondaryBorder: "#ECD9CD",
  },
  sage: {
    key: "sage",
    name: "Sage Quiet",
    description: "Cream, soft green, and grounded calm",
    paletteCircles: ["#F8FAF6", "#EBF2EA", "#3D6348"],
    background: "#F8FAF6",
    surface: "#FFFFFF",
    surfaceBorder: "#DFE7DE",
    privateSurface: "#EFF4ED",
    privateBorder: "#DCE6DA",
    privateText: "#314335",
    sharedSurface: "#EBF2EA",
    sharedBorder: "#D6E3D4",
    sharedText: "#33553C",
    primaryText: "#253429",
    secondaryText: "#57685B",
    mutedText: "#7A8C7E",
    accent: "#3D6348",
    accentPressed: "#30503A",
    accentText: "#FFFFFF",
    border: "#DFE7DE",
    selectedNavigation: "#E5EDE4",
    iconMuted: "#687C6C",
    badgeBackground: "#ECF3EB",
    badgeDot: "#3D6348",
    avatarCircle: "#DFECE0",
    avatarBorder: "#C7DBC8",
    savedBoxBg: "#F0F5EF",
    savedBoxBorder: "#D6E2D4",
    buttonSecondaryBg: "#EDF3EC",
    buttonSecondaryBorder: "#D9E4D8",
  },
};

export const THEME_LIST: ThemeConfig[] = [
  THEMES.lavender,
  THEMES.sunrise,
  THEMES.sage,
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

type IncomingFrictionMoment = {
  id: string;
  creator_id: string;
  event_type: "friction";
  visibility: "ours";
  status: "open" | "partially_repaired";
  created_at: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ settings?: string | string[] }>();
  const [selectedThemeKey, setSelectedThemeKey] =
    useState<ThemeKey>("lavender");
  const [personalCoverUri, setPersonalCoverUri] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDetailView, setSettingsDetailView] = useState<
    "appearance" | "sharing" | "help" | null
  >(null);
  const identity = useUserIdentity();
  const [incomingMoment, setIncomingMoment] =
    useState<IncomingFrictionMoment | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);

  const effectiveDisplayName = identity.displayName ?? displayName;
  const effectivePartnerName = identity.partnerName ?? partnerName;
  const effectivePartnerConnected =
    identity.partnerConnected || partnerConnected;
  const effectivePartnerRef =
    identity.partnerRef || effectivePartnerName || "your partner";

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      async function fetchHomeData() {
        try {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user || isCancelled) {
            if (!isCancelled) {
              setIsIdentityLoading(false);
            }
            return;
          }

          // 1. Fetch current user's profile display_name
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle();

          if (!isCancelled) {
            setDisplayName(profile?.display_name?.trim() || null);
          }

          // 2. Fetch couple membership
          const { data: membership, error: membershipError } = await supabase
            .from("couple_members")
            .select("couple_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (membershipError || !membership || isCancelled) {
            if (!isCancelled) {
              setPartnerConnected(false);
              setPartnerName(null);
              setIncomingMoment(null);
              setIsIdentityLoading(false);
            }
            return;
          }

          const currentCoupleId = membership.couple_id;

          // 3. Check if partner is connected in couple
          const { data: members } = await supabase
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", currentCoupleId);

          const partnerMember = members?.find(
            (member) => member.user_id !== user.id,
          );

          if (!isCancelled) {
            setPartnerConnected(Boolean(partnerMember));
          }

          if (partnerMember) {
            const { data: name } = await supabase.rpc(
              "get_partner_display_name",
            );
            if (
              !isCancelled &&
              typeof name === "string" &&
              name.trim().length > 0
            ) {
              setPartnerName(name.trim());
            } else if (!isCancelled) {
              setPartnerName(null);
            }
          } else if (!isCancelled) {
            setPartnerName(null);
          }

          // 4. Fetch incoming friction moment
          const { data, error } = await supabase
            .from("relationship_events")
            .select(
              "id, creator_id, event_type, visibility, status, created_at",
            )
            .eq("couple_id", currentCoupleId)
            .eq("visibility", "ours")
            .eq("event_type", "friction")
            .neq("creator_id", user.id)
            .in("status", ["open", "partially_repaired"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (isCancelled) {
            return;
          }

          if (error || !data) {
            setIncomingMoment(null);
            return;
          }

          setIncomingMoment(data as IncomingFrictionMoment);
        } catch {
          if (!isCancelled) {
            setIncomingMoment(null);
          }
        } finally {
          if (!isCancelled) {
            setIsIdentityLoading(false);
          }
        }
      }

      void fetchHomeData();

      return () => {
        isCancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    const isSettingsParam =
      params.settings === "true" ||
      (Array.isArray(params.settings) && params.settings[0] === "true");
    if (isSettingsParam) {
      setSettingsDetailView(null);
      setIsSettingsOpen(true);
    }
  }, [params.settings]);

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setSettingsDetailView(null);
    const isSettingsParam =
      params.settings === "true" ||
      (Array.isArray(params.settings) && params.settings[0] === "true");
    if (isSettingsParam) {
      router.replace("/home");
    }
  };
  const [eveningReflectionEnabled, setEveningReflectionEnabled] =
    useState(true);
  const [previewState, setPreviewState] =
    useState<PreviewState>("calm_day");
  const [selectedFeeling, setSelectedFeeling] =
    useState<ReflectionFeeling | null>(null);
  const [eveningClosureState, setEveningClosureState] = useState<
    "done" | "remind" | "skip" | null
  >(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);

  const theme = THEMES[selectedThemeKey];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const greeting = getDeviceGreeting();

  const personalCoverSource = personalCoverUri
    ? { uri: personalCoverUri }
    : require("@/assets/images/shared-horizon.png");

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Single Mobile Content Column (capped at 520px) */}
        <View style={styles.mainColumn}>
          {/* Top Centred Title ("My Rhythm") */}
          <View style={styles.topTitleContainer}>
            <Text style={styles.topTitleText}>My Rhythm</Text>
          </View>

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

          {/* 3. "What matters now" Dynamic Area (Primary Focus Card) */}
          <View style={[styles.sectionCard, styles.betweenUsCard]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderBubble}>
                <Text style={styles.sectionHeaderIcon}>✦</Text>
              </View>
              <Text style={styles.sectionOverline}>What matters now</Text>
            </View>

            {incomingMoment ? (
              <Pressable
                style={({ pressed }) => [
                  styles.incomingMomentCard,
                  pressed && styles.incomingMomentCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/event/[id]",
                    params: {
                      id: incomingMoment.id,
                      scope: "ours",
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  effectivePartnerName
                    ? `Open the shared moment from ${effectivePartnerName} when ready`
                    : "Open the shared moment from your partner when ready"
                }
              >
                <View style={styles.incomingMomentHeader}>
                  <Text style={styles.incomingMomentOverline}>
                    A SHARED MOMENT
                  </Text>
                </View>
                <Text style={styles.incomingMomentHeading}>
                  {effectivePartnerName
                    ? `${effectivePartnerName} shared a moment`
                    : "Your partner shared a moment"}
                </Text>
                <Text style={styles.incomingMomentBody}>
                  There is no rush. Take a look whenever you feel ready.
                </Text>
                <View style={styles.incomingMomentActionRow}>
                  <View style={styles.incomingMomentActionBtn}>
                    <Text style={styles.incomingMomentActionText}>
                      Open when ready
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : (
              <>
                {/* Calm/default state */}
                {previewState === "calm_day" && (
              <View style={styles.calmDayContent}>
                <Text style={styles.calmHeading}>
                  Nothing needs your attention right now.
                </Text>
                <Text style={styles.calmSubheading}>
                  Enjoy your day together.
                </Text>
              </View>
            )}

            {/* Evening reflection state */}
            {previewState === "evening_reflection" && (
              <View style={styles.reflectionContent}>
                {eveningClosureState === "done" ? (
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
                    <Pressable
                      style={styles.reflectionUndoBtn}
                      onPress={handleUndoEveningState}
                      accessibilityRole="button"
                      accessibilityLabel="Undo and restore choices"
                    >
                      <Text style={styles.reflectionUndoBtnText}>Undo</Text>
                    </Pressable>
                  </View>
                ) : eveningClosureState === "remind" ? (
                  <View style={styles.reflectionClosureCard}>
                    <Text style={styles.reflectionClosureHeading}>Got it.</Text>
                    <Text style={styles.reflectionClosureText}>
                      We’ll leave you in peace for now.
                    </Text>
                    <Text style={styles.reflectionClosureNote}>
                      No reminder has actually been scheduled.
                    </Text>
                    <Pressable
                      style={styles.reflectionUndoBtn}
                      onPress={handleUndoEveningState}
                      accessibilityRole="button"
                      accessibilityLabel="Undo and restore choices"
                    >
                      <Text style={styles.reflectionUndoBtnText}>Undo</Text>
                    </Pressable>
                  </View>
                ) : eveningClosureState === "skip" ? (
                  <View style={styles.reflectionClosureCard}>
                    <Text style={styles.reflectionClosureHeading}>
                      No problem at all.
                    </Text>
                    <Text style={styles.reflectionClosureText}>
                      You can return whenever something matters.
                    </Text>
                    <Text style={styles.reflectionClosureNote}>
                      Nothing was saved.
                    </Text>
                    <Pressable
                      style={styles.reflectionUndoBtn}
                      onPress={handleUndoEveningState}
                      accessibilityRole="button"
                      accessibilityLabel="Undo and restore choices"
                    >
                      <Text style={styles.reflectionUndoBtnText}>Undo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reflectionHeading}>
                      A moment before the day ends
                    </Text>
                    <Text style={styles.reflectionQuestion}>
                      {effectivePartnerName
                        ? `How did things feel between you and ${effectivePartnerName} today?`
                        : "How did things feel between you and your partner today?"}
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
                            accessibilityLabel={`${option.label}: ${option.description}`}
                          >
                            <View
                              style={[
                                styles.feelingIconBubble,
                                isSelected && styles.feelingIconBubbleSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.feelingSymbolText,
                                  { color: option.accentColor },
                                ]}
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
                              Little irritations are normal. You can let this settle for now.
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

                    {/* Secondary actions before choosing a feeling */}
                    {selectedFeeling === null && (
                      <View style={styles.reflectionSecondaryActions}>
                        <Pressable
                          style={styles.quietSecondaryButton}
                          onPress={() => handleReflectionAction("remind")}
                          accessibilityRole="button"
                          accessibilityLabel="Remind me later"
                        >
                          <Text style={styles.quietSecondaryText}>
                            Remind me later
                          </Text>
                        </Pressable>
                        <View style={styles.quietSeparatorDot} />
                        <Pressable
                          style={styles.quietSecondaryButton}
                          onPress={() => handleReflectionAction("skip")}
                          accessibilityRole="button"
                          accessibilityLabel="Skip tonight"
                        >
                          <Text style={styles.quietSecondaryText}>
                            Skip tonight
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Open shared moment state */}
            {previewState === "open_repair" && (
              <View style={styles.partnerResponseContent}>
                <View style={styles.partnerTextGroup}>
                  <View style={styles.partnerBubble}>
                    <Text style={styles.partnerIconMini}>🤝</Text>
                  </View>
                  <Text style={styles.partnerResponseText}>
                    One shared moment is waiting when you feel ready.
                  </Text>
                </View>
                <Pressable
                  style={styles.primaryActionButton}
                  onPress={() =>
                    router.push({
                      pathname: "/events",
                      params: { scope: "ours" },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Continue when ready"
                >
                  <Text style={styles.primaryActionText}>
                    Continue when ready
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Positive shared moment state */}
            {previewState === "positive_moment" && (
              <View style={styles.partnerResponseContent}>
                <View style={styles.partnerTextGroup}>
                  <View style={styles.partnerBubble}>
                    <Text style={styles.partnerIconMini}>🌷</Text>
                  </View>
                  <Text style={styles.partnerResponseText}>
                    {effectivePartnerName
                      ? `${effectivePartnerName} shared something good with you.`
                      : "Your partner shared something good with you."}
                  </Text>
                </View>
                <Pressable
                  style={styles.primaryActionButton}
                  onPress={() =>
                    router.push({
                      pathname: "/events",
                      params: { scope: "ours" },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="See it"
                >
                  <Text style={styles.primaryActionText}>See it</Text>
                </Pressable>
              </View>
            )}

            {/* Recently resolved moment state */}
            {previewState === "recently_resolved" && (
              <View style={styles.partnerResponseContent}>
                <View style={styles.partnerTextGroup}>
                  <View style={styles.partnerBubble}>
                    <Text style={styles.partnerIconMini}>🌱</Text>
                  </View>
                  <View style={styles.resolvedTextCol}>
                    <Text style={styles.partnerResponseText}>
                      A recent moment was marked reconnected.
                    </Text>
                    <Text style={styles.resolvedSupportingText}>
                      Taking time to notice repair helps it stick.
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.primaryActionButton}
                  onPress={() =>
                    router.push({
                      pathname: "/events",
                      params: { scope: "ours" },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="View in Our Space"
                >
                  <Text style={styles.primaryActionText}>
                    View in Our Space
                  </Text>
                </Pressable>
              </View>
            )}
            </>
          )}
          </View>

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

      {/* Expanded Settings Sheet Modal */}
      {isSettingsOpen && (
        <View style={styles.sheetBackdrop} pointerEvents="box-none">
          <Pressable
            style={styles.sheetBackdropTouch}
            onPress={handleCloseSettings}
            accessibilityRole="button"
            accessibilityLabel="Close settings sheet"
          />
          <View style={styles.settingsSheetContainer}>
            <View style={styles.settingsSheetContent}>
              <View style={styles.sheetHandle} />

              {/* Sub-view: Appearance */}
              {settingsDetailView === "appearance" && (
                <View style={styles.settingsDetailWrapper}>
                  <View style={styles.settingsDetailHeader}>
                    <Pressable
                      onPress={() => setSettingsDetailView(null)}
                      style={styles.settingsBackBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Back to settings"
                    >
                      <Text style={styles.settingsBackBtnText}>‹ Settings</Text>
                    </Pressable>
                    <Text style={styles.settingsSheetHeading}>Appearance</Text>
                    <Pressable
                      style={styles.settingsCloseCircle}
                      onPress={handleCloseSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Close settings"
                    >
                      <Text style={styles.settingsCloseCircleText}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.settingsScrollView}
                    contentContainerStyle={styles.settingsScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.appearanceIntroText}>
                      Choose the look that feels right for you.
                    </Text>

                    <View style={styles.themeRowsContainer}>
                      {THEME_LIST.map((t) => {
                        const isSelected = t.key === selectedThemeKey;
                        return (
                          <Pressable
                            key={t.key}
                            style={[
                              styles.themeOptionRow,
                              isSelected && styles.themeOptionRowSelected,
                            ]}
                            onPress={() => setSelectedThemeKey(t.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={`${t.name}: ${t.description}`}
                          >
                            <View style={styles.themeOptionLeft}>
                              <View style={styles.paletteCirclesGroup}>
                                {t.paletteCircles.map((circleCol, idx) => (
                                  <View
                                    key={idx}
                                    style={[
                                      styles.paletteMiniCircle,
                                      { backgroundColor: circleCol },
                                    ]}
                                  />
                                ))}
                              </View>
                              <View style={styles.themeTextGroup}>
                                <Text style={styles.themeNameText}>{t.name}</Text>
                                <Text style={styles.themeDescText}>
                                  {t.description}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={[
                                styles.themeRadioOuter,
                                isSelected && styles.themeRadioOuterSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.themeRadioInner} />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Sub-view: Sharing choices */}
              {settingsDetailView === "sharing" && (
                <View style={styles.settingsDetailWrapper}>
                  <View style={styles.settingsDetailHeader}>
                    <Pressable
                      onPress={() => setSettingsDetailView(null)}
                      style={styles.settingsBackBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Back to settings"
                    >
                      <Text style={styles.settingsBackBtnText}>‹ Settings</Text>
                    </Pressable>
                    <Pressable
                      style={styles.settingsCloseCircle}
                      onPress={handleCloseSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Close settings"
                    >
                      <Text style={styles.settingsCloseCircleText}>✕</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.settingsDetailTitle}>Sharing choices</Text>
                  <View style={styles.settingsDetailCard}>
                    <Text style={styles.settingsDetailBody}>
                      Mine is for your private reflections, notes, and drafts.
                    </Text>
                    <Text style={[styles.settingsDetailBody, { marginTop: 12 }]}>
                      Ours contains only moments you intentionally choose to share with {effectivePartnerRef}.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.settingsDoneButton}
                    onPress={() => setSettingsDetailView(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close sharing choices"
                  >
                    <Text style={styles.settingsDoneButtonText}>Got it</Text>
                  </Pressable>
                </View>
              )}

              {/* Sub-view: How My Rhythm works */}
              {settingsDetailView === "help" && (
                <View style={styles.settingsDetailWrapper}>
                  <View style={styles.settingsDetailHeader}>
                    <Pressable
                      onPress={() => setSettingsDetailView(null)}
                      style={styles.settingsBackBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Back to settings"
                    >
                      <Text style={styles.settingsBackBtnText}>‹ Settings</Text>
                    </Pressable>
                    <Pressable
                      style={styles.settingsCloseCircle}
                      onPress={handleCloseSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Close settings"
                    >
                      <Text style={styles.settingsCloseCircleText}>✕</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.settingsDetailTitle}>How My Rhythm works</Text>
                  <View style={styles.settingsDetailCard}>
                    <Text style={styles.settingsDetailBody}>
                      My Rhythm helps you notice what matters now, keep private reflections in Mine, and choose what becomes part of Ours.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.settingsDoneButton}
                    onPress={() => setSettingsDetailView(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close help"
                  >
                    <Text style={styles.settingsDoneButtonText}>Got it</Text>
                  </Pressable>
                </View>
              )}

              {/* Main Settings List (5 sections) */}
              {settingsDetailView === null && (
                <>
                  <View style={styles.settingsHeaderRow}>
                    <Text style={styles.settingsSheetHeading}>Settings</Text>
                    <Pressable
                      style={styles.settingsCloseCircle}
                      onPress={handleCloseSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Close settings"
                    >
                      <Text style={styles.settingsCloseCircleText}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.settingsScrollView}
                    contentContainerStyle={styles.settingsScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* 1. Appearance */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Appearance</Text>
                      <View style={styles.settingsCard}>
                        <Pressable
                          style={styles.settingsActionRow}
                          onPress={() => setSettingsDetailView("appearance")}
                          accessibilityRole="button"
                          accessibilityLabel="Open appearance settings"
                        >
                          <View style={styles.settingsOptionLeft}>
                            <View style={styles.paletteCirclesGroup}>
                              {theme.paletteCircles.map((circleCol, idx) => (
                                <View
                                  key={idx}
                                  style={[
                                    styles.paletteMiniCircle,
                                    { backgroundColor: circleCol },
                                  ]}
                                />
                              ))}
                            </View>
                            <View style={styles.settingsRowTextGroup}>
                              <Text style={styles.settingsRowHeading}>
                                Appearance
                              </Text>
                              <Text style={styles.settingsRowSubtext}>
                                {theme.name}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.settingsChevron}>›</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* 2. Your rhythm */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Your rhythm</Text>
                      <View style={styles.settingsCard}>
                        <View style={styles.settingsToggleRow}>
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              Evening reflection
                            </Text>
                            <Text style={styles.settingsRowSubtext}>
                              A quiet moment to check in with yourself.
                            </Text>
                          </View>
                          <Switch
                            value={eveningReflectionEnabled}
                            onValueChange={setEveningReflectionEnabled}
                            trackColor={{ false: theme.border, true: theme.accent }}
                            thumbColor={theme.surface}
                            accessibilityRole="switch"
                            accessibilityLabel="Evening reflection"
                          />
                        </View>
                      </View>
                      <Text style={styles.settingsInfoNote}>
                        You can always skip a reflection. Nothing is required every day.
                      </Text>
                    </View>

                    {/* 3. Privacy and sharing */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>
                        Privacy and sharing
                      </Text>
                      <View style={styles.settingsCard}>
                        <View style={styles.settingsStaticRow}>
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              Private by default
                            </Text>
                            <Text style={styles.settingsRowSubtext}>
                              Your reflections stay in Mine unless you choose to share them.
                            </Text>
                          </View>
                        </View>

                        <View style={styles.settingsDivider} />

                        <Pressable
                          style={styles.settingsActionRow}
                          onPress={() => setSettingsDetailView("sharing")}
                          accessibilityRole="button"
                          accessibilityLabel="Sharing choices. You decide what becomes part of Ours."
                        >
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              Sharing choices
                            </Text>
                            <Text style={styles.settingsRowSubtext}>
                              You decide what becomes part of Ours.
                            </Text>
                          </View>
                          <Text style={styles.settingsChevron}>›</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* 4. Your connection */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Your connection</Text>
                      <View style={styles.settingsCard}>
                        <View style={styles.settingsConnectionHeaderRow}>
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              Your connection
                            </Text>
                            <Text style={styles.settingsRowSubtext}>
                              {effectivePartnerConnected
                                ? effectivePartnerName
                                  ? `You and ${effectivePartnerName} are connected.`
                                  : "You and your partner are connected."
                                : "You can connect with a partner whenever you feel ready."}
                            </Text>
                          </View>
                          {effectivePartnerConnected && (
                            <View style={styles.connectionBadge}>
                              <View style={styles.connectionDot} />
                              <Text style={styles.connectionLabel}>Connected</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.settingsDivider} />

                        <Pressable
                          style={styles.settingsActionRow}
                          onPress={() =>
                            setLocalFeedback(
                              "Your shared space will open here when navigation is connected."
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel="Shared space: Giggle Otters"
                        >
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              Shared space
                            </Text>
                            <Text style={styles.settingsRowSubtext}>
                              Giggle Otters
                            </Text>
                          </View>
                          <Text style={styles.settingsChevron}>›</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* 5. Help */}
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Help</Text>
                      <View style={styles.settingsCard}>
                        <Pressable
                          style={styles.settingsActionRow}
                          onPress={() => setSettingsDetailView("help")}
                          accessibilityRole="button"
                          accessibilityLabel="How My Rhythm works"
                        >
                          <View style={styles.settingsRowTextGroup}>
                            <Text style={styles.settingsRowHeading}>
                              How My Rhythm works
                            </Text>
                          </View>
                          <Text style={styles.settingsChevron}>›</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* 6. Development-only preview scenario switcher */}
                    {__DEV__ && (
                      <View style={styles.settingsSection}>
                        <Text style={styles.settingsSectionTitle}>
                          Preview scenarios
                        </Text>
                        <View style={styles.settingsCard}>
                          {PREVIEW_SCENARIOS.map((scenario, index) => {
                            const isSelected = previewState === scenario.key;
                            return (
                              <View key={scenario.key}>
                                {index > 0 && (
                                  <View style={styles.settingsDivider} />
                                )}
                                <Pressable
                                  style={[
                                    styles.settingsActionRow,
                                    isSelected &&
                                      styles.previewScenarioSelectedRow,
                                  ]}
                                  onPress={() => {
                                    setPreviewState(scenario.key);
                                    handleCloseSettings();
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Preview: ${scenario.label}`}
                                >
                                  <View style={styles.settingsRowTextGroup}>
                                    <Text
                                      style={[
                                        styles.settingsRowHeading,
                                        isSelected &&
                                          styles.previewScenarioSelectedHeading,
                                      ]}
                                    >
                                      {scenario.label}
                                    </Text>
                                    <Text style={styles.settingsRowSubtext}>
                                      {scenario.description}
                                    </Text>
                                  </View>
                                  {isSelected && (
                                    <Text style={styles.previewCheckmark}>
                                      ✓
                                    </Text>
                                  )}
                                </Pressable>
                              </View>
                            );
                          })}

                          <View style={styles.settingsDivider} />
                          <Pressable
                            style={styles.settingsActionRow}
                            onPress={() => {
                              handleCloseSettings();
                              router.push("/playful-reframe");
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Dev preview: Playful Reframe"
                          >
                            <View style={styles.settingsRowTextGroup}>
                              <Text style={styles.settingsRowHeading}>
                                Dev preview: Playful Reframe
                              </Text>
                              <Text style={styles.settingsRowSubtext}>
                                A lighthearted way to look at a small everyday irritation.
                              </Text>
                            </View>
                            <Text style={styles.settingsChevron}>›</Text>
                          </Pressable>

                          <View style={styles.settingsDivider} />
                          <Pressable
                            style={styles.settingsActionRow}
                            onPress={() => {
                              handleCloseSettings();
                              router.push("/challenge-lifecycle-preview");
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Dev preview: Challenge Lifecycle"
                          >
                            <View style={styles.settingsRowTextGroup}>
                              <Text style={styles.settingsRowHeading}>
                                Dev preview: Challenge Lifecycle
                              </Text>
                              <Text style={styles.settingsRowSubtext}>
                                Sample outcomes: waiting, accepted, declined, expired, and won.
                              </Text>
                            </View>
                            <Text style={styles.settingsChevron}>›</Text>
                          </Pressable>

                          <View style={styles.settingsDivider} />
                          <Pressable
                            style={styles.settingsActionRow}
                            onPress={() => {
                              handleCloseSettings();
                              router.push("/make-challenge-preview" as any);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Dev preview: Make Your Own Tiny Challenge"
                          >
                            <View style={styles.settingsRowTextGroup}>
                              <Text style={styles.settingsRowHeading}>
                                Dev preview: Make Your Own Tiny Challenge
                              </Text>
                              <Text style={styles.settingsRowSubtext}>
                                Compose a small, kind invitation with optional timing and preview.
                              </Text>
                            </View>
                            <Text style={styles.settingsChevron}>›</Text>
                          </Pressable>

                        </View>
                      </View>
                    )}
                  </ScrollView>

                  <Pressable
                    style={styles.settingsDoneButton}
                    onPress={handleCloseSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Close settings"
                  >
                    <Text style={styles.settingsDoneButtonText}>Done</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Fixed Visual Bottom Navigation */}
      <AppBottomNav
        activeTab="rhythm"
        themeColors={{
          surface: theme.surface,
          border: theme.border,
          accent: theme.accent,
          iconMuted: theme.iconMuted,
          selectedNavigation: theme.selectedNavigation,
          secondaryText: theme.secondaryText,
        }}
        onSettingsPress={() => {
          setSettingsDetailView(null);
          setIsSettingsOpen(true);
        }}
        onPreviewPress={(msg) => setLocalFeedback(msg)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeConfig) =>
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
    /* Single Centered Column: Full width on mobile, capped at 520px on desktop/wide viewports */
    mainColumn: {
      width: "100%",
      maxWidth: 520,
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

    /* 3. Calm Day */
    calmDayContent: {
      paddingVertical: 6,
    },
    calmHeading: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primaryText,
      lineHeight: 23,
    },
    calmSubheading: {
      fontSize: 14,
      color: theme.secondaryText,
      marginTop: 4,
      lineHeight: 20,
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
    reflectionUndoBtn: {
      alignSelf: "flex-start",
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 4,
    },
    reflectionUndoBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.accent,
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
      maxWidth: 520,
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
      maxWidth: 520,
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

    /* Settings Bottom Sheet Modal */
    settingsSheetContainer: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "86%",
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
      shadowOpacity: 0.15,
      shadowRadius: 14,
      elevation: 9,
    },
    settingsSheetContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      maxHeight: "100%",
    },
    settingsHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    settingsSheetHeading: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    settingsCloseCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.privateSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    settingsCloseCircleText: {
      fontSize: 14,
      color: theme.secondaryText,
      fontWeight: "600",
    },
    settingsScrollView: {
      flexShrink: 1,
    },
    settingsScrollContent: {
      paddingBottom: 12,
    },
    settingsSection: {
      marginBottom: 18,
    },
    settingsSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.secondaryText,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    settingsInfoNote: {
      fontSize: 12.5,
      color: theme.secondaryText,
      marginTop: 7,
      paddingHorizontal: 4,
      lineHeight: 18,
    },
    themeRowsContainer: {
      gap: 10,
    },
    themeOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.background,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    themeOptionRowSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.selectedNavigation,
    },
    themeOptionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    paletteCirclesGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: -4,
    },
    paletteMiniCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: theme.surface,
    },
    themeTextGroup: {
      flex: 1,
    },
    themeNameText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.primaryText,
    },
    themeDescText: {
      fontSize: 12.5,
      color: theme.secondaryText,
      marginTop: 2,
    },
    themeRadioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },
    themeRadioOuterSelected: {
      borderColor: theme.accent,
    },
    themeRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.accent,
    },
    appearanceIntroText: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 14,
      paddingHorizontal: 4,
      lineHeight: 20,
    },
    settingsOptionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    settingsCard: {
      backgroundColor: theme.background,
      borderWidth: 1.2,
      borderColor: theme.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    settingsToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    settingsStaticRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    settingsActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    settingsConnectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    settingsDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: 14,
    },
    settingsRowTextGroup: {
      flex: 1,
      marginRight: 12,
    },
    settingsRowHeading: {
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.primaryText,
    },
    settingsRowSubtext: {
      fontSize: 12.5,
      color: theme.secondaryText,
      marginTop: 2,
      lineHeight: 17,
    },
    settingsChevron: {
      fontSize: 20,
      color: theme.secondaryText,
      fontWeight: "500",
      lineHeight: 22,
    },
    settingsDetailWrapper: {
      width: "100%",
      paddingVertical: 4,
    },
    settingsDetailHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    settingsBackBtn: {
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 8,
    },
    settingsBackBtnText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.accent,
    },
    settingsDetailTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primaryText,
      marginBottom: 12,
      letterSpacing: -0.2,
    },
    settingsDetailCard: {
      backgroundColor: theme.background,
      borderWidth: 1.2,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 18,
    },
    settingsDetailBody: {
      fontSize: 14,
      color: theme.primaryText,
      lineHeight: 21,
    },
    settingsDoneButton: {
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    settingsDoneButtonText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: "600",
    },
    previewScenarioSelectedRow: {
      backgroundColor: theme.selectedNavigation,
    },
    previewScenarioSelectedHeading: {
      color: theme.accent,
      fontWeight: "700",
    },
    previewCheckmark: {
      fontSize: 16,
      color: theme.accent,
      fontWeight: "700",
      marginLeft: 8,
    },

    /* Fixed Visual Bottom Navigation */
    fixedBottomNav: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 4,
    },
    bottomNavInner: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    navItem: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 5,
      paddingHorizontal: 10,
      minWidth: 70,
      minHeight: 48,
      borderRadius: 14,
    },
    navItemActivePill: {
      backgroundColor: theme.selectedNavigation,
    },
    navItemLabel: {
      fontSize: 12.5,
      marginTop: 3,
    },
    navItemLabelActive: {
      color: theme.accent,
      fontWeight: "600",
    },
    navItemLabelInactive: {
      color: theme.secondaryText,
      fontWeight: "500",
    },
  });

