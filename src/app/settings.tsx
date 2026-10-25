import { AppBottomNav } from "@/components/AppBottomNav";
import {
  CouplyHeader,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { THEMES, THEME_LIST, ThemeKey } from "./home";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const identity = useUserIdentity();
  const [selectedThemeKey, setSelectedThemeKey] = useState<ThemeKey>("lavender");
  const [settingsDetailView, setSettingsDetailView] = useState<
    "appearance" | "sharing" | "help" | null
  >(null);

  const theme = THEMES[selectedThemeKey];
  const styles = createStyles(theme);

  const effectivePartnerName = identity.partnerName;
  const effectivePartnerConnected = identity.partnerConnected;
  const effectivePartnerRef = identity.partnerRef || "your partner";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  const handleOpenEveningReflection = () => {
    router.push({
      pathname: "/home",
      params: { openReflection: "true" },
    });
  };

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
                subtitle="Choose the look that feels right for you."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                rightSlot={
                  <CouplyQuietButton
                    label="Done"
                    onPress={handleBack}
                    accessibilityLabel="Return to previous screen"
                    variant="soft"
                    style={styles.detailDoneBtn}
                  />
                }
                style={styles.headerCouply}
              />

              <CouplySectionCard style={styles.cardCouply}>
                {THEME_LIST.map((t, index) => {
                  const isSelected = t.key === selectedThemeKey;
                  return (
                    <View key={t.key}>
                      {index > 0 && <View style={styles.divider} />}
                      <Pressable
                        style={[
                          styles.actionRow,
                          isSelected && styles.themeRowSelected,
                        ]}
                        onPress={() => setSelectedThemeKey(t.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${t.name}: ${t.description}`}
                      >
                        <View style={styles.rowLeft}>
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
                          <View style={styles.rowTextGroup}>
                            <Text style={styles.rowHeading}>{t.name}</Text>
                            <Text style={styles.rowSubtext}>{t.description}</Text>
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
                    </View>
                  );
                })}
              </CouplySectionCard>

              <CouplyQuietButton
                label="Done"
                onPress={() => setSettingsDetailView(null)}
                accessibilityLabel="Done editing appearance"
                variant="soft"
                style={styles.doneButton}
              />
            </View>
          )}

          {/* Detail View: Sharing choices */}
          {settingsDetailView === "sharing" && (
            <View style={styles.detailWrapper}>
              <CouplyHeader
                title="Sharing choices"
                subtitle="You decide what stays private and what is shared."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                style={styles.headerCouply}
              />

              <CouplySectionCard style={styles.cardCouply}>
                <View style={styles.detailBodyContainer}>
                  <Text style={styles.detailBody}>
                    Mine is for your private reflections, notes, and drafts.
                  </Text>
                  <Text style={[styles.detailBody, { marginTop: 12 }]}>
                    Ours contains only moments you intentionally choose to share
                    with {effectivePartnerRef}.
                  </Text>
                </View>
              </CouplySectionCard>

              <CouplyQuietButton
                label="Got it"
                onPress={() => setSettingsDetailView(null)}
                accessibilityLabel="Close sharing choices"
                variant="soft"
                style={styles.doneButton}
              />
            </View>
          )}

          {/* Detail View: Help */}
          {settingsDetailView === "help" && (
            <View style={styles.detailWrapper}>
              <CouplyHeader
                title="How My Rhythm works"
                subtitle="A gentle rhythm for your relationship."
                onBack={() => setSettingsDetailView(null)}
                backLabel="‹ Settings"
                style={styles.headerCouply}
              />

              <CouplySectionCard style={styles.cardCouply}>
                <View style={styles.detailBodyContainer}>
                  <Text style={styles.detailBody}>
                    My Rhythm helps you notice what matters now, keep private
                    reflections in Mine, and choose what becomes part of Ours.
                  </Text>
                </View>
              </CouplySectionCard>

              <CouplyQuietButton
                label="Got it"
                onPress={() => setSettingsDetailView(null)}
                accessibilityLabel="Close help"
                variant="soft"
                style={styles.doneButton}
              />
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
                style={styles.headerCouply}
              />

              {/* 1. Appearance */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Appearance</Text>
                <CouplySectionCard style={styles.cardCouply}>
                  <Pressable
                    style={styles.actionRow}
                    onPress={() => setSettingsDetailView("appearance")}
                    accessibilityRole="button"
                    accessibilityLabel={`Appearance, current theme: ${theme.name}`}
                  >
                    <View style={styles.rowLeft}>
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
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>Appearance</Text>
                        <Text style={styles.rowSubtext}>{theme.name}</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CouplySectionCard>
              </View>

              {/* 2. Your rhythm */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your rhythm</Text>
                <CouplySectionCard style={styles.cardCouply}>
                  <Pressable
                    style={styles.actionRow}
                    onPress={handleOpenEveningReflection}
                    accessibilityRole="button"
                    accessibilityLabel="Evening reflection: Take a quiet moment whenever it feels useful."
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Evening reflection</Text>
                      <Text style={styles.rowSubtext}>
                        Take a quiet moment whenever it feels useful.
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CouplySectionCard>
                <Text style={styles.infoNote}>
                  You can always skip a reflection. Nothing is required every day.
                </Text>
              </View>

              {/* 3. Privacy and sharing */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Privacy and sharing</Text>
                <CouplySectionCard style={styles.cardCouply}>
                  <View style={styles.staticRow}>
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Private by default</Text>
                      <Text style={styles.rowSubtext}>
                        Your reflections stay in Mine unless you choose to share
                        them.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Pressable
                    style={styles.actionRow}
                    onPress={() => setSettingsDetailView("sharing")}
                    accessibilityRole="button"
                    accessibilityLabel="Sharing choices. You decide what becomes part of Ours."
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Sharing choices</Text>
                      <Text style={styles.rowSubtext}>
                        You decide what becomes part of Ours.
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CouplySectionCard>
              </View>

              {/* 4. Your connection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your connection</Text>
                <CouplySectionCard style={styles.cardCouply}>
                  <View style={styles.connectionHeaderRow}>
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Your connection</Text>
                      <Text style={styles.rowSubtext}>
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

                  <View style={styles.divider} />

                  <Pressable
                    style={styles.actionRow}
                    onPress={() => router.push("/profile")}
                    accessibilityRole="button"
                    accessibilityLabel="Manage connection"
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>Manage connection</Text>
                      <Text style={styles.rowSubtext}>
                        View your profile, connection details, and invite code.
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CouplySectionCard>
              </View>

              {/* 5. Help */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Help</Text>
                <CouplySectionCard style={styles.cardCouply}>
                  <Pressable
                    style={styles.actionRow}
                    onPress={() => setSettingsDetailView("help")}
                    accessibilityRole="button"
                    accessibilityLabel="How My Rhythm works"
                  >
                    <View style={styles.rowTextGroup}>
                      <Text style={styles.rowHeading}>How My Rhythm works</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CouplySectionCard>
              </View>

              {/* 6. Developer previews (Dev only) */}
              {__DEV__ && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Developer previews</Text>
                  <CouplySectionCard style={styles.cardCouply}>
                    <Pressable
                      style={styles.actionRow}
                      onPress={handleOpenEveningReflection}
                      accessibilityRole="button"
                      accessibilityLabel="Preview: Evening reflection"
                    >
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>Evening reflection</Text>
                        <Text style={styles.rowSubtext}>
                          Check-in prompt and feelings before day ends.
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable
                      style={styles.actionRow}
                      onPress={() => router.push("/playful-reframe")}
                      accessibilityRole="button"
                      accessibilityLabel="Dev preview: Playful Reframe"
                    >
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>
                          Dev preview: Playful Reframe
                        </Text>
                        <Text style={styles.rowSubtext}>
                          A lighthearted way to look at a small everyday irritation.
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable
                      style={styles.actionRow}
                      onPress={() => router.push("/challenge-lifecycle-preview")}
                      accessibilityRole="button"
                      accessibilityLabel="Dev preview: Challenge Lifecycle"
                    >
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>
                          Dev preview: Challenge Lifecycle
                        </Text>
                        <Text style={styles.rowSubtext}>
                          Sample outcomes: waiting, accepted, declined, expired, and won.
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable
                      style={styles.actionRow}
                      onPress={() => router.push("/make-challenge-preview" as any)}
                      accessibilityRole="button"
                      accessibilityLabel="Dev preview: Make Your Own Tiny Challenge"
                    >
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowHeading}>
                          Dev preview: Make Your Own Tiny Challenge
                        </Text>
                        <Text style={styles.rowSubtext}>
                          Compose a small, kind invitation with optional timing and preview.
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  </CouplySectionCard>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Fixed Visual Bottom Navigation */}
      <AppBottomNav
        activeTab="settings"
        themeColors={{
          surface: theme.surface,
          border: theme.border,
          accent: theme.accent,
          iconMuted: theme.iconMuted,
          selectedNavigation: theme.selectedNavigation,
          secondaryText: theme.secondaryText,
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: (typeof THEMES)["lavender"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#FBF7FC",
    },
    scrollContent: {
      paddingBottom: 90,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    mainColumn: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      gap: 16,
    },
    headerCouply: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 4,
    },
    cardCouply: {
      marginHorizontal: 0,
      marginBottom: 0,
      padding: 0,
      overflow: "hidden",
    },
    detailDoneBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    header: {
      gap: 6,
      paddingVertical: 4,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    backBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginLeft: -10,
      borderRadius: 8,
    },
    backBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.accent,
    },
    closeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    closeBtnText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: theme.accent,
    },
    pageHeading: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: "#E8DCE9",
      overflow: "hidden",
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 52,
    },
    staticRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    connectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
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
      backgroundColor: "#F0E4F1",
      marginHorizontal: 16,
    },
    infoNote: {
      fontSize: 12.5,
      color: theme.mutedText,
      lineHeight: 17,
      marginLeft: 4,
    },
    connectionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.badgeBackground,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    connectionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.badgeDot,
    },
    connectionLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: theme.accent,
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
      borderColor: "#DCD0DF",
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "#C5B6C8",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    radioOuterSelected: {
      borderColor: theme.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.accent,
    },
    themeRowSelected: {
      backgroundColor: "#FAF4FB",
    },
    detailWrapper: {
      gap: 12,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    detailBodyContainer: {
      padding: 16,
    },
    detailBody: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 21,
    },
    doneButton: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    doneButtonText: {
      color: "#FFFFFF",
      fontSize: 14.5,
      fontWeight: "600",
      letterSpacing: -0.1,
    },
  });
}
