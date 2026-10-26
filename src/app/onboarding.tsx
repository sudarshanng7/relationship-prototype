import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

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
        router.replace("/profile");
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

      router.replace("/profile");
    } catch (error) {
      console.error("Onboarding failed:", error);
      setErrorMessage("Could not save your setup.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.helpText}>Loading your setup...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.step}>GETTING STARTED</Text>

      <Text style={styles.title}>Welcome to Relationship OS</Text>

      <Text style={styles.description}>
        We&apos;re not here to tell you how relationships work. We&apos;re here to help
        you understand how yours works.
      </Text>

      <View style={styles.section}>
        <Text style={styles.heading}>What should we call you?</Text>

        <Text style={styles.helpText}>
          Use the name or nickname you prefer. You can change it later.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Your preferred name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={60}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={styles.optional}>Optional</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>
          A space for you, and a space for both of you
        </Text>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Mine</Text>
          <Text style={styles.helpText}>
            A private moment stays visible only to you. It won&apos;t be shared with
            your partner.
          </Text>
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Ours</Text>
          <Text style={styles.helpText}>
            A shared moment can be seen by your connected partner.
          </Text>
        </View>

        <Text style={styles.helpText}>
          You&apos;ll choose who can see a moment before saving it.
        </Text>
      </View>

      <View style={styles.buttonSection}>
        <Button
          title={saving ? "Saving..." : "Continue"}
          onPress={completeOnboarding}
          disabled={saving}
        />
      </View>

      <Text style={styles.optional}>
        You can continue without adding a name.
      </Text>

      {errorMessage !== "" && <Text style={styles.error}>{errorMessage}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  step: {
    fontSize: 12,
    fontWeight: "700",
    color: "#537F76",
    marginBottom: 12,
  },

  title: {
    fontSize: 29,
    fontWeight: "bold",
    marginBottom: 16,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
  },

  section: {
    marginTop: 32,
  },

  heading: {
    fontSize: 19,
    fontWeight: "600",
    marginBottom: 10,
  },

  helpText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#666",
    marginBottom: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginTop: 8,
  },

  optional: {
    fontSize: 12,
    color: "#777",
    marginTop: 10,
    textAlign: "center",
  },

  privacyCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },

  privacyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },

  buttonSection: {
    marginTop: 32,
  },

  error: {
    marginTop: 16,
    color: "#B42318",
    textAlign: "center",
  },
});
