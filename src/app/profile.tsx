import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Button,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setStatus("Loading...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    setEmail(user.email ?? "");

    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(profileError);
      setStatus("Could not load profile");
      return;
    }

    setDisplayName(profile.display_name ?? "");

    // Check whether the user already belongs to a couple
    const { data: membership, error: membershipError } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(membershipError);
      setStatus("Could not load relationship space");
      return;
    }

    setCoupleId(membership?.couple_id ?? null);

    setStatus("");
  }

  async function saveProfile() {
    setStatus("Saving profile...");

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
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setStatus("Profile saved");
  }

  async function createCouple() {
    setStatus("Creating relationship space...");

    const { error } = await supabase.from("couples").insert({});

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setStatus("Relationship space created");

    // Reload page so we get the couple membership created by the trigger
    await loadPage();
  }

  async function createPartnerInvite() {
    if (!coupleId) {
      setStatus("Create a relationship space first.");
      return;
    }

    setStatus("Creating invitation...");

    const { data, error } = await supabase
      .from("couple_invites")
      .insert({
        couple_id: coupleId,
      })
      .select("code")
      .single();

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setInviteCode(data.code);
    setStatus("Invitation created");
  }

  async function acceptPartnerInvite() {
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode) {
      setStatus("Please enter an invite code.");
      return;
    }

    setStatus("Joining relationship space...");

    const { data, error } = await supabase.rpc("accept_couple_invite", {
      invite_code: cleanCode,
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setCoupleId(data);
    setJoinCode("");
    setStatus("Partner connected");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your profile</Text>

      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.email}>{email}</Text>

      <Text style={styles.label}>Display name</Text>

      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
      />

      <View style={styles.section}>
        <Button title="Save profile" onPress={saveProfile} />
      </View>

      <View style={styles.divider} />

      {coupleId ? (
        <>
          <Text style={styles.sectionTitle}>Relationship space</Text>

          <Text>Couple connected</Text>

          <Text style={styles.small}>{coupleId}</Text>

          <View style={styles.section}>
            <Button title="Invite partner" onPress={createPartnerInvite} />
          </View>

          {inviteCode && (
            <View style={styles.inviteBox}>
              <Text style={styles.label}>Partner invite code</Text>

              <Text style={styles.inviteCode}>{inviteCode}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Button
              title="Test relationship events"
              onPress={() => router.push("/events")}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Relationship space</Text>

          <Text style={styles.description}>
            Create a new relationship space or join your partner using an
            invitation code.
          </Text>

          <View style={styles.section}>
            <Button title="Create relationship space" onPress={createCouple} />
          </View>

          <Text style={styles.orText}>or</Text>

          <Text style={styles.label}>Have a partner invite?</Text>

          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Enter invite code"
            autoCapitalize="characters"
          />

          <View style={styles.section}>
            <Button title="Join partner" onPress={acceptPartnerInvite} />
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.section}>
        <Button title="Sign out" onPress={signOut} />
      </View>

      {status !== "" && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },

  description: {
    fontSize: 15,
    marginBottom: 8,
  },

  label: {
    fontSize: 14,
    marginBottom: 6,
  },

  email: {
    fontSize: 16,
    marginBottom: 24,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
  },

  section: {
    marginTop: 16,
  },

  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 28,
  },

  small: {
    fontSize: 12,
    marginTop: 4,
  },

  inviteBox: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
  },

  inviteCode: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
  },

  orText: {
    textAlign: "center",
    marginVertical: 18,
  },

  status: {
    marginTop: 20,
    textAlign: "center",
  },
});
