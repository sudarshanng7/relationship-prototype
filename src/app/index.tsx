import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

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
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setStatus("Please enter your email and password.");
      return;
    }
    setStatus("Signing in...");

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
  }

  async function signUp() {
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

    setStatus("Creating account...");

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
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Relationship OS</Text>

      <Text style={styles.subtitle}>Welcome</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.button}>
        <Button title="Sign in" onPress={signIn} />
      </View>

      <View style={styles.button}>
        <Button title="Create account" onPress={signUp} />
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    marginBottom: 12,
  },
  status: {
    marginTop: 16,
    textAlign: "center",
  },
});
