import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  eventId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

    // Authenticate user with caller's JWT
    const clientUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await clientUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized caller" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { eventId }: NotificationRequest = await req.json();
    if (!eventId || typeof eventId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid or missing eventId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Privileged service client for verification, tokens, and delivery reservations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch event and verify ownership & shared visibility
    const { data: event, error: eventError } = await adminClient
      .from("relationship_events")
      .select("id, couple_id, creator_id, visibility, event_type, created_at")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: only event creator can notify partner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event.visibility !== "ours") {
      return new Response(
        JSON.stringify({ error: "Forbidden: only shared moments ('ours') can notify partner" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Identify partner in couple
    const { data: members, error: membersError } = await adminClient
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", event.couple_id);

    if (membersError || !members || members.length < 2) {
      return new Response(
        JSON.stringify({ message: "No partner found in couple to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const partnerMember = members.find((m: { user_id: string }) => m.user_id !== user.id);
    if (!partnerMember) {
      return new Response(
        JSON.stringify({ message: "No partner recipient identified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientUserId = partnerMember.user_id;

    // 3. Verify recipient opted in to notifications
    const { data: pref, error: prefError } = await adminClient
      .from("user_notification_preferences")
      .select("notify_on_partner_shared_moment")
      .eq("user_id", recipientUserId)
      .maybeSingle();

    if (prefError) {
      return new Response(
        JSON.stringify({ error: `Database error checking preferences: ${prefError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pref || !pref.notify_on_partner_shared_moment) {
      return new Response(
        JSON.stringify({ message: "Recipient has not opted into shared moment notifications" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. ATOMIC RESERVATION: Reserve one delivery attempt before contacting Expo
    const { data: reservation, error: reserveError } = await adminClient.rpc(
      "reserve_shared_moment_notification_delivery",
      {
        p_event_id: event.id,
        p_recipient_id: recipientUserId,
        p_stale_timeout_seconds: 60,
      }
    );

    if (reserveError) {
      return new Response(
        JSON.stringify({ error: `Failed to reserve delivery: ${reserveError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reservation || !reservation.reserved) {
      return new Response(
        JSON.stringify({
          message: "Notification delivery skipped",
          skipped: true,
          reason: reservation?.reason || "already_reserved",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attemptCount = Number(reservation.attempt_count) || 1;

    // 5. Fetch recipient's push tokens
    const { data: tokens, error: tokensError } = await adminClient
      .from("user_device_push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", recipientUserId);

    if (tokensError || !tokens || tokens.length === 0) {
      const safeError = tokensError
        ? "Push token lookup failed"
        : "No active push tokens registered";
      const { data: completed, error: completeErr } = await adminClient.rpc(
        "complete_shared_moment_notification_delivery",
        {
          p_event_id: event.id,
          p_recipient_id: recipientUserId,
          p_attempt_count: attemptCount,
          p_status: "failed",
          p_error: safeError,
        }
      );

      if (completeErr || !completed) {
        return new Response(
          JSON.stringify({
            error: `Database error recording delivery failure: ${completeErr?.message || "stale reservation attempt"}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "No active push tokens registered for recipient" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Look up sender's display name for generic friendly notification
    const { data: senderProfile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const senderName = senderProfile?.display_name?.trim();
    // Strictly generic visible text: title = "Purple Garden", body = "[Partner name] shared a moment with you."
    const title = "Purple Garden";
    const body = senderName
      ? `${senderName} shared a moment with you.`
      : "Your partner shared a moment with you.";

    const messages = tokens.map((t: { expo_push_token: string }) => ({
      to: t.expo_push_token,
      sound: "default",
      title,
      body,
      data: {
        eventId: event.id,
      },
    }));

    // 7. Dispatch to Expo Push API
    const pushHeaders: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (expoAccessToken) {
      pushHeaders["Authorization"] = `Bearer ${expoAccessToken}`;
    }

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: pushHeaders,
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) {
      await pushResponse.text().catch(() => "");
      const safeError = `Expo Push API delivery error: HTTP ${pushResponse.status}`;
      const { data: completed, error: completeErr } = await adminClient.rpc(
        "complete_shared_moment_notification_delivery",
        {
          p_event_id: event.id,
          p_recipient_id: recipientUserId,
          p_attempt_count: attemptCount,
          p_status: "failed",
          p_error: safeError,
        }
      );

      if (completeErr || !completed) {
        return new Response(
          JSON.stringify({
            error: `Database error recording delivery failure: ${completeErr?.message || "stale reservation attempt"}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: safeError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushResult = await pushResponse.json();

    // 8. Inspect individual tickets
    let acceptedTicketsCount = 0;
    const tokensToDelete: string[] = [];

    if (pushResult && Array.isArray(pushResult.data)) {
      pushResult.data.forEach((ticket: any, index: number) => {
        if (ticket.status === "ok") {
          acceptedTicketsCount++;
        } else if (
          ticket.status === "error" &&
          ticket.details &&
          ticket.details.error === "DeviceNotRegistered"
        ) {
          const invalidToken = tokens[index];
          if (invalidToken?.id) {
            tokensToDelete.push(invalidToken.id);
          }
        }
      });

      // Cleanup unregistered tokens
      if (tokensToDelete.length > 0) {
        await adminClient
          .from("user_device_push_tokens")
          .delete()
          .in("id", tokensToDelete);
      }
    }

    // 9. Persist final atomic delivery state bound to this reservation attempt
    if (acceptedTicketsCount > 0) {
      const { data: completed, error: completeErr } = await adminClient.rpc(
        "complete_shared_moment_notification_delivery",
        {
          p_event_id: event.id,
          p_recipient_id: recipientUserId,
          p_attempt_count: attemptCount,
          p_status: "accepted",
          p_error: null,
        }
      );

      if (completeErr || !completed) {
        return new Response(
          JSON.stringify({
            error: `Database error updating delivery status: ${completeErr?.message || "stale reservation attempt"}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, count: acceptedTicketsCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const ticketErrors = (pushResult?.data || [])
        .map((t: any) => t?.message || t?.details?.error || "rejected")
        .join("; ");

      const { data: completed, error: completeErr } = await adminClient.rpc(
        "complete_shared_moment_notification_delivery",
        {
          p_event_id: event.id,
          p_recipient_id: recipientUserId,
          p_attempt_count: attemptCount,
          p_status: "failed",
          p_error: ticketErrors || "All push tickets rejected",
        }
      );

      if (completeErr || !completed) {
        return new Response(
          JSON.stringify({
            error: `Database error recording delivery failure: ${completeErr?.message || "stale reservation attempt"}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `All push tickets rejected: ${ticketErrors}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
