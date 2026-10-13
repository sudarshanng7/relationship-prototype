import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Button,
  Pressable,
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
  const [editedName, setEditedName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);

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

    // Load current user's profile
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

    const currentName = profile.display_name ?? "";

    setDisplayName(currentName);
    setEditedName(currentName);
    setIsEditing(false);

    // Load relationship membership
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

    const currentCoupleId = membership?.couple_id ?? null;

    setCoupleId(currentCoupleId);
    setPartnerConnected(false);
    setPartnerName(null);
    setInviteCode(null);

    if (currentCoupleId) {
      // Find the partner in the same couple
      const { data: members, error: membersError } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", currentCoupleId);

      if (membersError) {
        console.error(membersError);
        setStatus("Could not load relationship members");
        return;
      }

      const partnerMember = members?.find(
        (member) => member.user_id !== user.id,
      );

      if (partnerMember) {
        // STATE 3: Partner connected
        setPartnerConnected(true);

        const { data: name, error: partnerNameError } = await supabase.rpc(
          "get_partner_display_name",
        );

        if (partnerNameError) {
          console.error("Could not load partner name:", partnerNameError);
        }

        setPartnerName(typeof name === "string" ? name.trim() || null : null);
      } else {
        // STATE 1 or 2: Check for an existing invitation
        const { data: existingInvite, error: inviteError } = await supabase
          .from("couple_invites")
          .select("code")
          .eq("couple_id", currentCoupleId)
          .eq("created_by", user.id)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inviteError) {
          console.error("Could not load existing invitation:", inviteError);
          setStatus("Could not load invitation");
          return;
        }

        setInviteCode(existingInvite?.code ?? null);
      }
    }

    setStatus("");
  }

  // ---------------------------
  // PROFILE EDITING
  // ---------------------------

  function startEditing() {
    setEditedName(displayName);
    setIsEditing(true);
    setStatus("");
  }

  function cancelEditing() {
    setEditedName(displayName);
    setIsEditing(false);
    setStatus("");
  }

  async function saveProfile() {
    const cleanName = editedName.trim();

    if (!cleanName) {
      setStatus("Please enter a display name.");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    setStatus("Saving profile...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus("Please sign in again.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        console.error(error);
        setStatus(error.message);
        return;
      }

      setDisplayName(cleanName);
      setEditedName(cleanName);
      setIsEditing(false);
      setStatus("Profile updated successfully");
    } catch (error) {
      console.error(error);
      setStatus("Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------
  // COUPLE CREATION
  // ---------------------------

  async function createCouple() {
    setStatus("Creating relationship space...");

    const { error } = await supabase.from("couples").insert({});

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setInviteCode(null);
    await loadPage();
  }

  // ---------------------------
  // PARTNER INVITATION
  // ---------------------------

  async function createPartnerInvite() {
    if (!coupleId) {
      setStatus("Create a relationship space first.");
      return;
    }

    if (partnerConnected) {
      setStatus("Your partner is already connected.");
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

    const { error } = await supabase.rpc("accept_couple_invite", {
      invite_code: cleanCode,
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setJoinCode("");
    await loadPage();
    setStatus("Partner connected");
  }

  // ---------------------------
  // SIGN OUT
  // ---------------------------

  async function signOut() {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setInviteCode(null);
    setPartnerName(null);
    setPartnerConnected(false);
    setCoupleId(null);

    router.replace("/");
  }

  // ---------------------------
  // USER INTERFACE
  // ---------------------------

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your profile</Text>

      {/* PROFILE INFORMATION */}

      <View style={styles.profileCard}>
        {!isEditing ? (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {displayName || "Add your name"}
                </Text>

                <Text style={styles.email}>{email}</Text>
              </View>

              <Pressable style={styles.editButton} onPress={startEditing}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Display name</Text>

            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Your preferred name"
              autoCapitalize="words"
              autoFocus
              maxLength={60}
              editable={!isSaving}
            />

            <Text style={styles.helperText}>
              This is the name your partner will see.
            </Text>

            <View style={styles.editActions}>
              <View style={styles.actionButton}>
                <Button
                  title={isSaving ? "Saving..." : "Save"}
                  onPress={saveProfile}
                  disabled={
                    isSaving ||
                    !editedName.trim() ||
                    editedName.trim() === displayName
                  }
                />
              </View>

              <View style={styles.actionButton}>
                <Button
                  title="Cancel"
                  onPress={cancelEditing}
                  disabled={isSaving}
                />
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.divider} />

      {/* RELATIONSHIP SPACE */}

      <Text style={styles.sectionTitle}>Relationship space</Text>

      {coupleId ? (
        <>
          {partnerConnected ? (
            <>
              <Text style={styles.connectedText}>
                {partnerName
                  ? `✓ Connected with ${partnerName}`
                  : "✓ Connected with your partner"}
              </Text>

              <Text style={styles.description}>
                You now share a relationship space.
              </Text>
            </>
          ) : inviteCode ? (
            <>
              <Text style={styles.waitingText}>Waiting for your partner</Text>

              <Text style={styles.description}>
                Share this invitation code with your partner.
              </Text>

              <View style={styles.inviteBox}>
                <Text style={styles.label}>Partner invite code</Text>

                <Text style={styles.inviteCode}>{inviteCode}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Your relationship space is ready. Invite your partner when
                you're ready.
              </Text>

              <View style={styles.section}>
                <Button title="Invite partner" onPress={createPartnerInvite} />
              </View>
            </>
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

// ---------------------------
// STYLES
// ---------------------------

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

  profileCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 18,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  profileInfo: {
    flex: 1,
    paddingRight: 12,
  },

  profileName: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },

  email: {
    fontSize: 14,
    color: "#666",
  },

  editButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },

  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  editActions: {
    flexDirection: "row",
    marginTop: 18,
    gap: 12,
  },

  actionButton: {
    flex: 1,
  },

  helperText: {
    fontSize: 12,
    color: "#777",
    marginTop: 8,
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

  connectedText: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },

  waitingText: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },

  label: {
    fontSize: 14,
    marginBottom: 6,
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
