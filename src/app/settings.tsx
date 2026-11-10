import { tokens } from "@/components/couply-tokens";
import { AppBottomNav } from "@/components/AppBottomNav";
import { CouplyHeader } from "@/components/CouplyUI";
import {
  APPEARANCE_CHOICES,
  AppearanceMode,
  ThemeColors,
  useTheme,
} from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

function getAppearanceModeDescription(mode: AppearanceMode): string {
  switch (mode) {
    case "system":
      return "System";
    case "light":
      return "Light · Lilac Morning";
    case "dim":
      return "Dim · Violet Garden";
    case "dark":
      return "Dark · Plum Night";
    default:
      return "System";
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const identity = useUserIdentity();
  const { width } = useWindowDimensions();
  const isWide = width >= 480;
  const { mode, theme, setMode } = useTheme();

  const [settingsDetailView, setSettingsDetailView] = useState<
    "appearance" | "sharing" | "help" | null
  >(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const effectivePartnerName = identity.partnerName;
  const effectivePartnerConnected = identity.partnerConnected;
  const effectivePartnerRef = identity.partnerRef || "your partner";

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (isMounted && user?.email) {
          setUserEmail(user.email);
        }
      } catch {
        // Safe fallback in-session
      }
    }
    void loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        console.error("Sign out error:", error);
        setSignOutError("We couldn’t sign you out. Please try again.");
        setIsSigningOut(false);
        return;
      }

      setIsSigningOut(false);
      setIsSignOutModalVisible(false);
      void identity.refreshIdentity();
      router.replace("/");
    } catch (err) {
      console.error("Sign out error:", err);
      setSignOutError("We couldn’t sign you out. Please try again.");
      setIsSigningOut(false);
    }
  };

  const relationshipSpaceDescription = effectivePartnerConnected
    ? `Connected with ${effectivePartnerName || "your partner"}`
    : "Invite or connect with a partner";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Detail View: Appearance */}
          {settingsDetailView === "appearance" && (
            <View style={styles.detailWrapper}>
              <CouplyHeader
                title="Appearance"
                subtitle="Change the atmosphere without changing how anything works."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                titleStyle={{ color: theme.primaryText }}
                subtitleStyle={{ color: theme.secondaryText }}
                backTextStyle={{ color: theme.primaryAccent }}
                style={styles.headerCouply}
              />

              <GardenLightSelector
                mode={mode}
                setMode={setMode}
                isWide={isWide}
                styles={styles}
              />
            </View>
          )}

          {/* Detail View: Sharing choices */}
          {settingsDetailView === "sharing" && (
            <View style={styles.detailWrapper}>
              <CouplyHeader
                title="Sharing and privacy"
                subtitle="Understand what stays Mine and what enters Our Space."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                titleStyle={{ color: theme.primaryText }}
                subtitleStyle={{ color: theme.secondaryText }}
                backTextStyle={{ color: theme.primaryAccent }}
                style={styles.headerCouply}
              />

              <View style={styles.sectionCard}>
                <View style={styles.detailBodyContainer}>
                  <Text style={styles.detailSectionTitle}>Mine</Text>
                  <Text style={styles.detailBody}>
                    Mine is for your private reflections, personal notes, and
                    drafts. Only you can see what is stored in Mine.
                  </Text>

                  <View style={styles.detailDivider} />

                  <Text style={styles.detailSectionTitle}>Our Space</Text>
                  <Text style={styles.detailBody}>
                    Our Space contains only moments, check-ins, and takeaways
                    that you intentionally choose to share with{" "}
                    {effectivePartnerRef}.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Detail View: How Purple Garden works */}
          {settingsDetailView === "help" && (
            <View style={styles.detailWrapper}>
              <CouplyHeader
                title="How Purple Garden works"
                subtitle="A short guide to Mine, Our Space and shared moments."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                titleStyle={{ color: theme.primaryText }}
                subtitleStyle={{ color: theme.secondaryText }}
                backTextStyle={{ color: theme.primaryAccent }}
                style={styles.headerCouply}
              />

              <View style={styles.sectionCard}>
                <View style={styles.detailBodyContainer}>
                  <Text style={styles.detailSectionTitle}>A quieter rhythm</Text>
                  <Text style={styles.detailBody}>
                    Purple Garden helps you notice what matters, keep private
                    thoughts safe in Mine, and bring intentional moments into
                    Our Space.
                  </Text>

                  <View style={styles.detailDivider} />

                  <Text style={styles.detailSectionTitle}>Shared with intention</Text>
                  <Text style={styles.detailBody}>
                    Nothing is shared automatically. Moments, reframes, and
                    repair invitations only enter Our Space when you decide to
                    share them.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Main Settings List */}
          {settingsDetailView === null && (
            <>
              {/* Header */}
              <CouplyHeader
                title="Settings"
                subtitle="A few quiet choices for your space."
                onBack={handleBack}
                backLabel="‹ Back"
                titleStyle={{ color: theme.primaryText }}
                subtitleStyle={{ color: theme.secondaryText }}
                backTextStyle={{ color: theme.primaryAccent }}
                style={styles.headerCouply}
              />

              {/* 1. ACCOUNT */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>

                <View style={styles.sectionCard}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => router.push("/profile")}
                    accessibilityRole="button"
                    accessibilityLabel="Your profile: Name and personal details"
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Your profile</Text>
                      <Text style={styles.rowSubtext}>
                        Name and personal details
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>

                  <View style={styles.divider} />

                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => router.push("/profile")}
                    accessibilityRole="button"
                    accessibilityLabel={`Relationship space: ${relationshipSpaceDescription}`}
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Relationship space</Text>
                      <Text style={styles.rowSubtext}>
                        {relationshipSpaceDescription}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </View>
              </View>

              {/* 2. PREFERENCES */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences</Text>

                <View style={styles.sectionCard}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => setSettingsDetailView("appearance")}
                    accessibilityRole="button"
                    accessibilityLabel={`Appearance: ${getAppearanceModeDescription(
                      mode
                    )}`}
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Appearance</Text>
                      <Text style={styles.rowSubtext}>
                        {getAppearanceModeDescription(mode)}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </View>
              </View>

              {/* 3. PRIVACY */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Privacy</Text>

                <View style={styles.sectionCard}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => setSettingsDetailView("sharing")}
                    accessibilityRole="button"
                    accessibilityLabel="Sharing and privacy: Understand what stays Mine and what enters Our Space"
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Sharing and privacy</Text>
                      <Text style={styles.rowSubtext}>
                        Understand what stays Mine and what enters Our Space
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </View>
              </View>

              {/* 4. SUPPORT */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support</Text>

                <View style={styles.sectionCard}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => setSettingsDetailView("help")}
                    accessibilityRole="button"
                    accessibilityLabel="How Purple Garden works: A short guide to Mine, Our Space and shared moments"
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>
                        How Purple Garden works
                      </Text>
                      <Text style={styles.rowSubtext}>
                        A short guide to Mine, Our Space and shared moments
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </View>
              </View>

              {/* 5. DEVELOPER PREVIEWS */}
              {__DEV__ && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Developer Previews</Text>
                    <View style={styles.devOnlyTag}>
                      <Text style={styles.devOnlyTagText}>Development only</Text>
                    </View>
                  </View>

                  <View style={styles.sectionCard}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.settingsRow,
                        pressed && styles.settingsRowPressed,
                      ]}
                      onPress={() =>
                        router.push("/make-challenge-preview" as any)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Make Your Own Tiny Challenge: Compose a small, kind invitation with optional timing and preview"
                    >
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>
                          Make Your Own Tiny Challenge
                        </Text>
                        <Text style={styles.rowSubtext}>
                          Compose a small, kind invitation with optional timing
                          and preview
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 6. ACCOUNT SESSION */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Session</Text>

                <View style={styles.sectionCard}>
                  <View style={styles.sessionInfoRow}>
                    <Text style={styles.sessionHeading}>Signed in</Text>
                    {userEmail ? (
                      <Text style={styles.sessionEmail} numberOfLines={1}>
                        {userEmail}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.divider} />

                  <Pressable
                    style={({ pressed }) => [
                      styles.signOutRow,
                      pressed && styles.settingsRowPressed,
                    ]}
                    onPress={() => {
                      setSignOutError(null);
                      setIsSignOutModalVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out of Purple Garden"
                  >
                    <Text style={styles.signOutText}>Sign out</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sign-out Confirmation Modal */}
      <Modal
        visible={isSignOutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isSigningOut) {
            setIsSignOutModalVisible(false);
            setSignOutError(null);
          }
        }}
        accessibilityViewIsModal={true}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isSigningOut) {
              setIsSignOutModalVisible(false);
              setSignOutError(null);
            }
          }}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
            accessibilityRole="alert"
            accessibilityViewIsModal={true}
            accessibilityLabel="Sign out of Purple Garden confirmation"
          >
            <Text style={styles.modalHeading}>
              Sign out of Purple Garden?
            </Text>
            <Text style={styles.modalBody}>
              Your shared and private moments will remain in your account. You can
              sign in again anytime.
            </Text>

            {signOutError ? (
              <View
                style={styles.modalErrorBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.modalErrorText}>{signOutError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActionsCol}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  pressed && styles.modalConfirmButtonPressed,
                  isSigningOut && styles.modalButtonDisabled,
                ]}
                onPress={handleSignOut}
                disabled={isSigningOut}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isSigningOut,
                  busy: isSigningOut,
                }}
                accessibilityLabel={
                  isSigningOut ? "Signing out..." : "Sign out"
                }
              >
                {isSigningOut ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator
                      size="small"
                      color={theme.status.error.text}
                    />
                    <Text style={styles.modalConfirmButtonText}>
                      Signing out...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Sign out</Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.modalCancelButtonPressed,
                  isSigningOut && styles.modalButtonDisabled,
                ]}
                onPress={() => {
                  if (!isSigningOut) {
                    setIsSignOutModalVisible(false);
                    setSignOutError(null);
                  }
                }}
                disabled={isSigningOut}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSigningOut }}
                accessibilityLabel="Stay signed in"
              >
                <Text style={styles.modalCancelButtonText}>
                  Stay signed in
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fixed Visual Bottom Navigation */}
      <AppBottomNav activeTab="settings" />
    </SafeAreaView>
  );
}

function GardenLightSelector({
  mode,
  setMode,
  isWide,
  styles,
}: {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  isWide: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.appearanceContainer}>
      <View style={styles.appearanceIntro}>
        <Text style={styles.appearanceHeading}>Choose your garden light</Text>
        <Text style={styles.appearanceBody}>
          Use your device setting or choose the atmosphere that feels most
          comfortable.
        </Text>
      </View>

      {isWide ? (
        <View
          style={styles.segmentedContainer}
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance mode selection"
        >
          {APPEARANCE_CHOICES.map((choice) => {
            const isSelected = choice.key === mode;
            return (
              <Pressable
                key={choice.key}
                style={[
                  styles.segmentItem,
                  isSelected && styles.segmentItemSelected,
                ]}
                onPress={() => setMode(choice.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${choice.name}: ${choice.brandedCaption}. ${choice.description}${
                  isSelected ? ", selected" : ""
                }`}
              >
                <View style={styles.segmentPaletteRow}>
                  {choice.paletteCircles.map((circleCol, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.paletteMiniCircle,
                        { backgroundColor: circleCol },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.segmentTextRow}>
                  {isSelected && <Text style={styles.segmentCheckIcon}>✓ </Text>}
                  <Text
                    style={[
                      styles.segmentTitle,
                      isSelected && styles.segmentTitleSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {choice.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.segmentCaption,
                    isSelected && styles.segmentCaptionSelected,
                  ]}
                  numberOfLines={1}
                >
                  {choice.brandedCaption}
                </Text>
                {choice.isRecommended && (
                  <View style={styles.recommendedBadgeSmall}>
                    <Text style={styles.recommendedBadgeSmallText}>Rec</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={styles.appearanceCardsGroup}
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance mode selection"
        >
          {APPEARANCE_CHOICES.map((choice) => {
            const isSelected = choice.key === mode;
            return (
              <Pressable
                key={choice.key}
                style={[
                  styles.appearanceCard,
                  isSelected && styles.appearanceCardSelected,
                ]}
                onPress={() => setMode(choice.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${choice.name}: ${choice.brandedCaption}. ${choice.description}${
                  isSelected ? ", selected" : ""
                }`}
              >
                <View style={styles.appearanceCardLeft}>
                  <View style={styles.paletteCirclesGroup}>
                    {choice.paletteCircles.map((circleCol, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.paletteMiniCircle,
                          { backgroundColor: circleCol },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.appearanceCardTextCol}>
                    <View style={styles.appearanceCardTitleRow}>
                      <Text
                        style={[
                          styles.appearanceCardTitle,
                          isSelected && styles.appearanceCardTitleSelected,
                        ]}
                      >
                        {choice.brandedCaption}
                      </Text>
                      <View style={styles.nameTag}>
                        <Text style={styles.nameTagText}>{choice.name}</Text>
                      </View>
                      {choice.isRecommended && (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>Recommended</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.appearanceCardSubtitle,
                        isSelected && styles.appearanceCardSubtitleSelected,
                      ]}
                    >
                      {choice.description}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    isSelected && styles.radioOuterSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.appearanceQuietNote}>
        Appearance changes only how Purple Garden looks. It does not change sharing
        or privacy.
      </Text>
    </View>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    scrollContent: {
      paddingBottom: 96,
      paddingHorizontal: tokens.layout.pagePaddingMobile,
      paddingTop: 16,
    },
    mainColumn: {
      width: "100%",
      maxWidth: tokens.layout.appShell,
      alignSelf: "center",
      gap: 20,
    },
    headerCouply: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 4,
    },
    section: {
      gap: 6,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 12.5,
      fontWeight: "700",
      color: theme.mutedText,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginLeft: 4,
    },
    devOnlyTag: {
      backgroundColor: theme.badgeBackground,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    devOnlyTagText: {
      fontSize: 10.5,
      fontWeight: "600",
      color: theme.primaryAccent,
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1.2,
      borderColor: theme.border,
      overflow: "hidden",
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 52,
    },
    settingsRowPressed: {
      backgroundColor: theme.selectedNavigation,
    },
    rowTextGroup: {
      flex: 1,
      gap: 2,
    },
    rowHeading: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    rowSubtext: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    chevron: {
      fontSize: 18,
      color: theme.iconMuted,
      fontWeight: "600",
      marginLeft: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: 16,
    },
    sessionInfoRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 2,
    },
    sessionHeading: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primaryText,
      letterSpacing: -0.1,
    },
    sessionEmail: {
      fontSize: 13,
      color: theme.secondaryText,
    },
    signOutRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 50,
      justifyContent: "center",
    },
    signOutText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.status.error.text,
    },

    /* Detail View Styling */
    detailWrapper: {
      gap: 14,
    },
    detailBodyContainer: {
      padding: 18,
      gap: 6,
    },
    detailSectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    detailBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    detailDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 10,
    },

    /* Appearance selector styles */
    appearanceContainer: {
      gap: 12,
    },
    appearanceIntro: {
      gap: 4,
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    appearanceHeading: {
      fontSize: 15.5,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    appearanceBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    appearanceQuietNote: {
      fontSize: 12.5,
      color: theme.mutedText,
      lineHeight: 17,
      paddingHorizontal: 4,
      marginTop: 2,
    },
    segmentedContainer: {
      flexDirection: "row",
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: 3,
    },
    segmentItemSelected: {
      backgroundColor: theme.surface,
      borderColor: theme.primaryAccent,
    },
    segmentPaletteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginBottom: 2,
    },
    segmentTextRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    segmentCheckIcon: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    segmentTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    segmentTitleSelected: {
      color: theme.primaryText,
      fontWeight: "700",
    },
    segmentCaption: {
      fontSize: 10.5,
      color: theme.mutedText,
    },
    segmentCaptionSelected: {
      color: theme.secondaryText,
    },
    recommendedBadgeSmall: {
      backgroundColor: theme.badgeBackground,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginTop: 2,
    },
    recommendedBadgeSmallText: {
      fontSize: 9,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    appearanceCardsGroup: {
      gap: 10,
    },
    appearanceCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    appearanceCardSelected: {
      borderColor: theme.primaryAccent,
      borderWidth: 1.8,
      backgroundColor: theme.selectedNavigation,
    },
    appearanceCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
    },
    appearanceCardTextCol: {
      flex: 1,
      gap: 3,
    },
    appearanceCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    appearanceCardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    appearanceCardTitleSelected: {
      color: theme.primaryText,
      fontWeight: "700",
    },
    nameTag: {
      backgroundColor: theme.secondarySurface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    nameTagText: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: "500",
    },
    appearanceCardSubtitle: {
      fontSize: 12.5,
      color: theme.secondaryText,
      lineHeight: 17,
    },
    appearanceCardSubtitleSelected: {
      color: theme.secondaryText,
    },
    defaultPill: {
      backgroundColor: theme.badgeBackground,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    defaultPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.primaryAccent,
    },
    paletteCirclesGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    paletteMiniCircle: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.border,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    radioOuterSelected: {
      borderColor: theme.primaryAccent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primaryAccent,
    },

    /* Modal Confirmation Dialog */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: tokens.layout.dialogCompact,
      alignSelf: "center",
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1.2,
      borderColor: theme.border,
      padding: 22,
      gap: 14,
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
      letterSpacing: -0.3,
    },
    modalBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 19,
    },
    modalErrorBanner: {
      backgroundColor: theme.status.error.bg,
      borderWidth: 1,
      borderColor: theme.status.error.border,
      borderRadius: 10,
      padding: 10,
    },
    modalErrorText: {
      fontSize: 12.5,
      color: theme.status.error.text,
      textAlign: "center",
      lineHeight: 17,
    },
    modalActionsCol: {
      gap: 8,
      marginTop: 6,
    },
    modalConfirmButton: {
      backgroundColor: theme.status.error.bg,
      borderWidth: 1.2,
      borderColor: theme.status.error.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
    },
    modalConfirmButtonPressed: {
      opacity: 0.85,
    },
    modalConfirmButtonText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.status.error.text,
    },
    modalCancelButton: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
    },
    modalCancelButtonPressed: {
      opacity: 0.85,
    },
    modalCancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primaryText,
    },
    modalButtonDisabled: {
      opacity: 0.6,
    },
    buttonLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
  });
}
