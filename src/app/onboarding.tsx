import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import {
  AccountSessionBoundary, useAccountSessionScope,
} from "@/components/AccountSessionBoundary";

export default function OnboardingScreen() {
  return (
    <AccountSessionBoundary routeKey="onboarding">
      <OnboardingContent />
    </AccountSessionBoundary>
  );
}

function OnboardingContent() {
  const scope = useAccountSessionScope();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const requestId = useRef(0);
  const writeState = useRef<"idle" | "pending" | "uncertain" | "saved">("idle");

  const loadSetup = useCallback(async () => {
    if (!scope.isCurrent() || writeState.current === "pending" || writeState.current === "saved") return;
    const id = ++requestId.current;
    const valid = () => scope.isCurrent() && id === requestId.current;
    setReady(false);
    setLoading(true);
    setDisplayName("");
    setErrorMessage("");
    setNeedsReload(false);
    try {
      const auth = await scope.authorize();
      if (!auth || !valid()) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, onboarding_completed")
        .eq("id", scope.userId)
        .maybeSingle()
        .setHeader("Authorization", `Bearer ${auth.token}`);
      if (!valid() || !(await scope.authorize()) || !valid()) return;
      if (error || !data || data.id !== scope.userId) throw new Error("Profile unavailable");
      if (data.onboarding_completed) {
        writeState.current = "saved";
        router.replace("/profile");
        return;
      }
      setDisplayName(data.display_name ?? "");
      setReady(true);
      writeState.current = "idle";
    } catch {
      if (valid()) {
        setErrorMessage("Could not load your setup. Please reload to continue.");
        setNeedsReload(true);
      }
    } finally {
      if (valid()) setLoading(false);
    }
  }, [router, scope]);

  // The boundary keys content by account/focus visit and invalidates pending
  // work on blur/unmount. Same-account token refreshes keep the draft.
  useFocusEffect(useCallback(() => {
    void loadSetup();
  }, [loadSetup]));

  async function completeOnboarding() {
    if (!ready || !scope.isCurrent() || writeState.current !== "idle") return;
    // Capture the draft before awaiting authorization, within its account scope.
    const cleanName = displayName.trim() || null;
    writeState.current = "pending";
    const id = ++requestId.current;
    const valid = () => scope.isCurrent() && id === requestId.current;
    let dispatched = false;
    setSaving(true);
    setErrorMessage("");

    try {
      const auth = await scope.authorize();
      if (!auth || !valid()) return;
      dispatched = true;
      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scope.userId)
        .select("id")
        .single()
        .setHeader("Authorization", `Bearer ${auth.token}`);
      if (!valid()) return;
      const acknowledged = !error && data?.id === scope.userId;
      if (acknowledged) writeState.current = "saved";
      if (!(await scope.authorize(acknowledged ? "Your setup was saved." : undefined)) || !valid()) return;
      if (!acknowledged) throw new Error("Save outcome unconfirmed");
      router.replace("/profile");
    } catch {
      if (!valid() || !(await scope.authorize()) || !valid()) return;
      // A transport failure may follow a committed update. Only a read may be
      // retried; even a retained Continue handler cannot resubmit this attempt.
      writeState.current = dispatched ? "uncertain" : "idle";
      setNeedsReload(dispatched);
      setErrorMessage(dispatched
        ? "We couldn't confirm whether your setup was saved. Reload setup to check before continuing."
        : "Could not verify your setup. Please try again.");
    } finally {
      if (valid()) setSaving(false);
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
          editable={ready && !saving && !needsReload}
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
          disabled={!ready || saving || needsReload}
        />
        {needsReload && <Button title="Reload setup" onPress={() => { void loadSetup(); }} />}
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
