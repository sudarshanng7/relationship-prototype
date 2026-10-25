import {
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { useUserIdentity } from "@/context/UserIdentityContext";
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

export default function ProfileScreen() {
  const router = useRouter();
  const { refreshIdentity } = useUserIdentity();

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
      void refreshIdentity();
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
    void refreshIdentity();
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
    void refreshIdentity();
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
    void refreshIdentity();

    router.replace("/");
  }

  // Safe user initial fallback
  const userInitial =
    (displayName.trim() || email.trim() || "?")[0]?.toUpperCase() ?? "•";

  const isErrorStatus =
    status !== "" &&
    /could not|please|error|failed|already/i.test(status);

  // Calm initial loading screen
  if (status === "Loading..." && !email) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6E416D" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* IN-PAGE HEADER */}
            <CouplyHeader
              overline="YOUR SPACE"
              title="Your profile"
              subtitle="Your details and the space you share, at your pace."
              style={styles.headerCouply}
            />

            {/* QUICK LINK TO MY RHYTHM */}
            <CouplyQuietButton
              label="Go to My Rhythm"
              onPress={() => router.push("/home")}
              accessibilityLabel="Go to My Rhythm"
              variant="soft"
              style={styles.homeLinkBtnCouply}
            />

            {/* STATUS FEEDBACK CARD */}
            {status !== "" && (
              <View
                style={styles.statusCard}
                accessibilityRole={isErrorStatus ? "alert" : undefined}
                accessibilityLiveRegion="polite"
              >
                <Text
                  style={[
                    styles.statusText,
                    isErrorStatus && styles.statusErrorText,
                  ]}
                >
                  {status}
                </Text>
              </View>
            )}

            {/* PERSONAL DETAILS CARD */}
            <CouplySectionCard style={styles.cardCouply}>
              <Text style={styles.cardSectionHeading}>Personal details</Text>

              {!isEditing ? (
                <View style={styles.profileViewRow}>
                  <View style={styles.avatarBubble}>
                    <Text style={styles.avatarInitial}>{userInitial}</Text>
                  </View>

                  <View style={styles.profileInfoColumn}>
                    <Text style={styles.profileDisplayName}>
                      {displayName || "Add your name"}
                    </Text>
                    <Text style={styles.profileEmail}>{email}</Text>
                  </View>

                  <CouplyQuietButton
                    label="Edit"
                    onPress={startEditing}
                    accessibilityLabel="Edit your preferred name"
                    variant="soft"
                    style={styles.editBtnCouply}
                  />
                </View>
              ) : (
                <View style={styles.editForm}>
                  <Text style={styles.fieldLabel}>Preferred name</Text>

                  <TextInput
                    style={styles.input}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Your preferred name"
                    placeholderTextColor="#9E90A3"
                    autoCapitalize="words"
                    autoFocus
                    maxLength={60}
                    editable={!isSaving}
                    accessibilityLabel="Preferred name"
                  />

                  <Text style={styles.helperText}>
                    This is the name your partner will see.
                  </Text>

                  <View style={styles.editActionsRow}>
                    <CouplyPrimaryButton
                      label={isSaving ? "Saving..." : "Save"}
                      onPress={saveProfile}
                      disabled={
                        isSaving ||
                        !editedName.trim() ||
                        editedName.trim() === displayName
                      }
                      loading={isSaving}
                      accessibilityLabel={
                        isSaving ? "Saving profile" : "Save preferred name"
                      }
                      style={styles.flexButton}
                    />

                    <CouplyQuietButton
                      label="Cancel"
                      onPress={cancelEditing}
                      disabled={isSaving}
                      accessibilityLabel="Cancel editing preferred name"
                      variant="soft"
                      style={styles.flexButton}
                    />
                  </View>
                </View>
              )}
            </CouplySectionCard>

            {/* RELATIONSHIP SPACE CARD */}
            <CouplySectionCard style={styles.cardCouply}>
              <Text style={styles.cardSectionHeading}>Relationship space</Text>

              {coupleId ? (
                <View style={styles.spaceContent}>
                  {partnerConnected ? (
                    <View style={styles.connectedCard}>
                      <Text style={styles.connectedHeading}>
                        {partnerName
                          ? `Connected with ${partnerName}`
                          : "Connected with your partner"}
                      </Text>
                      <Text style={styles.connectedBody}>
                        You share this intentional space together.
                      </Text>
                    </View>
                  ) : inviteCode ? (
                    <View style={styles.pendingInviteSection}>
                      <Text style={styles.stateHeading}>
                        Waiting for your partner
                      </Text>
                      <Text style={styles.stateBody}>
                        Share this invitation code whenever it feels right.
                      </Text>

                      <View style={styles.inviteBadgeCard}>
                        <Text style={styles.inviteBadgeLabel}>
                          Partner invite code
                        </Text>
                        <Text
                          style={styles.inviteBadgeCode}
                          selectable={true}
                        >
                          {inviteCode}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.spaceReadySection}>
                      <Text style={styles.stateHeading}>
                        Your space is ready
                      </Text>
                      <Text style={styles.stateBody}>
                        Invite your partner whenever you feel ready.
                      </Text>

                      <CouplyPrimaryButton
                        label="Invite partner"
                        onPress={createPartnerInvite}
                        accessibilityLabel="Invite partner"
                      />
                    </View>
                  )}

                  {/* Moments shortcut */}
                  <CouplyQuietButton
                    label="View moments in your space"
                    onPress={() => router.push("/events")}
                    accessibilityLabel="View moments in your space"
                    variant="soft"
                  />
                </View>
              ) : (
                <View style={styles.noSpaceSection}>
                  <Text style={styles.stateHeading}>
                    Create or join a space
                  </Text>
                  <Text style={styles.stateBody}>
                    Start a space for the two of you, or join one your partner
                    has already created.
                  </Text>

                  <CouplyPrimaryButton
                    label="Create relationship space"
                    onPress={createCouple}
                    accessibilityLabel="Create relationship space"
                  />

                  <View style={styles.orDividerRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.orLine} />
                  </View>

                  <View style={styles.joinSection}>
                    <Text style={styles.fieldLabel}>Have a partner invite?</Text>
                    <TextInput
                      style={styles.input}
                      value={joinCode}
                      onChangeText={setJoinCode}
                      placeholder="Enter invite code"
                      placeholderTextColor="#9E90A3"
                      autoCapitalize="characters"
                      accessibilityLabel="Partner invite code"
                    />

                    <CouplyPrimaryButton
                      label="Join partner"
                      onPress={acceptPartnerInvite}
                      accessibilityLabel="Join partner space"
                    />
                  </View>
                </View>
              )}
            </CouplySectionCard>

            {/* ACCOUNT CARD */}
            <CouplySectionCard style={styles.cardCouply}>
              <Text style={styles.cardSectionHeading}>Account</Text>

              <CouplyQuietButton
                label="Sign out"
                onPress={signOut}
                accessibilityLabel="Sign out of Couply"
                variant="soft"
                textStyle={styles.signOutButtonText}
              />
            </CouplySectionCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------
// STYLES
// ---------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FBF7FC",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  headerCouply: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
  },
  homeLinkBtnCouply: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cardCouply: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  editBtnCouply: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  /* Loading State */
  loadingScreen: {
    flex: 1,
    backgroundColor: "#FBF7FC",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: "#6D6072",
  },

  /* In-Page Header */
  header: {
    marginBottom: 4,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  homeLinkButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F7EEF7",
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  homeLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E416D",
  },
  overline: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  supportingText: {
    fontSize: 15,
    color: "#6D6072",
    lineHeight: 22,
  },

  /* White Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
    marginBottom: 16,
  },

  /* Personal Details - View Mode */
  profileViewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F1EDF7",
    borderWidth: 1,
    borderColor: "#E3DBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6E416D",
  },
  profileInfoColumn: {
    flex: 1,
    paddingHorizontal: 14,
  },
  profileDisplayName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#3D3040",
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13.5,
    color: "#6D6072",
  },
  editButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DCE9",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Personal Details - Edit Mode */
  editForm: {
    gap: 8,
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
  helperText: {
    fontSize: 12.5,
    color: "#6D6072",
    marginBottom: 8,
  },
  editActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },

  /* Relationship Space Content */
  spaceContent: {
    gap: 14,
  },
  connectedCard: {
    backgroundColor: "#FBEFF7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEDCEB",
    padding: 16,
    gap: 4,
  },
  connectedHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#703866",
    letterSpacing: -0.1,
  },
  connectedBody: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 19,
  },

  pendingInviteSection: {
    gap: 8,
  },
  stateHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.1,
  },
  stateBody: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 19,
  },
  inviteBadgeCard: {
    backgroundColor: "#F7EEF7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 6,
  },
  inviteBadgeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D6072",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inviteBadgeCode: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 22,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 3,
  },

  spaceReadySection: {
    gap: 12,
  },

  /* No Space Section */
  noSpaceSection: {
    gap: 12,
  },
  orDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8DCE9",
  },
  orText: {
    fontSize: 13,
    color: "#9E90A3",
    fontWeight: "500",
  },
  joinSection: {
    gap: 8,
  },
  joinPartnerButton: {
    backgroundColor: "#F7EEF7",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  joinPartnerButtonText: {
    color: "#6E416D",
    fontSize: 15,
    fontWeight: "600",
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
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  /* Secondary Button */
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  secondaryButtonPressed: {
    backgroundColor: "#F7EEF7",
  },
  secondaryButtonText: {
    color: "#6E416D",
    fontSize: 15,
    fontWeight: "600",
  },

  /* Account Card - Sign Out */
  signOutButton: {
    backgroundColor: "#FFFFFF",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  signOutButtonText: {
    color: "#6D6072",
    fontSize: 14.5,
    fontWeight: "600",
  },

  /* Status Card */
  statusCard: {
    backgroundColor: "#F7EEF7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  statusErrorText: {
    color: "#B42318",
  },
});
