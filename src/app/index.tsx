import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function navigateAfterAuthentication(userId: string) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.error("Could not check onboarding:", error);
      setStatus(error?.message ?? "Profile not found. Please try again.");
      return;
    }

    setStatus("");

    if (profile.onboarding_completed) {
      router.replace("/home");
    } else {
      router.replace("/onboarding");
    }
  }

  async function signIn() {
    if (isSubmitting) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Signing in...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.error(error);
        setStatus(error.message);
        return;
      }

      await navigateAfterAuthentication(data.user.id);
    } catch (err: any) {
      setStatus(err?.message ?? "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signUp() {
    if (isSubmitting) return;

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setStatus("Please enter an email address.");
      return;
    }

    if (!password) {
      setStatus("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Creating account...");

    console.log("Signing up with:", cleanEmail);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.error(error);
        setStatus(error.message);
        return;
      }

      if (data.session && data.user) {
        await navigateAfterAuthentication(data.user.id);
        return;
      }

      setStatus("Account created. Please confirm your email, then sign in.");
    } catch (err: any) {
      setStatus(err?.message ?? "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isErrorMessage =
    status.includes("Please") ||
    status.includes("not found") ||
    status.includes("must be") ||
    status.toLowerCase().includes("error") ||
    status.toLowerCase().includes("invalid");

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
            {/* Brand Area */}
            <View style={styles.brandContainer}>
              <View style={styles.logoRow}>
                <Text style={styles.logoHeart}>♡</Text>
                <Text style={styles.brandTitle}>Couply</Text>
              </View>
              <Text style={styles.brandSubtitle}>
                A private place to notice, repair, and reconnect together.
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Segmented Mode Selector */}
              <View
                style={styles.modeSelector}
                accessibilityRole="tablist"
              >
                <Pressable
                  style={[
                    styles.modeTab,
                    mode === "sign_in" && styles.modeTabActive,
                  ]}
                  onPress={() => {
                    setMode("sign_in");
                    setStatus("");
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === "sign_in" }}
                  accessibilityLabel="Sign in mode"
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      mode === "sign_in" && styles.modeTabTextActive,
                    ]}
                  >
                    Sign in
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modeTab,
                    mode === "sign_up" && styles.modeTabActive,
                  ]}
                  onPress={() => {
                    setMode("sign_up");
                    setStatus("");
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === "sign_up" }}
                  accessibilityLabel="Create account mode"
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      mode === "sign_up" && styles.modeTabTextActive,
                    ]}
                  >
                    Create account
                  </Text>
                </Pressable>
              </View>

              {/* Email Field */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#8E7E94"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="Email address"
                />
              </View>

              {/* Password Field */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder={
                      mode === "sign_up"
                        ? "At least 6 characters"
                        : "Enter your password"
                    }
                    placeholderTextColor="#8E7E94"
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    secureTextEntry={!showPassword}
                    onSubmitEditing={mode === "sign_in" ? signIn : signUp}
                    value={password}
                    onChangeText={setPassword}
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    style={styles.passwordToggleBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Primary Action Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  isSubmitting && styles.primaryButtonDisabled,
                ]}
                onPress={mode === "sign_in" ? signIn : signUp}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isSubmitting,
                  busy: isSubmitting,
                }}
                accessibilityLabel={
                  isSubmitting
                    ? mode === "sign_in"
                      ? "Signing in"
                      : "Creating account"
                    : mode === "sign_in"
                    ? "Sign in"
                    : "Create account"
                }
              >
                {isSubmitting ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>
                      {mode === "sign_in"
                        ? "Signing in..."
                        : "Creating account..."}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === "sign_in" ? "Sign in" : "Create account"}
                  </Text>
                )}
              </Pressable>

              {/* Status and Error Feedback */}
              {status !== "" && (
                <View
                  style={styles.statusCard}
                  accessibilityRole={isErrorMessage ? "alert" : undefined}
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              )}
            </View>

            {/* Privacy Reassurance Card */}
            <View style={styles.reassuranceCard}>
              <View style={styles.reassuranceHeaderRow}>
                <Text style={styles.reassuranceIcon}>🔒</Text>
                <Text style={styles.reassuranceHeading}>
                  Your space stays intentional
                </Text>
              </View>
              <Text style={styles.reassuranceBody}>
                Your private reflections stay yours. Shared moments are always
                intentional.
              </Text>
            </View>
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
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 18,
  },

  /* Brand Area */
  brandContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoHeart: {
    fontSize: 26,
    color: "#6E416D",
    lineHeight: 30,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 14.5,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },

  /* Form Card */
  formCard: {
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

  /* Segmented Mode Selector */
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "#F1EDF7",
    borderRadius: 14,
    padding: 3,
    marginBottom: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  modeTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  modeTabText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#6D6072",
  },
  modeTabTextActive: {
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Form Fields */
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

  /* Password Field Container with Show/Hide */
  passwordContainer: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: "#3D3040",
  },
  passwordToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  passwordToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Primary Action Button */
  primaryButton: {
    backgroundColor: "#6E416D",
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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

  /* Status and Feedback */
  statusCard: {
    backgroundColor: "#F7EEF7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 13.5,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },

  /* Privacy Reassurance Card */
  reassuranceCard: {
    backgroundColor: "#F7EEF7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 4,
  },
  reassuranceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reassuranceIcon: {
    fontSize: 14,
  },
  reassuranceHeading: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  reassuranceBody: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
});
