import { signInWithPassword, signUp as signUpAccount } from "@/lib/auth-transitions";
import { useRouter } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const authAttempt = useRef(0);
  const authInFlight = useRef(false);
  const [authPending, setAuthPending] = useState(false);

  useLayoutEffect(() => () => { authAttempt.current++; }, []);

  async function navigateAfterAuthentication(userId: string, attempt: number) {
    const { data: before, error: beforeError } = await supabase.auth.getSession();
    if (attempt !== authAttempt.current) return;
    if (beforeError || before.session?.user.id !== userId) {
      setStatus("Your session could not be confirmed. Please sign in again.");
      return;
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle()
      .setHeader("Authorization", `Bearer ${before.session.access_token}`);

    const { data: after, error: afterError } = await supabase.auth.getSession();
    if (attempt !== authAttempt.current) return;
    if (afterError || after.session?.user.id !== userId) {
      setStatus("Your session changed or ended. Please sign in again.");
      return;
    }

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
    if (authInFlight.current) return;
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setStatus("Please enter your email and password.");
      return;
    }
    setStatus("Signing in...");
    const attempt = ++authAttempt.current;
    authInFlight.current = true;
    setAuthPending(true);
    try {
      const { data, error } = await signInWithPassword({ email: cleanEmail, password });
      if (attempt !== authAttempt.current) return;
      if (error) { setStatus(error.message); return; }
      if (!data.user) { setStatus("Sign-in could not be confirmed. Please try again."); return; }
      await navigateAfterAuthentication(data.user.id, attempt);
    } catch {
      if (attempt === authAttempt.current) setStatus("Could not complete sign-in. Please try again.");
    } finally {
      if (attempt === authAttempt.current) {
        authInFlight.current = false;
        setAuthPending(false);
      }
    }
  }

  async function signUp() {
    if (authInFlight.current) return;
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
    const attempt = ++authAttempt.current;
    authInFlight.current = true;
    setAuthPending(true);
    try {
      const { data, error } = await signUpAccount({ email: cleanEmail, password });
      if (attempt !== authAttempt.current) return;
      if (error) { setStatus(error.message); return; }
      if (!data.user) { setStatus("Account creation could not be confirmed. Please try again."); return; }
      if (data.session) {
        await navigateAfterAuthentication(data.user.id, attempt);
        return;
      }
      setStatus("Account created. Please confirm your email, then sign in.");
    } catch {
      if (attempt === authAttempt.current) setStatus("Could not complete account creation. Please try again.");
    } finally {
      if (attempt === authAttempt.current) {
        authInFlight.current = false;
        setAuthPending(false);
      }
    }
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
        <Button title="Sign in" onPress={signIn} disabled={authPending} />
      </View>

      <View style={styles.button}>
        <Button title="Create account" onPress={signUp} disabled={authPending} />
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
