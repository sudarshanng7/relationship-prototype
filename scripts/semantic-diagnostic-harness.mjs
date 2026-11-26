/**
 * scripts/semantic-diagnostic-harness.mjs
 *
 * Developer-only diagnostic harness for the authoritative Purple Garden
 * PG-RKB & PG-HKB semantic interpretation and humor generation pipeline.
 *
 * Exposes all internal pipeline stages without modifying production engine behavior.
 */

import {
  normalizeText,
  analyzeLinguisticStructure,
} from "../src/lib/semantic-normalizer.ts";
import {
  bindSituation,
  evaluateSafety,
  resolveActionPolarity,
  resolveConceptsAndVerbs,
  resolveAndAttachModifiers,
  resolveContexts,
} from "../src/lib/knowledge-resolver.ts";
import {
  composeFromPgHkb,
  validateCandidateIntegrity,
  realizeConstructionTemplate,
} from "../src/lib/pg-hkb-composer.ts";
import {
  generateAuthoritativeDetails,
  determineReframeOutcome,
} from "../src/lib/reframe-generator.ts";
import { validateReframeQuality } from "../src/lib/reframe-quality-guard.ts";
import { RUNTIME_KNOWLEDGE_BUNDLE } from "../src/lib/compiled-knowledge-data.ts";

export function diagnoseInput(rawInput, seedModifier = 0) {
  const trimmed = rawInput.trim();

  // 1. Normalization & Linguistic Structure
  const normalizedText = normalizeText(trimmed);
  const lingStructure = analyzeLinguisticStructure(normalizedText);

  // 2. Lexical expressions and candidate word senses
  const lexicalAndVerbs = resolveConceptsAndVerbs(normalizedText);

  // 3. Modifiers and attachment
  const modifiers = resolveAndAttachModifiers(normalizedText, lexicalAndVerbs.concepts);

  // 4. Contexts
  const contexts = resolveContexts(normalizedText);

  // 5. Polarity
  const polarity = resolveActionPolarity(normalizedText);

  // 6. Safety & Sensitivity
  const safety = evaluateSafety(trimmed, normalizedText);

  // 7. Bound Situation (Authoritative PG-RKB)
  const bound = bindSituation(trimmed);

  // 8. Authoritative Engine Generation Details
  const authDetails = generateAuthoritativeDetails(trimmed, seedModifier);

  // 9. Outcome Decision
  const reframeOutcome = determineReframeOutcome(
    authDetails.bound || bound,
    authDetails.angles,
    authDetails.bound || bound,
    authDetails.provenance
  );

  // 10. Deep Humor Opportunity & Compatible Constructions Audit
  const targetOpp = bound.humorOpportunity;
  const constructions = RUNTIME_KNOWLEDGE_BUNDLE.entities?.constructions || {};
  const compatibleConstructions = [];
  const rejectedConstructions = [];

  for (const [id, c] of Object.entries(constructions)) {
    if (targetOpp && c.opp === targetOpp) {
      // Check polarity compatibility
      const boundPol = bound.actionPolarity || bound.polarity || "active";
      const polMatch = !c.pols || c.pols.length === 0 || c.pols.includes(boundPol);
      // Check required roles
      const missingRoles = (c.req || []).filter(r => !bound.boundRoles?.[r]);
      // Check sensitivity
      const sensMatch = !c.sens || c.sens.includes(bound.sensitivity);

      if (polMatch && missingRoles.length === 0 && sensMatch) {
        compatibleConstructions.push({ id, tone: c.t, template: c.tmpl, mechanism: c.mech, family: c.fam });
      } else {
        const reasons = [];
        if (!polMatch) reasons.push(`polarity_mismatch (c.pols=[${c.pols?.join(",")}], bound.pol=${bound.polarity})`);
        if (missingRoles.length > 0) reasons.push(`missing_required_roles=[${missingRoles.join(",")}]`);
        if (!sensMatch) reasons.push(`sensitivity_mismatch (c.sens=[${c.sens?.join(",")}], bound.sens=${bound.sensitivity})`);
        rejectedConstructions.push({ id, tone: c.t, reasons });
      }
    }
  }

  // 11. Quality Guard Evaluation
  const rawAnglesMap = {
    gentle: authDetails.angles.gentle.text,
    playful: authDetails.angles.playful.text,
    exaggerated: authDetails.angles.exaggerated.text,
  };
  const qualityEvaluation = validateReframeQuality(rawAnglesMap, {
    rawText: trimmed,
    normalizedText,
    action: bound.boundRoles?.action?.canonicalName,
    target: bound.boundRoles?.target?.canonicalName,
    polarity: bound.polarity,
    sensitivity: bound.sensitivity === "serious_unsafe" ? "serious" : bound.sensitivity === "boundary_concern" ? "boundary" : "ordinary",
    ambiguity: bound.outcomeType === "clarification_needed" ? "meaning_unclear" : null,
  });

  return {
    rawInput,
    normalizedText,
    lingStructure: {
      tokens: lingStructure.tokens,
      hasNegation: lingStructure.hasNegation,
      frequencyModifier: lingStructure.frequencyModifier,
      intensityModifier: lingStructure.intensityModifier,
      inferredAction: lingStructure.inferredAction,
      inferredTarget: lingStructure.inferredTarget,
    },
    lexicalTokens: lexicalAndVerbs.matchedTokens,
    matchedConcepts: lexicalAndVerbs.concepts.map(c => ({
      conceptId: c.conceptId,
      canonicalName: c.canonicalName,
      conceptType: c.conceptType,
      surfaceText: c.surfaceText,
      role: c.role,
    })),
    matchedVerbnetClasses: lexicalAndVerbs.verbnetMatches.map(v => ({
      className: v.className,
      action: v.action,
      suggestedFrame: v.suggestedFrame,
      roles: v.roles,
    })),
    modifiers,
    contexts,
    polarity,
    safety,
    boundSituation: {
      resolutionLevel: bound.resolutionLevel,
      frameId: bound.frameId,
      humorOpportunity: bound.humorOpportunity,
      polarity: bound.polarity,
      sensitivity: bound.sensitivity,
      outcomeType: bound.outcomeType,
      clarificationMessage: bound.clarificationMessage,
      boundRoles: {
        action: bound.boundRoles?.action ? {
          canonicalName: bound.boundRoles.action.canonicalName,
          conceptType: bound.boundRoles.action.conceptType,
          evidence: bound.boundRoles.action.evidenceSource,
        } : null,
        target: bound.boundRoles?.target ? {
          canonicalName: bound.boundRoles.target.canonicalName,
          conceptType: bound.boundRoles.target.conceptType,
          evidence: bound.boundRoles.target.evidenceSource,
        } : null,
        actor: bound.boundRoles?.actor ? {
          canonicalName: bound.boundRoles.actor.canonicalName,
          evidence: bound.boundRoles.actor.evidenceSource,
        } : null,
      },
      interpretationEvidence: bound.interpretationEvidence,
      missingInformation: bound.missingInformation,
      arbitration: bound.arbitration ? {
        selectedFrameId: bound.arbitration.selectedFrameId,
        winningReason: bound.arbitration.winningReason,
        eligibleCandidates: bound.arbitration.candidateScores
          .filter(c => c.eligible)
          .map(c => ({ frameId: c.frameId, totalScore: c.totalScore, evidence: c.supportingEvidence })),
        allScores: bound.arbitration.candidateScores.map(c => ({
          frameId: c.frameId,
          eligible: c.eligible,
          disqualificationReason: c.disqualificationReason,
          totalScore: c.totalScore,
          supportingEvidence: c.supportingEvidence
        }))
      } : null,
      diagnostic: bound.diagnostic,
    },
    humorAudit: {
      opportunity: targetOpp,
      compatibleConstructionsCount: compatibleConstructions.length,
      compatibleConstructions,
      rejectedConstructionsCount: rejectedConstructions.length,
      rejectedConstructions: rejectedConstructions.slice(0, 5),
    },
    provenance: authDetails.provenance ? {
      humorOpportunity: authDetails.provenance.humorOpportunity,
      selectedConstructions: authDetails.provenance.selectedConstructions,
      realizedTemplates: authDetails.provenance.realizedTemplates,
      mechanismsUsed: authDetails.provenance.mechanismsUsed,
      metaphorsUsed: authDetails.provenance.metaphorsUsed,
    } : null,
    qualityGuard: {
      isValid: qualityEvaluation.isValid,
      reasons: qualityEvaluation.reasons,
      substitutions: qualityEvaluation.substitutions,
    },
    finalEngineOutcome: {
      type: reframeOutcome.type,
      unavailableReason: reframeOutcome.unavailableReason,
      reflectionMessage: reframeOutcome.reflectionMessage,
      continuationTitle: reframeOutcome.continuationTitle,
      continuationBody: reframeOutcome.continuationBody,
      clarificationMessage: reframeOutcome.clarificationMessage,
      angles: {
        gentle: authDetails.angles.gentle.text,
        playful: authDetails.angles.playful.text,
        exaggerated: authDetails.angles.exaggerated.text,
      },
    },
  };
}

// CLI Execution support
if (process.argv[1]?.endsWith("semantic-diagnostic-harness.mjs")) {
  const inputs = process.argv.slice(2);
  const testSet = inputs.length > 0 ? inputs : [
    "she eats too slow",
    "Forgetting the evening plans",
    "watching tv for late night",
  ];

  for (const input of testSet) {
    console.log("\n" + "=".repeat(75));
    console.log(`DIAGNOSTIC TRACE: "${input}"`);
    console.log("=".repeat(75));
    const result = diagnoseInput(input);
    console.log(JSON.stringify(result, null, 2));
  }
}
