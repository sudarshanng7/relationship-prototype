import { AppBottomNav } from "@/components/AppBottomNav";
import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPage,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsAuthorized(false);
      setIsRecordSheetOpen(false);

      async function checkUser() {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          router.replace("/");
          return;
        }

        setIsAuthorized(true);
      }

      void checkUser();

      return () => {
        active = false;
      };
    }, [router]),
  );

  function closeRecordSheet() {
    setIsRecordSheetOpen(false);
  }

  function selectMomentType(type: "positive" | "friction") {
    closeRecordSheet();
    router.push({ pathname: "/record-moment", params: { type } });
  }

  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={tokens.colors.plum} />
        <Text style={styles.body}>Loading your space...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <CouplyPage safe={false} contentStyle={styles.content}>
          <CouplyHeader
            overline="RELATIONSHIP OS"
            title="Your space"
            subtitle="A place to remember meaningful moments and understand your relationship over time."
          />

          <CouplySectionCard variant="lilac" style={styles.recordCard}>
            <Text style={styles.overline}>AT YOUR OWN PACE</Text>
            <Text accessibilityRole="header" style={styles.recordTitle}>
              Notice what matters.
            </Text>
            <Text style={styles.body}>
              A small kindness, a good memory, or something that felt difficult.
              You can start with whatever is on your mind.
            </Text>
            <CouplyPrimaryButton
              label="＋ Record a moment"
              accessibilityLabel="Record a moment"
              accessibilityHint="Choose something good or something that felt off."
              onPress={() => setIsRecordSheetOpen(true)}
            />
          </CouplySectionCard>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Two spaces, your choice
            </Text>
            <View style={styles.spaces}>
              <Pressable
                style={({ pressed }) => [styles.spaceCard, styles.mineCard, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: "/events", params: { scope: "mine" } })}
                accessibilityRole="button"
                accessibilityLabel="Open Mine, your private moments"
              >
                <Text accessible={false} style={styles.spaceIcon}>🔒</Text>
                <Text style={styles.spaceTitle}>Mine</Text>
                <Text style={styles.body}>Your private moments, visible only to you.</Text>
                <Text style={styles.spaceAction}>Open Mine →</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.spaceCard, styles.oursCard, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: "/events", params: { scope: "ours" } })}
                accessibilityRole="button"
                accessibilityLabel="Open Ours, your shared moments"
              >
                <Text accessible={false} style={styles.spaceIcon}>♡</Text>
                <Text style={styles.spaceTitle}>Ours</Text>
                <Text style={styles.body}>Moments you intentionally share with your partner.</Text>
                <Text style={styles.spaceAction}>Open Ours →</Text>
              </Pressable>
            </View>
            <CouplyQuietButton
              label="View all moments"
              variant="text"
              onPress={() => router.push("/events")}
            />
          </View>

          <CouplySectionCard style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Begin where you are
            </Text>
            <Text style={styles.body}>
              Your space is here for your own reflections and the moments you choose to share.
            </Text>
            <CouplyQuietButton
              label="Profile & partner connection"
              onPress={() => router.push("/profile")}
            />
          </CouplySectionCard>

          <Text style={styles.footer}>
            Private reflections stay private. You decide what belongs in Ours.
          </Text>
        </CouplyPage>
      </ScrollView>

      <AppBottomNav activeTab="home" />

      <Modal
        visible={isRecordSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRecordSheet}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.backdropDismiss}
            onPress={closeRecordSheet}
            accessibilityRole="button"
            accessibilityLabel="Close moment selection"
          />
          <SafeAreaView style={styles.sheetSafeArea} pointerEvents="box-none">
            <View
              style={styles.sheetPanel}
              accessibilityViewIsModal
              onAccessibilityEscape={closeRecordSheet}
              testID="moment-selection-sheet"
            >
              <ScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
                <Text accessibilityRole="header" style={styles.sheetTitle}>
                  What would you like to record?
                </Text>
                <Text style={styles.body}>Choose what feels closest to this moment.</Text>
                <CouplyChoiceCard
                  title="Something good"
                  description="A kind moment, appreciation, or small joy."
                  accessibilityLabel="Record something good"
                  onPress={() => selectMomentType("positive")}
                  icon={<Text accessible={false} style={styles.choiceIcon}>✦</Text>}
                />
                <CouplyChoiceCard
                  title="Something felt off"
                  description="Tension, hesitation, or a disconnect."
                  accessibilityLabel="Record something that felt off"
                  onPress={() => selectMomentType("friction")}
                  icon={<Text accessible={false} style={styles.choiceIcon}>〰</Text>}
                />
                <CouplyQuietButton label="Not now" onPress={closeRecordSheet} />
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.pageBackground },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: tokens.spacing.sm, paddingBottom: tokens.spacing.xxl },
  content: { gap: tokens.spacing.xxl },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.pageBackground,
  },
  overline: {
    color: tokens.colors.plum,
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  recordCard: { gap: tokens.spacing.lg, padding: tokens.spacing.xl },
  recordTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  section: { gap: tokens.spacing.md },
  sectionTitle: { fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", color: tokens.colors.text },
  spaces: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.md },
  spaceCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 0,
    minHeight: tokens.layout.minTouchTarget,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.sm,
  },
  mineCard: { backgroundColor: tokens.colors.surfaceLilac },
  oursCard: { backgroundColor: tokens.colors.surfaceBlush },
  pressed: { opacity: 0.75 },
  spaceIcon: { fontSize: 26, color: tokens.colors.plum },
  spaceTitle: { fontSize: 20, fontWeight: "700", color: tokens.colors.text },
  spaceAction: { fontSize: tokens.typeScale.body, fontWeight: "600", color: tokens.colors.plum, marginTop: tokens.spacing.sm },
  body: { fontSize: tokens.typeScale.bodyLarge, color: tokens.colors.textSecondary, lineHeight: 22 },
  footer: { textAlign: "center", color: tokens.colors.textMuted, fontSize: tokens.typeScale.caption, lineHeight: 20 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(35, 22, 38, 0.4)" },
  backdropDismiss: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  sheetSafeArea: { flex: 1, justifyContent: "flex-end" },
  sheetPanel: {
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.large,
    borderTopRightRadius: tokens.radii.large,
  },
  sheetContent: { padding: tokens.spacing.page, gap: tokens.spacing.lg },
  sheetTitle: { fontSize: 22, fontWeight: "700", color: tokens.colors.text },
  choiceIcon: { fontSize: 22, color: tokens.colors.plum },
});
