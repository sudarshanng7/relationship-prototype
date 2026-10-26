import {
  AccountSessionBoundary, useAccountSessionScope, type AuthorizedIdentity,
} from "@/components/AccountSessionBoundary";
import { signOutAccount } from "@/lib/auth-transitions";
import { AppBottomNav } from "@/components/AppBottomNav";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
  return (
    <AccountSessionBoundary routeKey="profile">
      <ProfileContent />
    </AccountSessionBoundary>
  );
}

function ProfileContent() {
  const scope = useAccountSessionScope();
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

  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const committedNotice = useRef("");
  const requestId = useRef(0);
  const writeInFlight = useRef(false);
  const mutationGeneration = useRef(0);
  const signingOut = useRef(false);

  const clearPrivateState = useCallback(() => {
    setEmail("");
    setDisplayName("");
    setEditedName("");
    setIsEditing(false);
    setCoupleId(null);
    setPartnerConnected(false);
    setPartnerName(null);
    setInviteCode(null);
    setJoinCode("");
    setReady(false);
  }, []);

  const loadPage = useCallback(async () => {
    const id = ++requestId.current;
    const valid = () => scope.isCurrent() && id === requestId.current;
    if (!valid()) return false;
    clearPrivateState();
    setLoadFailed(false);
    setStatus(committedNotice.current ? `${committedNotice.current}. Refreshing profile...` : "Loading...");
    try {
      const auth = await scope.authorize(committedNotice.current);
      if (!auth || !valid()) return false;
      const bearer = `Bearer ${auth.token}`;
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("display_name").eq("id", scope.userId)
        .single().setHeader("Authorization", bearer);
      if (!valid()) return false;
      if (profileError || !profile) throw new Error("Could not load profile");

      const { data: membership, error: membershipError } = await supabase
        .from("couple_members").select("couple_id").eq("user_id", scope.userId)
        .maybeSingle().setHeader("Authorization", bearer);
      if (!valid()) return false;
      if (membershipError) throw new Error("Could not load relationship space");

      const currentCoupleId = membership?.couple_id ?? null;
      let connected = false;
      let name: string | null = null;
      let code: string | null = null;
      if (currentCoupleId) {
        const { data: members, error: membersError } = await supabase
          .from("couple_members").select("user_id").eq("couple_id", currentCoupleId)
          .setHeader("Authorization", bearer);
        if (!valid()) return false;
        if (membersError) throw new Error("Could not load relationship members");
        connected = Boolean(members?.some((member) => member.user_id !== scope.userId));
        if (connected) {
          const { data } = await supabase.rpc("get_partner_display_name")
            .setHeader("Authorization", bearer);
          if (!valid()) return false;
          name = typeof data === "string" ? data.trim() || null : null;
        } else {
          const { data: invite, error: inviteError } = await supabase
            .from("couple_invites").select("code")
            .eq("couple_id", currentCoupleId).eq("created_by", scope.userId)
            .eq("status", "pending").gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false }).limit(1).maybeSingle()
            .setHeader("Authorization", bearer);
          if (!valid()) return false;
          if (inviteError) throw new Error("Could not load invitation");
          code = invite?.code ?? null;
        }
      }
      if (!valid() || !(await scope.authorize(committedNotice.current)) || !valid()) return false;
      // Publish one identity-consistent snapshot, never a partial old-account view.
      setEmail(auth.user.email ?? "");
      setDisplayName(profile.display_name ?? "");
      setEditedName(profile.display_name ?? "");
      setCoupleId(currentCoupleId);
      setPartnerConnected(connected);
      setPartnerName(name);
      setInviteCode(code);
      setReady(true);
      setStatus(committedNotice.current);
      committedNotice.current = "";
      return true;
    } catch (error) {
      if (valid()) {
        const message = error instanceof Error ? error.message : "Could not load profile";
        setStatus(`${committedNotice.current ? `${committedNotice.current}. ` : ""}${message}. Retry loading your profile.`);
        setLoadFailed(true);
      }
      return false;
    }
  }, [clearPrivateState, scope]);

  useFocusEffect(useCallback(() => {
    void loadPage();
  }, [loadPage]));

  async function performWrite<T>(
    pending: string,
    action: (auth: AuthorizedIdentity) => Promise<T>,
    onSuccess: (result: T) => void,
    reloadNotice = "",
  ) {
    if (!ready || !scope.isCurrent() || writeInFlight.current) return;
    const generation = ++mutationGeneration.current;
    const valid = () => scope.isCurrent() && generation === mutationGeneration.current;
    writeInFlight.current = true;
    requestId.current++;
    setIsSaving(true);
    setStatus(pending);
    try {
      const auth = await scope.authorize();
      if (!auth || !valid()) return;
      const result = await action(auth);
      if (!valid()) return;
      if (reloadNotice) {
        // The mutation committed. Retry may repeat only the follow-up reads.
        committedNotice.current = reloadNotice;
        if (await loadPage() && valid()) onSuccess(result);
        return;
      }
      if (!valid() || !(await scope.authorize()) || !valid()) return;
      if (valid()) onSuccess(result);
    } catch (error) {
      if (valid()) setStatus(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setIsSaving(false);
      }
    }
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
    await performWrite("Saving profile...", async ({ token }) => {
      const { error } = await supabase.from("profiles")
        .update({ display_name: cleanName, updated_at: new Date().toISOString() })
        .eq("id", scope.userId).setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
    }, () => {
      setDisplayName(cleanName);
      setEditedName(cleanName);
      setIsEditing(false);
      setStatus("Profile updated successfully");
    });
  }

  async function createCouple() {
    await performWrite("Creating relationship space...", async ({ token }) => {
      const { error } = await supabase.from("couples").insert({})
        .setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
    }, () => {}, "Relationship space created");
  }

  async function createPartnerInvite() {
    if (!coupleId) { setStatus("Create a relationship space first."); return; }
    if (partnerConnected) { setStatus("Your partner is already connected."); return; }
    await performWrite("Creating invitation...", async ({ token }) => {
      const { data, error } = await supabase.from("couple_invites")
        .insert({ couple_id: coupleId }).select("code").single()
        .setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
      return data.code as string;
    }, (code) => {
      setInviteCode(code);
      setStatus("Invitation created");
    });
  }

  async function acceptPartnerInvite() {
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) { setStatus("Please enter an invite code."); return; }
    await performWrite("Joining relationship space...", async ({ token }) => {
      const { error } = await supabase.rpc("accept_couple_invite", { invite_code: cleanCode })
        .setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
    }, () => {
      setJoinCode("");
      setStatus("Partner connected");
    }, "Partner connected");
  }

  async function signOut() {
    if (!scope.isCurrent() || signingOut.current) return;
    signingOut.current = true;
    mutationGeneration.current++;
    writeInFlight.current = true;
    requestId.current++;
    committedNotice.current = "";
    setLoadFailed(false);
    clearPrivateState();
    setIsSaving(true);
    setStatus("Signing out...");
    try {
      const result = await signOutAccount(scope.userId, scope.isCurrent);
      if (!scope.isCurrent()) return;
      if (result?.error) throw new Error(result.error.message);
    } catch (error) {
      if (!scope.isCurrent()) return;
      await loadPage();
      if (scope.isCurrent()) setStatus(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      if (scope.isCurrent()) {
        signingOut.current = false;
        writeInFlight.current = false;
        setIsSaving(false);
      }
    }
  }

  // ---------------------------
  // USER INTERFACE
  // ---------------------------

  if (!ready) {
    return (
      <View>
        <Text>{status}</Text>
        {loadFailed && <Button title="Retry" onPress={() => { void loadPage(); }} disabled={isSaving} />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your profile</Text>
        <View style={styles.section}>
          <Button title="Go to Home" onPress={() => router.replace("/home")} />
        </View>

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

                <Pressable style={styles.editButton} onPress={startEditing} disabled={isSaving}>
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
                  <Button
                    title="Invite partner"
                    onPress={createPartnerInvite}
                    disabled={isSaving}
                  />
                </View>
              </>
            )}

            <View style={styles.section}>
              <Button
                title="View moments"
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
              <Button
                title="Create relationship space"
                onPress={createCouple}
                disabled={isSaving}
              />
            </View>

            <Text style={styles.orText}>or</Text>

            <Text style={styles.label}>Have a partner invite?</Text>

            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Enter invite code"
              autoCapitalize="characters"
              editable={!isSaving}
            />

            <View style={styles.section}>
              <Button title="Join partner" onPress={acceptPartnerInvite} disabled={isSaving} />
            </View>
          </>
        )}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Button title="Sign out" onPress={signOut} />
        </View>

        {status !== "" && <Text style={styles.status}>{status}</Text>}
      </ScrollView>

      <AppBottomNav activeTab="settings" />
    </View>
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
