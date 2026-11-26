import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReframeMetadata } from "./semantic-classifier.ts";
import { interpretSituation, type InterpretedSituation } from "./situation-interpreter.ts";
import { composeAngles } from "./tone-composer.ts";
import { validateReframeQuality } from "./reframe-quality-guard.ts";
import { bindSituation, evaluateSafety, type BoundSituation } from "./knowledge-resolver.ts";
import { composeFromPgHkb, type CandidateProvenance } from "./pg-hkb-composer.ts";

export type EngineMode = "authoritative" | "legacy_rollback";
export const AUTHORITATIVE_ENGINE_MODE: EngineMode = "authoritative";
export const USE_KNOWLEDGE_RESOLVER = true;

export type ReframeToneKey = "gentle" | "playful" | "exaggerated";

export interface ReframeAngle {
  toneLabel: string;
  icon: string;
  text: string;
}

export type ReframeAngles = Record<ReframeToneKey, ReframeAngle>;

export type ReframeOutcomeType =
  | "playful_angles"
  | "clarification_needed"
  | "respectful_reflection"
  | "understood_unavailable_humor"
  | "unsupported_continuation";

export type UnavailableHumorReason =
  | "meaning_unclear"
  | "humor_not_covered"
  | "humor_inappropriate"
  | "clarification_exhausted";

export interface ReframeOutcome {
  type: ReframeOutcomeType;
  unavailableReason?: UnavailableHumorReason;
  angles?: ReframeAngles;
  clarificationMessage?: string;
  reflectionMessage?: string;
  continuationTitle?: string;
  continuationBody?: string;
  situation?: InterpretedSituation;
  boundSituation?: BoundSituation;
  provenance?: CandidateProvenance;
}

export interface GenerateLighterAnglesInput {
  text: string;
  seedModifier?: number;
  mode?: "local_only" | "hybrid";
  engineMode?: EngineMode;
}

export interface GenerateLighterAnglesResult {
  angles: ReframeAngles;
  source: "provider" | "local_semantic" | "universal_fallback" | "local_compositional";
  enginePath?: "knowledge_enriched" | "legacy_rollback";
  metadata?: ReframeMetadata;
  outcome?: ReframeOutcome;
  provenance?: CandidateProvenance;
}

/**
 * Determines the Stage 2 outcome honoring universal safety & clarification rules.
 */
export function determineReframeOutcome(
  situationOrBound: InterpretedSituation | BoundSituation,
  angles: ReframeAngles,
  boundOverride?: BoundSituation,
  provenance?: CandidateProvenance
): ReframeOutcome {
  const bound = boundOverride || ("resolutionLevel" in situationOrBound ? situationOrBound : undefined);
  const sit = "resolutionLevel" in situationOrBound ? undefined : situationOrBound;

  if (
    sit?.sensitivity === "serious" ||
    sit?.sensitivity === "boundary" ||
    bound?.outcomeType === "respectful_reflection"
  ) {
    return {
      type: "respectful_reflection",
      unavailableReason: "humor_inappropriate",
      reflectionMessage:
        "Not every moment needs a lighter angle. Some things deserve to be taken seriously. You can leave this as a private reflection if that feels right.",
      angles,
      situation: sit,
      boundSituation: bound,
      provenance,
    };
  }

  // Understood situation but humor coverage is not available
  if (bound && bound.resolutionLevel <= 3 && !provenance && bound.outcomeType === "clarification_needed" && bound.diagnostic?.generalFailureCategory === "unsupported_construction") {
    return {
      type: "understood_unavailable_humor",
      unavailableReason: "humor_not_covered",
      continuationTitle: "Let's leave this one as it is.",
      continuationBody: "We don't have a lighter angle that quite fits this moment yet.",
      angles,
      situation: sit,
      boundSituation: bound,
      provenance,
    };
  }

  if (sit?.ambiguity || bound?.outcomeType === "clarification_needed") {
    return {
      type: "clarification_needed",
      unavailableReason: "meaning_unclear",
      clarificationMessage:
        bound?.clarificationMessage ||
        (sit as any)?.clarificationPrompt ||
        "A little more context? If you'd like, add a small detail and we'll see if there's a lighter side to it.",
      angles,
      situation: sit,
      boundSituation: bound,
      provenance,
    };
  }
  return {
    type: "playful_angles",
    angles,
    situation: sit,
    boundSituation: bound,
    provenance,
  };
}

/**
 * Single authoritative generation pass using PG-RKB + PG-HKB (with ZERO legacy interception).
 */
export function generateAuthoritativeDetails(
  text: string,
  seedModifier: number = 0,
  engineMode: EngineMode = AUTHORITATIVE_ENGINE_MODE
): {
  angles: ReframeAngles;
  bound?: BoundSituation;
  legacySituation?: InterpretedSituation;
  provenance?: CandidateProvenance;
  enginePath: "knowledge_enriched" | "legacy_rollback";
} {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      angles: {
        gentle: {
          toneLabel: "Gentle and cute",
          icon: "🌱",
          text: "A quiet moment of peaceful rest together.",
        },
        playful: {
          toneLabel: "More playful",
          icon: "🎭",
          text: "Taking a scenic detour through our afternoon routine.",
        },
        exaggerated: {
          toneLabel: "Slightly exaggerated",
          icon: "📢",
          text: "A gentle pause while today slows down to a cozy stroll.",
        },
      },
      enginePath: engineMode === "legacy_rollback" ? "legacy_rollback" : "knowledge_enriched",
    };
  }

  // Explicit legacy comparison / rollback mode only (never executed by default authoritative path)
  if (engineMode === "legacy_rollback") {
    const legacySit = interpretSituation(trimmed);
    const safety = evaluateSafety(trimmed, legacySit.normalizedText);
    if (safety.outcomeType === "respectful_reflection") {
      legacySit.sensitivity = safety.sensitivity === "serious_unsafe" ? "serious" : "boundary";
    }
    const rawAngles = composeAngles(legacySit, seedModifier);
    const validation = validateReframeQuality(rawAngles, legacySit);
    return {
      angles: {
        gentle: { toneLabel: "Gentle and cute", icon: "🌱", text: validation.validatedAngles.gentle },
        playful: { toneLabel: "More playful", icon: "🎭", text: validation.validatedAngles.playful },
        exaggerated: { toneLabel: "Slightly exaggerated", icon: "📢", text: validation.validatedAngles.exaggerated },
      },
      legacySituation: legacySit,
      enginePath: "legacy_rollback",
    };
  }

  // AUTHORITATIVE SINGLE-PASS ENGINE (PG-RKB + PG-HKB) — Zero duplicate legacy passes!
  const bound = bindSituation(trimmed);
  let rawAngles = {
    gentle: "A quiet pause while everyday life sorts itself out.",
    playful: "Adding a tiny bit more detail could help match this moment accurately.",
    exaggerated: "Two extra words will make sure we picture the exact situation cleanly.",
  };
  let provenance: CandidateProvenance | undefined = undefined;

  if (bound.outcomeType === "respectful_reflection") {
    const hkbResult = composeFromPgHkb(bound, seedModifier);
    if (hkbResult) {
      rawAngles = {
        gentle: hkbResult.gentle,
        playful: hkbResult.playful,
        exaggerated: hkbResult.exaggerated,
      };
      provenance = hkbResult.provenance;
    } else {
      rawAngles = {
        gentle: "A calm space where your personal boundaries and comfort deserve full respect.",
        playful: "Honoring personal pace without pressure—your comfort and choice always come first.",
        exaggerated: "Respecting clear boundaries matters most; taking space to reflect privately is completely valid.",
      };
    }
  } else if (bound.outcomeType !== "clarification_needed") {
    const hkbResult = composeFromPgHkb(bound, seedModifier);
    if (hkbResult) {
      rawAngles = {
        gentle: hkbResult.gentle,
        playful: hkbResult.playful,
        exaggerated: hkbResult.exaggerated,
      };
      provenance = hkbResult.provenance;
    } else {
      // Composition failed or no compatible construction exists:
      // DO NOT claim successful playful angles! Demote outcomeType to clarification_needed
      bound.outcomeType = "clarification_needed";
      bound.clarificationMessage =
        bound.clarificationMessage ||
        `A little more context? A few extra words could help us understand what actually happened.`;
      rawAngles = {
        gentle: bound.clarificationMessage,
        playful: "Adding one or two extra words will help avoid guessing the wrong angle.",
        exaggerated: "Just a quick detail is needed before turning this moment into a lighter perspective.",
      };
    }
  } else {
    rawAngles = {
      gentle: bound.clarificationMessage || "A little more context will help us match what actually happened.",
      playful: "Adding one or two extra words will help avoid guessing the wrong angle.",
      exaggerated: "Just a quick detail is needed before turning this moment into a lighter perspective.",
    };
  }

  // Quality Guard validation against semantic constraints
  const guardContext: any = {
    sensitivity:
      bound.sensitivity === "serious_unsafe"
        ? "serious"
        : bound.sensitivity === "boundary_concern"
          ? "boundary"
          : "light",
    situationType: bound.outcomeType === "clarification_needed" ? "ambiguous" : "behavior",
    linguistic: { proposition: bound.proposition },
  };
  const validation = validateReframeQuality(rawAngles, guardContext);
  const validated = validation.validatedAngles;

  return {
    angles: {
      gentle: { toneLabel: "Gentle and cute", icon: "🌱", text: validated.gentle },
      playful: { toneLabel: "More playful", icon: "🎭", text: validated.playful },
      exaggerated: { toneLabel: "Slightly exaggerated", icon: "📢", text: validated.exaggerated },
    },
    bound,
    provenance,
    enginePath: "knowledge_enriched",
  };
}

export function generateLocalSemanticAngles(
  text: string,
  seedModifier: number = 0
): ReframeAngles {
  return generateAuthoritativeDetails(text, seedModifier, AUTHORITATIVE_ENGINE_MODE).angles;
}

export function validateStructuredAnglesResponse(data: any): data is {
  gentle: string;
  playful: string;
  exaggerated: string;
} {
  if (!data || typeof data !== "object") return false;
  if (typeof data.gentle !== "string" || data.gentle.trim().length === 0) return false;
  if (typeof data.playful !== "string" || data.playful.trim().length === 0) return false;
  if (typeof data.exaggerated !== "string" || data.exaggerated.trim().length === 0) return false;

  const gWords = data.gentle.trim().split(/\s+/).length;
  const pWords = data.playful.trim().split(/\s+/).length;
  const eWords = data.exaggerated.trim().split(/\s+/).length;

  if (gWords < 4 || gWords > 45) return false;
  if (pWords < 4 || pWords > 45) return false;
  if (eWords < 4 || eWords > 45) return false;

  return true;
}

/**
 * Authoritative Hybrid Entry Point (runs local authoritative PG-RKB + PG-HKB by default).
 */
export async function generateLighterAnglesHybrid(
  supabase: SupabaseClient | null,
  input: GenerateLighterAnglesInput
): Promise<GenerateLighterAnglesResult> {
  const trimmed = input.text.trim();
  const seed = input.seedModifier || 0;
  const isExplicitLocalOnly = input.mode === "local_only";

  if (!trimmed) {
    const emptyAngles = generateLocalSemanticAngles("A small quiet pause", seed);
    return {
      angles: emptyAngles,
      source: "universal_fallback",
      outcome: {
        type: "playful_angles",
        angles: emptyAngles,
      },
    };
  }

  // Dormant server-side Edge Function (skipped in local_only mode)
  if (!isExplicitLocalOnly && supabase && typeof supabase.functions?.invoke === "function") {
    try {
      const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("Server generation timeout") }), 3500)
      );

      const invokePromise = supabase.functions.invoke("generate-lighter-angles", {
        body: { text: trimmed, seed },
      });

      const response = await Promise.race([invokePromise, timeoutPromise]);

      if (!("error" in response) || !response.error) {
        const body = (response as any).data;
        if (body && body.source === "provider" && validateStructuredAnglesResponse(body)) {
          const providerAngles: ReframeAngles = {
            gentle: { toneLabel: "Gentle and cute", icon: "🌷", text: body.gentle.trim() },
            playful: { toneLabel: "More playful", icon: "🎭", text: body.playful.trim() },
            exaggerated: { toneLabel: "Slightly exaggerated", icon: "📢", text: body.exaggerated.trim() },
          };
          return {
            angles: providerAngles,
            source: "provider",
            metadata: {
              semantic_family: "provider_generated",
              semantic_topic: "provider_generated",
              confidence: 1.0,
              generation_source: "provider",
              unknown_topic: false,
              matched_count: 1,
            },
            outcome: {
              type: "playful_angles",
              angles: providerAngles,
            },
          };
        }
      }
    } catch {
      // Fall back cleanly to authoritative local engine
    }
  }

  const details = generateAuthoritativeDetails(trimmed, seed, input.engineMode || AUTHORITATIVE_ENGINE_MODE);
  const bound = details.bound;
  const outcome = determineReframeOutcome(
    bound || details.legacySituation!,
    details.angles,
    bound,
    details.provenance
  );

  const isUnknownTopic = bound ? bound.resolutionLevel >= 4 : (details.legacySituation?.confidence || 0) < 0.35;
  const source: "local_semantic" | "universal_fallback" = isUnknownTopic ? "universal_fallback" : "local_semantic";

  const privacySafeMetadata: ReframeMetadata = {
    semantic_family: bound ? (bound.domainIds[0] || "unknown") : (details.legacySituation?.family || "unknown"),
    semantic_topic: bound ? bound.frameId : (details.legacySituation?.primaryTopic || "unknown"),
    confidence: bound ? (bound.resolutionLevel <= 2 ? 0.9 : bound.resolutionLevel === 3 ? 0.7 : 0.25) : (details.legacySituation?.confidence || 0.25),
    generation_source: source,
    unknown_topic: isUnknownTopic,
    matched_count: bound ? bound.allConcepts.length : (details.legacySituation?.matchedSignals.length || 0),
  };

  return {
    angles: details.angles,
    source,
    enginePath: details.enginePath,
    metadata: privacySafeMetadata,
    outcome,
    provenance: details.provenance,
  };
}
