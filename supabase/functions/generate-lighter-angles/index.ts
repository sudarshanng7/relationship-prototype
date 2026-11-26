import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  text?: string;
  seed?: number;
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

    const { text, seed = 0 }: RequestPayload = await req.json();
    const cleanText = (text || "").trim();

    if (!cleanText) {
      return new Response(
        JSON.stringify({ error: "Missing text to reframe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    // If no provider key is available in the Edge environment, return a clean signal
    // so the client immediately runs the authoritative 68-topic local semantic engine.
    if (!openAiApiKey) {
      return new Response(
        JSON.stringify({ error: "provider_unavailable", message: "No LLM provider key configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call LLM with strict contract
    try {
      const prompt = `You are generating three short, non-blaming lighter perspectives for a couple relationship app.

Given one private description of a small everyday annoyance, produce exactly three alternatives:
1. gentle (gentle and cute)
2. playful (more playful)
3. exaggerated (slightly exaggerated)

Requirements:
- preserve the real situation
- do not accuse the partner
- do not infer malicious intent
- do not shame
- do not use therapy language
- do not give advice
- do not mention the app
- do not output explanations
- keep each output short (8-22 words)
- make each tone genuinely distinct
- slightly exaggerated may be absurd, but never cruel

Input: "${cleanText}"

Return JSON only in this format:
{"gentle": "...", "playful": "...", "exaggerated": "..."}`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 250,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.gentle && parsed.playful && parsed.exaggerated) {
            return new Response(
              JSON.stringify({
                gentle: parsed.gentle,
                playful: parsed.playful,
                exaggerated: parsed.exaggerated,
                source: "provider",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ error: "provider_failed", message: "Failed to generate structured provider output" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (llmErr: any) {
      return new Response(
        JSON.stringify({ error: "provider_error", message: llmErr?.message || "Upstream provider error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal generation error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
