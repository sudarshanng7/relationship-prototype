import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function OnboardingScreen() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSetup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setErrorMessage(error?.message ?? "Your profile could not be found.");
        setLoading(false);
        return;
      }

      if (data.onboarding_completed) {
        router.replace("/home");
        return;
      }

      setDisplayName(data.display_name ?? "");
      setLoading(false);
    }

    checkSetup();

    return () => {
      active = false;
    };
  }, [router]);

  async function completeOnboarding() {
    if (saving) return;

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/home");
    } catch (error) {
      console.error("Onboarding failed:", error);
      setErrorMessage("Could not save your setup.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6E416D" />
          <Text style={styles.loadingText}>Loading your setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {/* Header / Brand Area */}
            <View style={styles.headerContainer}>
              <View style={styles.logoRow}>
                <Text style={styles.logoHeart}>♡</Text>
                <Text style={styles.brandTitle}>Couply</Text>
              </View>
              <Text style={styles.mainHeading}>Welcome to your space</Text>
              <Text style={styles.supportingText}>
                A calm, private place to notice, reflect, and reconnect.
              </Text>
            </View>

            {/* Name Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderGroup}>
                <Text style={styles.cardHeading}>What should we call you?</Text>
                <Text style={styles.cardDescription}>
                  Use your first name or a nickname. You can change this anytime.
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Preferred name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your preferred name"
                  placeholderTextColor="#8E7E94"
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={60}
                  autoCapitalize="words"
                  returnKeyType="done"
                  editable={!saving}
                  accessibilityLabel="Preferred name (optional)"
                  onSubmitEditing={completeOnboarding}
                />
              </View>
            </View>

            {/* Privacy Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderGroup}>
                <Text style={styles.cardHeading}>
                  Two spaces, designed for trust
                </Text>
              </View>

              <View style={styles.spacesBlock}>
                {/* Mine Space */}
                <View style={styles.spaceCardMine}>
                  <Text style={styles.spaceBadgeMine}>Mine</Text>
                  <Text style={styles.spaceText}>
                    Only you can see this. A quiet place for private thoughts and
                    personal reflections.
                  </Text>
                </View>

                {/* Ours Space */}
                <View style={styles.spaceCardOurs}>
                  <Text style={styles.spaceBadgeOurs}>Ours</Text>
                  <Text style={styles.spaceText}>
                    Shared with your partner. Moments only become shared when you
                    intentionally choose to share them.
                  </Text>
                </View>
              </View>

              <View style={styles.reassuranceRow}>
                <Text style={styles.reassuranceIcon}>🔒</Text>
                <Text style={styles.reassuranceText}>
                  Nothing is shared automatically. You are always in control.
                </Text>
              </View>
            </View>

            {/* Error Message Card if any */}
            {errorMessage !== "" && (
              <View
                style={styles.errorCard}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Continue Action */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                saving && styles.primaryButtonDisabled,
              ]}
              onPress={completeOnboarding}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
              accessibilityLabel={
                saving ? "Setting up your space" : "Continue to your space"
              }
            >
              {saving ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    Setting up your space...
                  </Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>
                  Continue to your space
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7FC",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  column: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 18,
  },

  /* Center / Loading State */
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14.5,
    color: "#6D6072",
    fontWeight: "500",
  },

  /* Brand / Header */
  headerContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoHeart: {
    fontSize: 24,
    color: "#6E416D",
    lineHeight: 28,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.4,
  },
  mainHeading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  supportingText: {
    fontSize: 14.5,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 10,
  },

  /* White Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 22,
    gap: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderGroup: {
    gap: 4,
  },
  cardHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6D6072",
    lineHeight: 20,
  },

  /* Field Block */
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
  },
  input: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#3D3040",
  },

  /* Privacy Spaces Block */
  spacesBlock: {
    gap: 10,
  },
  spaceCardMine: {
    backgroundColor: "#F1EDF7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3DBEB",
    padding: 14,
    gap: 4,
  },
  spaceBadgeMine: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#4E3F50",
    letterSpacing: 0.2,
  },
  spaceCardOurs: {
    backgroundColor: "#FBEFF7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEDCEB",
    padding: 14,
    gap: 4,
  },
  spaceBadgeOurs: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#703866",
    letterSpacing: 0.2,
  },
  spaceText: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 19,
  },
  reassuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  reassuranceIcon: {
    fontSize: 13,
  },
  reassuranceText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
    flex: 1,
  },

  /* Primary Button */
  primaryButton: {
    backgroundColor: "#6E416D",
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonPressed: {
    backgroundColor: "#593258",
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  buttonLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  /* Error Feedback Card */
  errorCard: {
    backgroundColor: "#F7EEF7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 13.5,
    color: "#B42318",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },
});
