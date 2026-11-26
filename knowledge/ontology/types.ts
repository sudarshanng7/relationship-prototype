/**
 * Purple Garden Relationship Knowledge Base (PG-RKB)
 * and Humor Intelligence Library (PG-HKB) Ontology Types.
 */

export type ConceptType =
  | "physical_object"
  | "substance"
  | "ingredient"
  | "person"
  | "social_role"
  | "place"
  | "activity"
  | "action"
  | "behavior"
  | "state"
  | "opinion"
  | "preference"
  | "proposition"
  | "emotion"
  | "expectation"
  | "quantity"
  | "frequency"
  | "intensity"
  | "time"
  | "sensory_experience"
  | "interpersonal_interaction"
  | "abstract_concept";

export type SemanticRelationType =
  | "is_a"
  | "part_of"
  | "has_part"
  | "used_for"
  | "used_in"
  | "located_in"
  | "associated_with"
  | "typically_involves"
  | "compatible_action"
  | "compatible_target"
  | "synonym_of"
  | "antonym_of"
  | "related_to"
  | "has_property"
  | "has_quantity"
  | "has_state"
  | "occurs_during"
  | "contrasts_with"
  | "expects"
  | "interrupts"
  | "modifies"
  | "expresses"
  | "may_indicate";

export type SensitivityLevel =
  | "ordinary_quirk"
  | "mild_interpersonal"
  | "ambiguous_concern"
  | "boundary_concern"
  | "serious_unsafe";

export interface KnowledgeDomain {
  id: string;
  name: string;
  category: "everyday_living" | "food_lifestyle" | "communication_behavior" | "time_routines" | "couple_social" | "shared_responsibilities_emotions";
  description: string;
  subdomains?: string[];
  sourceIds: string[];
}

export interface WordSense {
  id: string;
  lemma: string;
  pos: "noun" | "verb" | "adj" | "adv" | "phrase";
  definition: string;
  conceptType: ConceptType;
  examples: string[];
  domainIds: string[];
  synonyms: string[];
  sourceId: string;
}

export interface Concept {
  id: string;
  canonicalName: string;
  conceptType: ConceptType;
  definition: string;
  domainIds: string[];
  primarySenseId: string;
  alternateSenseIds?: string[];
  isAbstract: boolean;
  isNegatedConcept?: boolean;
  defaultSensitivity: SensitivityLevel;
  sourceIds: string[];
  metadata?: Record<string, unknown>;
}

export interface SemanticRelationship {
  id: string;
  sourceConceptId: string;
  relationType: SemanticRelationType;
  targetConceptId: string;
  confidence: number; // 0.0 - 1.0
  isFactual: boolean;
  contextCondition?: string;
  sourceId: string;
}

export interface SemanticFrameRole {
  id: string;
  name: string;
  acceptedConceptTypes: ConceptType[];
  required: boolean;
  description: string;
}

export interface SemanticFrame {
  id: string;
  name: string;
  description: string;
  relatedDomains: string[];
  triggers: string[];
  roles: SemanticFrameRole[];
  compatibleModifiers: string[];
  relatedFrames: string[];
  sourceIds: string[];
}

export interface SemanticModifier {
  id: string;
  name: string;
  category: "quantity" | "comparison" | "frequency" | "intensity" | "scope" | "negation";
  canonicalValue: string;
  expressions: string[];
  appliesToConceptTypes: ConceptType[];
  semanticEffect: string;
  sourceIds: string[];
}

export interface ContextConcept {
  id: string;
  name: string;
  category: "timing" | "location" | "interaction" | "situational_expectation";
  expectedAtmosphere: string;
  associatedDomains: string[];
  triggers: string[];
  sourceIds: string[];
}

export interface EmotionConcept {
  id: string;
  name: string;
  valence: "positive" | "neutral" | "negative" | "mixed";
  arousal: "low" | "medium" | "high";
  interpersonalRelevance: string;
  mayCooccurWithDomains: string[];
  sourceIds: string[];
}

// -------------------------------------------------------------
// PG-HKB: Humor Intelligence Library Types
// -------------------------------------------------------------

export interface HumorMechanism {
  id: string;
  name: string;
  description: string;
  theoreticalBasis: "incongruity" | "benign_violation" | "play_mirth" | "relief" | "observational";
  compatibleSituationTypes: string[];
  compatibleSemanticFrames: string[];
  requiredSemanticRelations: SemanticRelationType[];
  compatibleConceptTypes: ConceptType[];
  incompatibleConceptTypes: ConceptType[];
  compatibleTones: ("gentle" | "playful" | "exaggerated")[];
  humorIntensity: number; // 1-5
  allowedSensitivityLevels: SensitivityLevel[];
  prohibitedConditions: string[];
  metaphorFamilyIds: string[];
  constructionIds: string[];
  sourceIds: string[];
  implementationStatus: "knowledge_only" | "constructor_available" | "runtime_verified";
}

export interface MetaphorFamily {
  id: string;
  name: string;
  domain: string;
  sourceDomain: string;
  targetDomain: string;
  imageryKeywords: string[];
  compatibleSituationTypes: string[];
  exampleAnalogies: string[];
  sourceIds: string[];
}

export interface HumorConstruction {
  id: string;
  name: string;
  patternName: string;
  mechanismId: string;
  requiredRoles: string[];
  supportedConceptTypes: ConceptType[];
  grammarTemplate: string;
  tone: "gentle" | "playful" | "exaggerated";
  sensitivityRestrictions: SensitivityLevel[];
  sampleRealizations: string[];
  sourceIds: string[];
}
