import { EventRepairSection } from "@/components/EventRepairSection";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type RelationshipEvent = {
  id: string;
  creator_id: string;
  event_type: "positive" | "friction";
  category: string;
  intensity: number | null;
  shared_topic: string | null;
  visibility: "mine" | "ours";
  created_at: string;
};

type EventPerspective = {
  id: string;
  author_id: string;
  perspective_text: string;
  sharing_status: "submitted" | "suspended";
};

type AccountBoundary = { userId: string | null; generation: number };

export default function EventDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;

  const account = useRef<AccountBoundary | null>(null);
  const accountGeneration = useRef(0);
  const [boundary, setBoundary] = useState<AccountBoundary | null>(null);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const userId = session?.user.id ?? null;
      if (account.current?.userId === userId && event !== "SIGNED_OUT") return;

      // Invalidate synchronously, before React replaces the old account's UI.
      // A sign-out/sign-in with the SAME account must also start fresh.
      const next = { userId, generation: ++accountGeneration.current };
      account.current = next;
      setBoundary(next);
      // Keep the auth callback synchronous; do not call Supabase APIs here.
      if (!userId) router.replace("/");
    });
    return () => {
      active = false;
      account.current = null;
      data.subscription.unsubscribe();
    };
  }, [router]);

  const isCurrentAccount = useCallback(
    () => boundary !== null && account.current === boundary,
    [boundary],
  );
  const invalidateAccount = useCallback(() => {
    if (!isCurrentAccount()) return;
    account.current = null;
    setBoundary(null);
    router.replace("/");
  }, [isCurrentAccount, router]);

  if (!boundary?.userId || !eventId) {
    return (
      <View style={styles.center}>
        <Text>{eventId ? "Loading..." : "Invalid event."}</Text>
      </View>
    );
  }

  return (
    <EventDetailContent
      key={`${boundary.generation}:${boundary.userId}:${eventId}`}
      eventId={eventId}
      currentUserId={boundary.userId}
      isCurrentAccount={isCurrentAccount}
      invalidateAccount={invalidateAccount}
    />
  );
}

function EventDetailContent({
  eventId, currentUserId, isCurrentAccount, invalidateAccount,
}: {
  eventId: string;
  currentUserId: string;
  isCurrentAccount: () => boolean;
  invalidateAccount: () => void;
}) {
  const router = useRouter();

  const [event, setEvent] = useState<RelationshipEvent | null>(null);

  const [statusMessage, setStatusMessage] = useState("Loading...");

  const [privateNote, setPrivateNote] = useState<string | null>(null);

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [writing, setWriting] = useState(false);
  const changingVisibility = writing;
  const [perspectives, setPerspectives] = useState<EventPerspective[]>([]);
  const [perspectivesLoading, setPerspectivesLoading] = useState(true);
  const [perspectiveInput, setPerspectiveInput] = useState("");
  const [editingPerspective, setEditingPerspective] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savingPerspective = writing;
  const focused = useRef(false);
  const focusGeneration = useRef(0);
  const requestId = useRef(0);
  const writeInFlight = useRef(false);

  // Unmount must invalidate before passive effect cleanup (and before a late
  // promise can dispatch another write for a route that has been replaced).
  useLayoutEffect(() => () => {
    focused.current = false;
    focusGeneration.current++;
    requestId.current++;
  }, []);

  const isCurrent = useCallback(
    () => focused.current && isCurrentAccount(),
    [isCurrentAccount],
  );

  const authorize = useCallback(async () => {
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    if (!valid()) return null;
    const { data, error } = await supabase.auth.getSession();
    if (!valid()) return null;
    const session = data.session;
    if (error || session?.user.id !== currentUserId) {
      invalidateAccount();
      return null;
    }
    const { data: auth, error: authError } = await supabase.auth.getUser(
      session.access_token,
    );
    if (!valid()) return null;
    if (authError || auth.user?.id !== currentUserId) {
      invalidateAccount();
      return null;
    }
    return session.access_token;
  }, [currentUserId, invalidateAccount, isCurrent]);

  const loadEvent = useCallback(async () => {
    const id = ++requestId.current;
    const valid = () => isCurrent() && id === requestId.current;
    if (!valid()) return false;
    // Clear the entire view before revalidation, including unsaved text and
    // confirmations. No previous load is allowed to repopulate this boundary.
    setEvent(null);
    setPrivateNote(null);
    setPerspectives([]);
    setPerspectivesLoading(true);
    setPerspectiveInput("");
    setEditingPerspective(false);
    setSharedTopicInput("");
    setShowSharingControls(false);
    setConfirmWithdraw(false);
    setConfirmDelete(false);
    setStatusMessage("Loading...");
    try {
      const token = await authorize();
      if (!token || !valid()) return false;
      const { data, error } = await supabase
        .from("relationship_events")
        .select(
          `
          id,
          creator_id,
          event_type,
          category,
          intensity,
          shared_topic,
          visibility,
          created_at
        `,
        )
        .eq("id", eventId)
        .maybeSingle()
        .setHeader("Authorization", `Bearer ${token}`);
      if (!valid()) return false;

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setStatusMessage(
          "Event not found or you do not have permission to view it.",
        );
        return false;
      }

      const { data: reflection, error: reflectionError } = await supabase
        .from("event_private_reflections")
        .select("note")
        .eq("event_id", eventId)
        .eq("author_id", currentUserId)
        .maybeSingle()
        .setHeader("Authorization", `Bearer ${token}`);
      if (!valid()) return false;

      if (reflectionError) {
        throw new Error(reflectionError.message);
      }

      // RLS exposes only the author's own perspective and submitted partner
      // perspectives. A suspended record is not visible to the partner.
      const { data: perspectiveRows, error: perspectiveError } = await supabase
        .from("event_perspectives")
        .select("id, author_id, perspective_text, sharing_status")
        .eq("event_id", eventId)
        .setHeader("Authorization", `Bearer ${token}`);
      if (!valid() || !(await authorize()) || !valid()) return false;

      // Publish only after ALL reads and the final identity check complete.
      setEvent(data);
      setPrivateNote(reflection?.note ?? null);

      if (perspectiveError) {
        setPerspectives([]);
        setStatusMessage(
          `Could not load perspectives: ${perspectiveError.message}`,
        );
      } else {
        setPerspectives((perspectiveRows ?? []) as EventPerspective[]);
        setStatusMessage("");
      }
      setPerspectivesLoading(false);
      return true;
    } catch (error) {
      if (valid()) {
        setStatusMessage(error instanceof Error ? error.message : "Could not load moment.");
      }
      return false;
    }
  }, [authorize, currentUserId, eventId, isCurrent]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    focusGeneration.current++;
    writeInFlight.current = false;
    setWriting(false);
    void loadEvent();
    return () => {
      focused.current = false;
      focusGeneration.current++;
      requestId.current++;
    };
  }, [loadEvent]));

  async function performWrite(
    pending: string,
    action: (token: string) => Promise<string | null>,
  ) {
    if (!isCurrent() || writeInFlight.current) return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    writeInFlight.current = true;
    setWriting(true);
    setStatusMessage(pending);
    try {
      const token = await authorize();
      if (!token || !valid()) return;
      // Pin the validated identity on each request: the global client's session
      // may change between validation and its asynchronous fetch dispatch.
      const message = await action(token);
      if (!valid() || !(await authorize()) || !valid()) return;
      if (message === null) router.back();
      else if (await loadEvent() && valid()) setStatusMessage(message);
    } catch (error) {
      if (valid()) {
        setStatusMessage(error instanceof Error ? error.message : "Could not update moment.");
      }
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setWriting(false);
      }
    }
  }

  async function changeMomentVisibility(newVisibility: "mine" | "ours") {
    if (!event || event.creator_id !== currentUserId) return;
    const topic = newVisibility === "ours" ? sharedTopicInput.trim() : null;
    if (newVisibility === "ours" && !topic) {
      setStatusMessage("Please enter a topic to share.");
      return;
    }
    await performWrite("Updating sharing...", async (token) => {
      const { error } = await supabase.rpc("set_moment_visibility", {
        p_event_id: eventId,
        p_visibility: newVisibility,
        p_shared_topic: topic,
      }).setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
      return newVisibility === "ours"
        ? "Moment shared with your partner."
        : "Moment moved to Mine. Shared topic cleared.";
    });
  }

  async function submitPerspective() {
    if (!event || event.visibility !== "ours") return;
    const text = perspectiveInput.trim();
    if (!text) {
      setStatusMessage("Write a perspective before sharing.");
      return;
    }
    await performWrite("Saving perspective...", async (token) => {
      const { error } = await supabase.rpc("submit_event_perspective", {
        p_event_id: eventId,
        p_perspective_text: text,
      }).setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
      return "Your perspective was shared.";
    });
  }

  async function withdrawPerspective() {
    if (!event || !confirmWithdraw) return;
    await performWrite("Withdrawing perspective...", async (token) => {
      const { data, error } = await supabase.rpc("withdraw_event_perspective", {
        p_event_id: eventId,
      }).setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
      return data === true
        ? "Your perspective was withdrawn."
        : "No perspective was available to withdraw.";
    });
  }

  async function deleteEvent() {
    if (!event || event.creator_id !== currentUserId || !confirmDelete) return;
    await performWrite("Deleting moment...", async (token) => {
      const { error } = await supabase.from("relationship_events")
        .delete().eq("id", eventId)
        .setHeader("Authorization", `Bearer ${token}`);
      if (error) throw new Error(error.message);
      return null;
    });
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text>{statusMessage}</Text>
      </View>
    );
  }

  const isCreator = event.creator_id === currentUserId;
  const myPerspective = perspectives.find((p) => p.author_id === currentUserId);
  const partnerPerspective = perspectives.find(
    (p) => p.author_id !== currentUserId && p.sharing_status === "submitted",
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Moment summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.eyebrow}>
            {event.event_type === "friction"
              ? "SOMETHING FELT OFF"
              : "A GOOD MOMENT"}
          </Text>

          <View
            style={[
              styles.visibilityBadge,
              event.visibility === "ours"
                ? styles.visibilityBadgeOurs
                : styles.visibilityBadgeMine,
            ]}
          >
            <Text style={styles.visibilityBadgeText}>
              {event.visibility === "ours" ? "Ours · Shared" : "Mine · Private"}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{formatCategory(event.category)}</Text>

        <Text style={styles.meta}>
          Recorded {formatDate(event.created_at)}
          {" · "}
          {isCreator ? "by you" : "by your partner"}
        </Text>

        {event.event_type === "friction" && event.intensity !== null && (
          <Text style={styles.intensityText}>
            {isCreator
              ? "Your reported intensity"
              : "Recorder's reported intensity"}
            : {event.intensity} / 5
          </Text>
        )}
      </View>

      {/* Shared topic */}
      {event.visibility === "ours" && event.shared_topic && (
        <View style={[styles.contentCard, styles.sharedCard]}>
          <Text style={styles.contentTitle}>Shared topic</Text>

          <Text style={styles.contentBody}>{event.shared_topic}</Text>

          <Text style={styles.contentHint}>
            This topic is intentionally shared with your partner.
          </Text>
        </View>
      )}

      {/* Private reflection */}
      {privateNote && (
        <View style={[styles.contentCard, styles.privateCard]}>
          <Text style={styles.contentTitle}>My private reflection</Text>

          <Text style={styles.contentBody}>{privateNote}</Text>

          <Text style={styles.contentHint}>
            Private — only you can see this reflection.
          </Text>
        </View>
      )}

      {event.event_type === "friction" && currentUserId && (
        <EventRepairSection
          key={`${event.id}:${currentUserId}`}
          eventId={event.id}
          userId={currentUserId}
          visibility={event.visibility}
          authorize={authorize}
          isCurrent={isCurrent}
        />
      )}

      {/* Our Perspectives */}
      {event.visibility === "ours" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Our perspectives</Text>

          <Text style={styles.helperText}>
            Each perspective belongs to its author. Sharing a perspective does
            not mean agreement or repair.
          </Text>

          {perspectivesLoading ? (
            <Text style={styles.helperText}>Loading perspectives...</Text>
          ) : (
            <>
              {/* Own perspective */}
              <View style={styles.perspectiveCard}>
                <Text style={styles.perspectiveHeading}>Your perspective</Text>

                {myPerspective ? (
                  <>
                    <Text style={styles.perspectiveStatus}>
                      {myPerspective.sharing_status === "submitted"
                        ? "Shared with your partner"
                        : "Not shared — only you can see this"}
                    </Text>

                    <Text style={styles.perspectiveText}>
                      {myPerspective.perspective_text}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>
                    You haven't shared your perspective yet.
                  </Text>
                )}

                {!editingPerspective ? (
                  <Pressable
                    style={[
                      styles.secondaryButton,
                      savingPerspective && styles.disabled,
                    ]}
                    disabled={savingPerspective}
                    accessibilityRole="button"
                    onPress={() => {
                      setPerspectiveInput(
                        myPerspective?.sharing_status === "submitted"
                          ? myPerspective.perspective_text
                          : "",
                      );
                      setEditingPerspective(true);
                      setConfirmWithdraw(false);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {myPerspective?.sharing_status === "submitted"
                        ? "Edit my perspective"
                        : "Write and share my perspective"}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Text style={styles.helperText}>
                      Only the text you submit will be shared.
                    </Text>

                    <TextInput
                      style={styles.sharingInput}
                      value={perspectiveInput}
                      onChangeText={setPerspectiveInput}
                      placeholder="Describe your experience"
                      multiline
                      editable={!savingPerspective}
                    />

                    <Pressable
                      style={[
                        styles.primaryButton,
                        (savingPerspective || !perspectiveInput.trim()) &&
                          styles.disabled,
                      ]}
                      disabled={savingPerspective || !perspectiveInput.trim()}
                      accessibilityRole="button"
                      onPress={submitPerspective}
                    >
                      <Text style={styles.primaryButtonText}>
                        {savingPerspective
                          ? "Sharing..."
                          : "Share my perspective"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={() => {
                        setPerspectiveInput("");
                        setEditingPerspective(false);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </>
                )}

                {myPerspective && !confirmWithdraw && (
                  <Pressable
                    style={styles.dangerButton}
                    disabled={savingPerspective}
                    accessibilityRole="button"
                    onPress={() => setConfirmWithdraw(true)}
                  >
                    <Text style={styles.dangerButtonText}>
                      Withdraw my perspective
                    </Text>
                  </Pressable>
                )}

                {myPerspective && confirmWithdraw && (
                  <View style={styles.confirmCard}>
                    <Text style={styles.helperText}>
                      Withdrawing permanently deletes your perspective. This
                      cannot be undone.
                    </Text>

                    <Pressable
                      style={styles.dangerButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={withdrawPerspective}
                    >
                      <Text style={styles.dangerButtonText}>Yes, withdraw</Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={() => setConfirmWithdraw(false)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Keep my perspective
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Partner perspective */}
              <View
                style={[styles.perspectiveCard, styles.partnerPerspectiveCard]}
              >
                <Text style={styles.perspectiveHeading}>
                  Your partner's perspective
                </Text>

                {partnerPerspective ? (
                  <>
                    <Text style={styles.perspectiveStatus}>
                      Shared by your partner
                    </Text>

                    <Text style={styles.perspectiveText}>
                      {partnerPerspective.perspective_text}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>
                    Your partner hasn't shared a perspective.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {/* Moment visibility — creator only */}
      {isCreator && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Moment visibility</Text>

          <Text style={styles.helperText}>
            This moment is currently{" "}
            {event.visibility === "mine" ? "Mine" : "Ours"}. Your private
            reflection and personal repair update are not automatically shared.
          </Text>

          {!showSharingControls ? (
            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              onPress={() => {
                setSharedTopicInput("");
                setShowSharingControls(true);
                setStatusMessage("");
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {event.visibility === "mine"
                  ? "Share this moment"
                  : "Change moment visibility"}
              </Text>
            </Pressable>
          ) : (
            <>
              {event.visibility === "mine" ? (
                <>
                  <Text style={styles.helperText}>
                    What would you like to share? Only the topic you enter below
                    will be shared automatically.
                  </Text>

                  <TextInput
                    style={styles.sharingInput}
                    value={sharedTopicInput}
                    onChangeText={setSharedTopicInput}
                    placeholder="Enter a topic to share"
                    multiline
                    editable={!changingVisibility}
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (changingVisibility || !sharedTopicInput.trim()) &&
                        styles.disabled,
                    ]}
                    disabled={changingVisibility || !sharedTopicInput.trim()}
                    accessibilityRole="button"
                    onPress={() => changeMomentVisibility("ours")}
                  >
                    <Text style={styles.primaryButtonText}>
                      Confirm sharing
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Moving this moment to Mine removes your partner's access.
                    Shared perspectives and repair updates become private.
                    Information previously seen cannot be recalled.
                  </Text>

                  <Pressable
                    style={[
                      styles.dangerButton,
                      changingVisibility && styles.disabled,
                    ]}
                    disabled={changingVisibility}
                    accessibilityRole="button"
                    onPress={() => changeMomentVisibility("mine")}
                  >
                    <Text style={styles.dangerButtonText}>
                      Confirm move to Mine
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                style={styles.secondaryButton}
                disabled={changingVisibility}
                accessibilityRole="button"
                onPress={() => {
                  setSharedTopicInput("");
                  setShowSharingControls(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Delete moment — creator only */}
      {isCreator && (
        <View style={styles.deleteSection}>
          {!confirmDelete ? (
            <Pressable
              style={styles.dangerButton}
              accessibilityRole="button"
              disabled={writing}
              onPress={() => setConfirmDelete(true)}
            >
              <Text style={styles.dangerButtonText}>Delete moment</Text>
            </Pressable>
          ) : (
            <View style={styles.confirmCard}>
              <Text style={styles.sectionTitle}>Delete this moment?</Text>

              <Text style={styles.helperText}>
                This permanently deletes the moment and its associated
                reflections, perspectives and repair updates, including
                contributions from your partner. This cannot be undone.
              </Text>

              <Pressable
                style={styles.dangerButton}
                accessibilityRole="button"
                disabled={writing}
                onPress={deleteEvent}
              >
                <Text style={styles.dangerButtonText}>
                  Yes, delete permanently
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                accessibilityRole="button"
                disabled={writing}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {statusMessage !== "" && (
        <Text style={styles.status}>{statusMessage}</Text>
      )}
    </ScrollView>
  );
}

function formatCategory(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    backgroundColor: "#FBF7FC",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 20,
  },

  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  eyebrow: {
    color: "#6E416D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    flexShrink: 1,
  },

  title: {
    fontSize: 27,
    fontWeight: "700",
    color: "#3D3040",
  },

  meta: {
    color: "#6D6072",
    fontSize: 13,
    marginTop: 8,
  },

  intensityText: {
    color: "#6E416D",
    fontSize: 13,
    marginTop: 14,
  },

  visibilityBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  visibilityBadgeMine: {
    backgroundColor: "#F1EDF7",
  },

  visibilityBadgeOurs: {
    backgroundColor: "#FBEFF7",
  },

  visibilityBadgeText: {
    color: "#6E416D",
    fontSize: 11,
    fontWeight: "700",
  },

  contentCard: {
    padding: 18,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
  },

  privateCard: {
    backgroundColor: "#F3F0F8",
    borderColor: "#E0D8EB",
  },

  sharedCard: {
    backgroundColor: "#FFF7FA",
    borderColor: "#F0DCE9",
  },

  contentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 10,
  },

  contentBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#3D3040",
  },

  contentHint: {
    fontSize: 12,
    color: "#6D6072",
    marginTop: 12,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 18,
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 8,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6D6072",
    marginTop: 6,
    marginBottom: 12,
  },

  perspectiveCard: {
    backgroundColor: "#F8F5FA",
    borderRadius: 13,
    padding: 15,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },

  partnerPerspectiveCard: {
    backgroundColor: "#FCF8FB",
  },

  perspectiveHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },

  perspectiveStatus: {
    fontSize: 12,
    color: "#6E416D",
    marginTop: 6,
    marginBottom: 10,
  },

  perspectiveText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#3D3040",
  },

  sharingInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#D8C8DC",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    textAlignVertical: "top",
    marginTop: 8,
    marginBottom: 10,
    fontSize: 14,
    color: "#3D3040",
  },

  primaryButton: {
    backgroundColor: "#6E416D",
    borderRadius: 11,
    padding: 13,
    alignItems: "center",
    marginTop: 10,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  secondaryButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#6E416D",
    padding: 12,
    marginTop: 10,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#6E416D",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  dangerButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#A33C43",
    padding: 12,
    marginTop: 10,
    alignItems: "center",
  },

  dangerButtonText: {
    color: "#A33C43",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  disabled: {
    opacity: 0.5,
  },

  deleteSection: {
    marginTop: 34,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#E8DCE9",
  },

  confirmCard: {
    backgroundColor: "#FFF7F7",
    padding: 14,
    marginTop: 12,
    borderRadius: 12,
  },

  status: {
    marginTop: 20,
    fontSize: 13,
    textAlign: "center",
    color: "#6E416D",
  },
});
