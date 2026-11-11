import { CouplyHeader, CouplyPage, CouplySectionCard, CouplyStatusPill } from "@/components/CouplyUI";
import { EventRepairSection } from "@/components/EventRepairSection";
import { tokens } from "@/components/couply-tokens";
import { useAccessRevalidation, type AccessResult } from "@/hooks/useAccessRevalidation";
import { loadEventRepairStates, type EventRepairState } from "@/lib/repair-states";
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
  couple_id: string;
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

type PerspectiveLoadPhase = "loading" | "ready" | "failed";
const PERSPECTIVE_LOAD_FAILURE = "We couldn't load perspectives. Reopen this moment to check again.";
type ResourceSnapshot = { event: RelationshipEvent; note: string | null; perspectives: EventPerspective[]; repairs: EventRepairState[] };

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
      <CouplyPage edges={["left", "right", "bottom"]}>
        <View style={styles.center}>
          <CouplySectionCard style={styles.centerNotice}>
            <Text accessibilityLiveRegion="polite" style={styles.helperText}>{eventId ? "Loading..." : "Invalid event."}</Text>
          </CouplySectionCard>
        </View>
      </CouplyPage>
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
  const [perspectiveLoadPhase, setPerspectiveLoadPhase] = useState<PerspectiveLoadPhase>("loading");
  const [perspectiveInput, setPerspectiveInput] = useState("");
  const [editingPerspective, setEditingPerspective] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savingPerspective = writing;
  const focused = useRef(false);
  const focusGeneration = useRef(0);
  const requestId = useRef(0);
  const [repairSnapshot, setRepairSnapshot] = useState<{ rows: EventRepairState[]; revision: number } | null>(null);
  const writeInFlight = useRef(false);
  const deletionPhase = useRef<"idle" | "pending" | "uncertain" | "deleted">("idle");
  const deleteConsent = useRef(false);
  const [deletionBlocked, setDeletionBlocked] = useState(false);
  // Bind confirmations to the load that produced the displayed event.
  const [deletionScope, setDeletionScope] = useState<{ generation: number; request: number } | null>(null);

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

  const verifyResource = useCallback(async (currentRead: () => boolean): Promise<AccessResult<ResourceSnapshot>> => {
    const valid = () => isCurrent() && currentRead();
    const token = await authorize();
    if (!token || !valid()) return { kind: "failed" };
    const bearer = `Bearer ${token}`;
    const membership = async () => {
      const result = await supabase.from("couple_members").select("couple_id")
        .eq("user_id", currentUserId).maybeSingle().setHeader("Authorization", bearer);
      if (result.error) throw new Error("Membership verification failed");
      return result.data?.couple_id as string | undefined;
    };
    const parent = () => supabase.from("relationship_events")
      .select("id, couple_id, creator_id, event_type, category, intensity, shared_topic, visibility, created_at")
      .eq("id", eventId).maybeSingle().setHeader("Authorization", bearer);
    const coupleId = await membership();
    if (!valid()) return { kind: "failed" };
    if (!coupleId) return { kind: "unavailable" };
    const initial = await parent();
    if (!valid()) return { kind: "failed" };
    if (initial.error) return { kind: "failed" };
    if (!initial.data || initial.data.couple_id !== coupleId) return { kind: "unavailable" };
    const reflection = await supabase.from("event_private_reflections").select("note")
      .eq("event_id", eventId).eq("author_id", currentUserId).maybeSingle().setHeader("Authorization", bearer);
    if (!valid()) return { kind: "failed" };
    if (reflection.error) return { kind: "failed" };
    const perspectiveResult = await supabase.from("event_perspectives")
      .select("id, author_id, perspective_text, sharing_status").eq("event_id", eventId).setHeader("Authorization", bearer);
    if (!valid()) return { kind: "failed" };
    if (perspectiveResult.error || !Array.isArray(perspectiveResult.data)) return { kind: "failed" };
    const repairs = initial.data.event_type === "friction" ? await loadEventRepairStates(eventId, token) : [];
    if (!valid()) return { kind: "failed" };
    if (!Array.isArray(repairs) || repairs.some((row) => row.event_id !== eventId) ||
      repairs.filter((row) => row.user_id === currentUserId).length > 1) return { kind: "failed" };
    const latestMembership = await membership();
    if (!valid()) return { kind: "failed" };
    if (latestMembership !== coupleId) return { kind: "unavailable" };
    const latest = await parent();
    if (!valid()) return { kind: "failed" };
    if (latest.error) return { kind: "failed" };
    if (!latest.data) return { kind: "unavailable" };
    // A parent change between child reads cannot authorize a mixed snapshot.
    if (JSON.stringify(latest.data) !== JSON.stringify(initial.data)) return { kind: "failed" };
    if (!(await authorize()) || !valid()) return { kind: "failed" };
    return { kind: "ready", data: {
      event: latest.data as RelationshipEvent, note: reflection.data?.note ?? null,
      perspectives: perspectiveResult.data as EventPerspective[], repairs,
    } };
  }, [authorize, currentUserId, eventId, isCurrent]);

  const publishResource = useCallback((snapshot: ResourceSnapshot, revision: number) => {
    if (!isCurrent()) return;
    setEvent(snapshot.event);
    setPrivateNote(snapshot.note);
    setPerspectives(snapshot.perspectives);
    setPerspectiveLoadPhase("ready");
    setRepairSnapshot({ rows: snapshot.repairs, revision });
    if (deletionPhase.current === "idle") {
      setDeletionScope({ generation: focusGeneration.current, request: requestId.current });
    }
    // Read freshness is independent of drafts, confirmations and write outcomes.
  }, [isCurrent]);
  const access = useAccessRevalidation({ verify: verifyResource, publish: publishResource });

  useFocusEffect(useCallback(() => {
    focused.current = true;
    focusGeneration.current++;
    requestId.current++;
    writeInFlight.current = false;
    deletionPhase.current = "idle";
    setDeletionBlocked(false);
    setWriting(false);
    setEvent(null);
    setPrivateNote(null);
    setPerspectives([]);
    setPerspectiveLoadPhase("loading");
    setRepairSnapshot(null);
    setPerspectiveInput("");
    setEditingPerspective(false);
    setSharedTopicInput("");
    setShowSharingControls(false);
    setConfirmWithdraw(false);
    setConfirmDelete(false);
    deleteConsent.current = false;
    setStatusMessage("");
    access.controller.start();
    return () => {
      focused.current = false;
      focusGeneration.current++;
      requestId.current++;
      access.controller.stop();
    };
  }, [access.controller]));

  async function performWrite(
    pending: string,
    action: (token: string) => Promise<string | null>,
  ) {
    if (!isCurrent() || writeInFlight.current) return;
    const finishAccess = access.controller.beginMutation();
    if (!finishAccess) return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    writeInFlight.current = true;
    setWriting(true);
    setStatusMessage(pending);
    try {
      const token = await authorize();
      if (!token || !valid() || !access.controller.hasFreshAccess()) return;
      // Pin the validated identity on each request: the global client's session
      // may change between validation and its asynchronous fetch dispatch.
      const message = await action(token);
      if (!valid() || !(await authorize()) || !valid()) return;
      if (message === null) router.back();
      else {
        // Acknowledgment is historical fact even if subsequent access fails.
        setStatusMessage(message);
        await finishAccess();
      }
    } catch {
      if (valid()) {
        setStatusMessage("We couldn't confirm this update. Reopen the moment to check its current state before trying again.");
      }
    } finally {
      void finishAccess(false);
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
      setShowSharingControls(false);
      setSharedTopicInput("");
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
      setPerspectiveInput("");
      setEditingPerspective(false);
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
      setConfirmWithdraw(false);
      return data === true
        ? "Your perspective was withdrawn."
        : "No perspective was available to withdraw.";
    });
  }

  async function deleteEvent() {
    const valid = () => isCurrent() && deletionScope !== null &&
      deletionScope.generation === focusGeneration.current && deletionScope.request === requestId.current;
    if (!valid() || !event || event.creator_id !== currentUserId || !confirmDelete || !deleteConsent.current ||
        writeInFlight.current || deletionPhase.current !== "idle") return;
    const finishAccess = access.controller.beginMutation();
    if (!finishAccess) return;
    deleteConsent.current = false;
    deletionPhase.current = "pending";
    writeInFlight.current = true;
    setWriting(true);
    setStatusMessage("Deleting moment...");
    let dispatched = false;
    try {
      const token = await authorize();
      if (!token || !valid()) return;
      if (!access.controller.hasFreshAccess()) {
        deletionPhase.current = "uncertain";
        setDeletionBlocked(true);
        setConfirmDelete(false);
        setStatusMessage("Deletion was not sent because access needs checking. Reopen the moment before trying again.");
        return;
      }
      dispatched = true;
      const { data, error } = await supabase.rpc("delete_relationship_event", {
        p_event_id: eventId,
      }).setHeader("Authorization", `Bearer ${token}`);
      if (!valid()) return;
      if (!error && data === true) {
        deletionPhase.current = "deleted";
        // Navigation requires both the literal deletion acknowledgment and a
        // still-current verified identity. An absent row is not an acknowledgment.
        if (await authorize() && valid()) router.back();
        return;
      }
      if (!(await authorize()) || !valid()) return;
      deletionPhase.current = "uncertain";
      setDeletionBlocked(true);
      setConfirmDelete(false);
      const rejected = error?.code === "P0001" &&
        (error.message === "Event unavailable" || error.message === "Authentication required");
      setStatusMessage(rejected
        ? "This deletion request was rejected. Reopen the moment to check its current availability."
        : "We couldn't confirm whether this moment was deleted. Reopen it to check its current availability. No deletion was retried.");
    } catch {
      if (!valid()) return;
      if (!dispatched || deletionPhase.current === "deleted") {
        // Failed verification must clear the old account view; do not turn an
        // acknowledged deletion into a false failure or navigate without identity.
        invalidateAccount();
        return;
      }
      try {
        if (!(await authorize()) || !valid()) return;
      } catch {
        if (valid()) invalidateAccount();
        return;
      }
      deletionPhase.current = "uncertain";
      setDeletionBlocked(true);
      setConfirmDelete(false);
      setStatusMessage("We couldn't confirm whether this moment was deleted. Reopen it to check its current availability. No deletion was retried.");
    } finally {
      void finishAccess(false);
      if (valid()) {
        writeInFlight.current = false;
        setWriting(false);
      }
    }
  }

  const visible = access.state.phase === "ready" && access.controller.hasFreshAccess();
  const accessNotice = access.state.phase === "checking"
    ? "Checking access to this moment…"
    : access.state.phase === "unavailable"
      ? "This moment is unavailable."
      : "We couldn't verify access to this moment. Try again when you're connected.";
  const verificationNotice = (
    <CouplySectionCard style={styles.centerNotice}>
      <Text accessibilityRole="alert" style={styles.helperText}>{accessNotice}</Text>
      {access.state.phase !== "checking" && (
        <Pressable accessibilityRole="button" accessibilityLabel="Check moment access again"
          onPress={() => void access.controller.refresh(true)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Try again</Text>
        </Pressable>
      )}
    </CouplySectionCard>
  );
  if (!event) {
    return <CouplyPage edges={["left", "right", "bottom"]}><View style={styles.center}>{verificationNotice}</View></CouplyPage>;
  }

  const isCreator = event.creator_id === currentUserId;
  const myPerspective = perspectives.find((p) => p.author_id === currentUserId);
  const partnerPerspective = perspectives.find(
    (p) => p.author_id !== currentUserId && p.sharing_status === "submitted",
  );

  return (
    <CouplyPage edges={["left", "right", "bottom"]}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!visible && verificationNotice}
      {visible && <>
      {/* Moment summary */}
      <CouplySectionCard style={[styles.summaryCard, event.event_type === "positive" && styles.positiveSummary]}>
        <View style={styles.summaryTop}>
          <Text style={styles.eyebrow}>
            {event.event_type === "friction"
              ? "SOMETHING FELT OFF"
              : "A GOOD MOMENT"}
          </Text>

          <CouplyStatusPill
            label={event.visibility === "ours" ? "Ours · Shared" : "Mine · Private"}
            style={event.visibility === "ours" ? styles.visibilityBadgeOurs : styles.visibilityBadgeMine}
          />
        </View>

        <CouplyHeader title={formatCategory(event.category)} style={styles.summaryHeading} />

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
      </CouplySectionCard>

      {/* Shared topic */}
      {event.visibility === "ours" && event.shared_topic && (
        <CouplySectionCard variant="blush" style={styles.contentCard}>
          <Text accessibilityRole="header" style={styles.contentTitle}>Shared topic</Text>

          <Text style={styles.contentBody}>{event.shared_topic}</Text>

          <Text style={styles.contentHint}>
            This topic is intentionally shared with your partner.
          </Text>
        </CouplySectionCard>
      )}

      {/* Private reflection */}
      {privateNote && (
        <CouplySectionCard variant="lilac" style={styles.contentCard}>
          <Text accessibilityRole="header" style={styles.contentTitle}>My private reflection</Text>

          <Text style={styles.contentBody}>{privateNote}</Text>

          <Text style={styles.contentHint}>
            Private — only you can see this reflection.
          </Text>
        </CouplySectionCard>
      )}

      </>}
      {event.event_type === "friction" && currentUserId && (
        <EventRepairSection
          key={`${event.id}:${currentUserId}`}
          eventId={event.id}
          userId={currentUserId}
          visibility={event.visibility}
          authorize={authorize}
          isCurrent={isCurrent}
          resource={{
            visible, rows: repairSnapshot?.rows ?? [], revision: repairSnapshot?.revision ?? 0,
            canDispatch: access.controller.canDispatch, canSend: access.controller.hasFreshAccess,
            beginMutation: access.controller.beginMutation, refresh: access.controller.refresh,
          }}
        />
      )}

      {visible && <>
      {/* Our Perspectives */}
      {event.visibility === "ours" && (
        <CouplySectionCard style={styles.sectionCard}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Our perspectives</Text>

          <Text style={styles.helperText}>
            Each perspective belongs to its author. Sharing a perspective does
            not mean agreement or repair.
          </Text>

          {perspectiveLoadPhase === "loading" ? (
            <Text style={styles.helperText}>Loading perspectives...</Text>
          ) : perspectiveLoadPhase === "failed" ? (
            <Text accessibilityRole="alert" style={styles.helperText}>{PERSPECTIVE_LOAD_FAILURE}</Text>
          ) : (
            <>
              {/* Own perspective */}
              <CouplySectionCard variant="muted" style={styles.perspectiveCard}>
                <Text accessibilityRole="header" style={styles.perspectiveHeading}>Your perspective</Text>

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
                    You haven&apos;t shared your perspective yet.
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
                    accessibilityState={{ disabled: savingPerspective }}
                    accessibilityLabel={myPerspective?.sharing_status === "submitted" ? "Edit my perspective" : "Write and share my perspective"}
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
                      accessibilityLabel="Your perspective"
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
                      accessibilityLabel="Share my perspective"
                      accessibilityState={{ disabled: savingPerspective || !perspectiveInput.trim() }}
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
                      accessibilityLabel="Cancel perspective editing"
                      accessibilityState={{ disabled: savingPerspective }}
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
                    accessibilityLabel="Withdraw my perspective"
                    accessibilityState={{ disabled: savingPerspective }}
                    onPress={() => setConfirmWithdraw(true)}
                  >
                    <Text style={styles.dangerButtonText}>
                      Withdraw my perspective
                    </Text>
                  </Pressable>
                )}

                {myPerspective && confirmWithdraw && (
                  <CouplySectionCard variant="muted" style={styles.confirmCard}>
                    <Text style={styles.helperText}>
                      Withdrawing permanently deletes your perspective. This
                      cannot be undone.
                    </Text>

                    <Pressable
                      style={styles.dangerButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      accessibilityLabel="Yes, withdraw"
                      accessibilityState={{ disabled: savingPerspective }}
                      onPress={withdrawPerspective}
                    >
                      <Text style={styles.dangerButtonText}>Yes, withdraw</Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      accessibilityLabel="Keep my perspective"
                      accessibilityState={{ disabled: savingPerspective }}
                      onPress={() => setConfirmWithdraw(false)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Keep my perspective
                      </Text>
                    </Pressable>
                  </CouplySectionCard>
                )}
              </CouplySectionCard>

              {/* Partner perspective */}
              <CouplySectionCard variant="blush" style={styles.perspectiveCard}>
                <Text accessibilityRole="header" style={styles.perspectiveHeading}>
                  Your partner&apos;s perspective
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
                    No partner perspective is currently shared with you.
                  </Text>
                )}
              </CouplySectionCard>
            </>
          )}
        </CouplySectionCard>
      )}

      {/* Moment visibility — creator only */}
      {isCreator && (
        <CouplySectionCard style={styles.sectionCard}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Moment visibility</Text>

          <Text style={styles.helperText}>
            This moment is currently{" "}
            {event.visibility === "mine" ? "Mine" : "Ours"}. Your private
            reflection and personal repair update are not automatically shared.
          </Text>

          {!showSharingControls ? (
            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel={event.visibility === "mine" ? "Share this moment" : "Change moment visibility"}
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
                    accessibilityLabel="Topic to share"
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
                    accessibilityLabel="Confirm sharing"
                    accessibilityState={{ disabled: changingVisibility || !sharedTopicInput.trim() }}
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
                    Moving this moment to Mine removes your partner&apos;s access.
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
                    accessibilityLabel="Confirm move to Mine"
                    accessibilityState={{ disabled: changingVisibility }}
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
                accessibilityLabel="Cancel visibility change"
                accessibilityState={{ disabled: changingVisibility }}
                onPress={() => {
                  setSharedTopicInput("");
                  setShowSharingControls(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </CouplySectionCard>
      )}

      {/* Delete moment — creator only */}
      {isCreator && (
        <View style={styles.deleteSection}>
          {!confirmDelete ? (
            <Pressable
              style={styles.dangerButton}
              accessibilityRole="button"
              disabled={writing || deletionBlocked}
              accessibilityLabel="Delete moment"
              accessibilityState={{ disabled: writing || deletionBlocked }}
              onPress={() => {
                deleteConsent.current = true;
                setConfirmDelete(true);
              }}
            >
              <Text style={styles.dangerButtonText}>Delete moment</Text>
            </Pressable>
          ) : (
            <CouplySectionCard variant="muted" style={styles.confirmCard}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Delete this moment?</Text>

              <Text style={styles.helperText}>
                This permanently deletes the moment and its associated
                reflections, perspectives and repair updates, including
                contributions from your partner. This cannot be undone.
              </Text>

              <Pressable
                style={styles.dangerButton}
                accessibilityRole="button"
                disabled={writing}
                accessibilityLabel="Yes, delete permanently"
                accessibilityState={{ disabled: writing }}
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
                accessibilityLabel="Cancel deletion"
                accessibilityState={{ disabled: writing }}
                onPress={() => {
                  deleteConsent.current = false;
                  setConfirmDelete(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </CouplySectionCard>
          )}
        </View>
      )}

      {event.visibility === "mine" && perspectiveLoadPhase === "failed" && (
        <CouplySectionCard variant="muted" style={styles.statusPanel}>
          <Text accessibilityRole="alert" style={styles.status}>{PERSPECTIVE_LOAD_FAILURE}</Text>
        </CouplySectionCard>
      )}

      </>}
      {visible && statusMessage !== "" && (
        <CouplySectionCard variant="muted" style={styles.statusPanel}>
          <Text accessibilityLiveRegion="polite" style={styles.status}>{statusMessage}</Text>
        </CouplySectionCard>
      )}
    </ScrollView>
    </CouplyPage>
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
  scroll: { flex: 1 },
  container: { flexGrow: 1, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.xxl },
  center: { flex: 1, justifyContent: "center", paddingVertical: tokens.spacing.xxl },
  centerNotice: { width: "100%" },
  summaryCard: { gap: tokens.spacing.md },
  positiveSummary: { borderColor: tokens.colors.celebrationBorder },
  summaryTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacing.sm },
  summaryHeading: { paddingTop: 0, paddingBottom: 0 },
  eyebrow: { color: tokens.colors.plum, fontSize: tokens.typeScale.overline, fontWeight: "700", letterSpacing: 1, flexShrink: 1 },
  visibilityBadgeMine: { backgroundColor: tokens.colors.surfaceLilac },
  visibilityBadgeOurs: { backgroundColor: tokens.colors.surfaceBlush },
  meta: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.caption, lineHeight: 20 },
  intensityText: { color: tokens.colors.plum, fontSize: tokens.typeScale.body, lineHeight: 20, backgroundColor: tokens.colors.surfaceLilac, padding: tokens.spacing.sm, borderRadius: tokens.radii.small, alignSelf: "flex-start", maxWidth: "100%" },
  contentCard: { marginTop: tokens.spacing.lg },
  contentTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", marginBottom: tokens.spacing.sm },
  contentBody: { color: tokens.colors.text, fontSize: tokens.typeScale.bodyLarge, lineHeight: 23 },
  contentHint: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.body, lineHeight: 20, marginTop: tokens.spacing.md },
  sectionCard: { marginTop: tokens.spacing.xl },
  sectionTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", marginBottom: tokens.spacing.sm },
  helperText: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.body, lineHeight: 20, marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  perspectiveCard: { marginTop: tokens.spacing.lg },
  perspectiveHeading: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700" },
  perspectiveStatus: { color: tokens.colors.plum, fontSize: tokens.typeScale.caption, lineHeight: 20, marginTop: tokens.spacing.xs, marginBottom: tokens.spacing.sm },
  perspectiveText: { color: tokens.colors.text, fontSize: tokens.typeScale.bodyLarge, lineHeight: 22 },
  sharingInput: { minHeight: 96, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, borderRadius: tokens.radii.small, padding: tokens.spacing.md, textAlignVertical: "top", marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.sm, fontSize: tokens.typeScale.bodyLarge, color: tokens.colors.text },
  primaryButton: { minHeight: tokens.layout.minTouchTarget, backgroundColor: tokens.colors.plum, borderRadius: tokens.radii.small, padding: tokens.spacing.md, alignItems: "center", justifyContent: "center", marginTop: tokens.spacing.sm },
  primaryButtonText: { color: tokens.colors.surface, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", textAlign: "center" },
  secondaryButton: { minHeight: tokens.layout.minTouchTarget, borderRadius: tokens.radii.small, borderWidth: 1, borderColor: tokens.colors.plum, padding: tokens.spacing.md, marginTop: tokens.spacing.sm, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: tokens.colors.plum, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", textAlign: "center" },
  dangerButton: { minHeight: tokens.layout.minTouchTarget, borderRadius: tokens.radii.small, borderWidth: 1, borderColor: tokens.colors.dangerText, padding: tokens.spacing.md, marginTop: tokens.spacing.sm, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { color: tokens.colors.dangerText, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  deleteSection: { marginTop: tokens.spacing.xxl, paddingTop: tokens.spacing.lg, borderTopWidth: 1, borderTopColor: tokens.colors.borderSoft },
  confirmCard: { marginTop: tokens.spacing.md },
  statusPanel: { marginTop: tokens.spacing.xl },
  status: { color: tokens.colors.plum, fontSize: tokens.typeScale.body, lineHeight: 20, textAlign: "center" },
});
