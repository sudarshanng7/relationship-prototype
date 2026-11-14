/**
 * Purple Garden - Explorable Garden World Model (Phase 1 Foundation)
 *
 * Renderer-independent, 2.5D botanical and ecological world representation.
 * Encapsulates stable structural nodes, parent-child hierarchies, depth-layer ordering,
 * attachment anchors, collision-safe semantic event links, and living ecosystem relationships.
 *
 * ARCHITECTURAL BOUNDARIES:
 * - Pure data types only: No React components, JSX, platform image handles, or database clients.
 * - Privacy-first: No raw notes, private reflections, partner names, or personal identities.
 * - Temporal honesty: Structural nodes without known dates never receive fabricated timestamps.
 * - Ecological neutrality: Fauna represents a hospitable habitat—NOT relationship scores, streaks, or judgment.
 */

import type {
  GardenCareEvent,
  GardenCareSignals,
  GardenStage,
  PositiveBotanicalFamily,
  PositiveBotanicalVariant,
} from "../garden-generator";

export const GARDEN_WORLD_SCHEMA_VERSION = "1.0.0";
export const GARDEN_GENERATOR_VERSION = "legacy-procedural-svg-v1";
export const GARDEN_ASSET_SET_VERSION = "builtin-procedural-v1";

// ----------------------------------------------------
// 1. BASIC 2D GEOMETRY PRIMITIVES
// ----------------------------------------------------

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Transform2D {
  position: Point2D;
  rotation: number; // in radians
  scale: Point2D;
  pivot: Point2D;
}

// ----------------------------------------------------
// 2. DISCRIMINATED NODE ROLES & CLASSIFICATIONS
// ----------------------------------------------------

export type GardenNodeRole =
  | "world_root"
  | "terrain_region"
  | "trunk"
  | "branch"
  | "root"
  | "foliage"
  | "bud_blossom_fruit"
  | "ground_flora"
  | "landmark"
  | "habitat_node"
  | "creature_node"
  | "habitat_detail"; // Legacy compatibility

export type AppearanceOrigin =
  | "source_event"       // Earned explicitly via a shared partner care event
  | "growth_threshold"   // Emerged as part of stage progression threshold
  | "stage_structure"    // Inherent botanical baseline of the current growth stage
  | "ecosystem_natural"  // Natural fauna/habitat responding to hospitable botanical maturity
  | "unknown";           // Fallback/unclassified

export type StructuralMappingType =
  | "legacy_stage_local" // Known stage-local representation replaced at stage transitions
  | "continuous_structural"; // Preserved continuously across lifecycle growth

// ----------------------------------------------------
// 3. SOURCE EVENT ATTRIBUTION (PRIVACY-PRESERVING)
// ----------------------------------------------------

export interface SourceEventRef {
  kind: GardenCareEvent["kind"];
  id: string;
  semanticKey: string; // e.g. "reconnection:123e4567-e89b-..."
  authoritativeTimestamp?: string | null;
}

// ----------------------------------------------------
// 4. DISCRIMINATED GARDEN WORLD NODES
// ----------------------------------------------------

interface BaseGardenNode {
  id: string; // Canonical collision-safe world node ID (e.g. "earned:positive_moment:uuid" or "structural:trunk:main")
  legacyFeatureId?: string | null; // Compatibility hashed visual ID (e.g. "care-positive-a1b2c3d4")
  earnedGroupKey?: string | null; // Semantic group key (e.g. "positive_moment:uuid")
  role: GardenNodeRole;
  semanticKey?: string | null;
  parentId: string | null;
  childIds: string[];
  depthLayer: number; // -100 (Sky) to +100 (Foreground highlights)
  localTransform: Transform2D;
  worldBounds: BoundingBox2D;
  anchorPoint: Point2D;
  isEarned: boolean;
  sourceEvent?: SourceEventRef | null;
  appearanceOrigin: AppearanceOrigin;
  mappingType: StructuralMappingType;
}

export interface WorldRootNode extends BaseGardenNode {
  role: "world_root";
}

export interface TerrainRegionNode extends BaseGardenNode {
  role: "terrain_region";
  regionKind:
    | "distant_hills"
    | "rear_grass"
    | "mid_grass"
    | "front_grass"
    | "soil_bed"
    | "root_shadow";
  pathD: string;
}

export interface TrunkNode extends BaseGardenNode {
  role: "trunk";
  pathD: string;
  highlightPathD?: string;
  shadowPathD?: string;
}

export interface BranchNode extends BaseGardenNode {
  role: "branch";
  branchIndex: number;
  pathD: string;
}

export interface RootNode extends BaseGardenNode {
  role: "root";
  rootIndex: number;
  pathD: string;
}

export interface FoliageNode extends BaseGardenNode {
  role: "foliage";
  family?: PositiveBotanicalFamily;
  variant?: PositiveBotanicalVariant;
  pathD?: string;
  leafVeinPathD?: string;
  color?: string;
}

export interface BudBlossomFruitNode extends BaseGardenNode {
  role: "bud_blossom_fruit";
  blossomKind:
    | "blossom"
    | "closed_bud"
    | "paired_buds"
    | "flowering_shoot"
    | "seed_pod"
    | "berry_cluster"
    | "fruit_bud";
  family?: PositiveBotanicalFamily;
  variant?: PositiveBotanicalVariant;
  center: Point2D;
  radius: number;
  petalCount?: number;
  rotation?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface GroundFloraNode extends BaseGardenNode {
  role: "ground_flora";
  floraType:
    | "stone"
    | "grass"
    | "flower"
    | "bud"
    | "moss"
    | "soil-fleck"
    | "ground-cover"
    | "root-shadow"
    | "fern"
    | "clover"
    | "seed-head"
    | "sprout"
    | "meadow-flower"
    | "flowering-herb";
  position: Point2D;
  radius?: number;
  pathD?: string;
  color?: string;
}

export interface LandmarkNode extends BaseGardenNode {
  role: "landmark";
  position: Point2D;
  eventDate?: string;
  color?: string;
}

// ----------------------------------------------------
// 5. LIVING ECOSYSTEM NODES (HABITAT & FAUNA)
// ----------------------------------------------------

export type HabitatKind =
  | "canopy_shelter"
  | "branch_perch"
  | "nest_site"
  | "hollow"
  | "root_shelter"
  | "moss_bed"
  | "pollinator_patch"
  | "stone_shelter"
  | "water_edge"
  | "stream_habitat";

export interface HabitatNode extends BaseGardenNode {
  role: "habitat_node";
  habitatKind: HabitatKind;
  capacity: number; // Max concurrent creatures supported
  supportedCreatureTypes: CreatureType[];
  stabilityMaturityUnits: number; // Growth units required for this habitat to establish
  anchorType: CreatureAnchorType;
}

export type CreatureType =
  | "bird"
  | "butterfly"
  | "bee"
  | "dragonfly"
  | "frog"
  | "hedgehog"
  | "ladybird";

export type CreatureAnchorType =
  | "branch_perch"
  | "blossom_pollinator"
  | "stream_path"
  | "water_edge"
  | "root_shelter"
  | "ground_cover";

export type CreatureLifestyle =
  | "resident"       // Associated with a persistent habitat (e.g. nest, root shelter)
  | "visitor"        // Deterministically eligible visitor (e.g. songbird, butterfly)
  | "ambient_micro"; // Subtle micro-life (e.g. ladybird, pollinator)

export type MotionProfile =
  | "still"
  | "perching"
  | "small_head_wing_movement"
  | "wing_flutter"
  | "short_flight_route"
  | "hover"
  | "ripple"
  | "gentle_forage";

export interface CreatureNode extends BaseGardenNode {
  role: "creature_node";
  creatureType: CreatureType;
  species: string; // e.g. "European Robin", "Peacock Butterfly", "Buff-tailed Bumblebee"
  lifestyle: CreatureLifestyle;
  habitatParentId: string;
  anchorType: CreatureAnchorType;
  restingAnchor: Point2D;
  movementBounds: BoundingBox2D; // Bounded region movement never exceeds
  scaleRange: [number, number]; // e.g. [0.9, 1.1]
  motionProfile: MotionProfile;
  reducedMotionState: "still";
  lodVisibility: "always" | "close_zoom";
  accessibleDescription: string;
}

export interface HabitatDetailNode extends BaseGardenNode {
  role: "habitat_detail";
  creatureKind:
    | "butterfly"
    | "pollinator"
    | "bird_perch"
    | "bird-perch"
    | "nest_material"
    | "nest-material"
    | "sparrow"
    | "robin"
    | "goldfinch"
    | "swallow";
  position: Point2D;
  scale: number;
  primaryColor?: string;
}

export type GardenNode =
  | WorldRootNode
  | TerrainRegionNode
  | TrunkNode
  | BranchNode
  | RootNode
  | FoliageNode
  | BudBlossomFruitNode
  | GroundFloraNode
  | LandmarkNode
  | HabitatNode
  | CreatureNode
  | HabitatDetailNode;

// ----------------------------------------------------
// 6. SEMANTIC EARNED-FEATURE GROUP & INTERACTIVE HIT REGIONS
// ----------------------------------------------------

export interface EarnedFeatureGroup {
  semanticKey: string;
  sourceEvent: SourceEventRef;
  nodeIds: string[];
  bounds: BoundingBox2D;
  anchor: Point2D;
  family?: PositiveBotanicalFamily;
  variant?: PositiveBotanicalVariant;
}

export interface SemanticHitRegion {
  id: string; // Hit region identifier
  nodeId: string; // Canonical node ID
  semanticKey: string | null; // e.g. "positive_moment:uuid"
  role: GardenNodeRole;
  sourceEvent: SourceEventRef | null;
  isEarned: boolean;
  depthLayer: number; // e.g. -100 to +100
  interactionPriority: number; // 100 for earned memory, 50 for fauna, 20 for branches, 10 for terrain
  visualBounds: BoundingBox2D; // Conservative visual bounding box in world space
  screenVisualBounds: BoundingBox2D; // Projected visual footprint in screen space
  interactionScreenBounds: BoundingBox2D; // Expanded accessible target (>= 44x44pt)
  anchorPoint: Point2D;
  isAccessibleTarget: boolean;
}

// ----------------------------------------------------
// 7. ECOSYSTEM STATE
// ----------------------------------------------------

export interface GardenEcosystemState {
  habitats: Record<string, HabitatNode>;
  creatures: Record<string, CreatureNode>;
  eligibleSpecies: string[];
  ecologicalSummary: string; // Calm, non-judgmental description
}

// ----------------------------------------------------
// 8. MASTER GARDEN WORLD MODEL
// ----------------------------------------------------

export interface GardenWorld {
  schemaVersion: string;
  generatorVersion: string;
  assetSetVersion: string;
  coupleSeed: number;
  seedString: string;
  stage: GardenStage;
  evaluatedAt: string | null;
  totalGrowthUnits: number;
  careGrowthUnits: number;
  timeGrowthUnits: number;
  isResting: boolean;
  effectiveTheme: "light" | "dim" | "dark";
  careSignals: GardenCareSignals;
  rootNodeId: string;
  nodes: Record<string, GardenNode>;
  renderIdToNodeIds: Record<string, string[]>; // Mapping from legacy renderId/featureId to canonical node IDs
  earnedFeatureGroups: Record<string, EarnedFeatureGroup>;
  ecosystem: GardenEcosystemState;
  worldBounds: BoundingBox2D;
  metadata: {
    totalNodes: number;
    earnedNodeCount: number;
    decorativeNodeCount: number;
    habitatNodeCount: number;
    creatureNodeCount: number;
    stageMappingGaps: string[];
  };
}

// ----------------------------------------------------
// 9. ASSET MANIFEST CONTRACT (PHASE 1 SPECIFICATION)
// ----------------------------------------------------

export interface BotanicalAssetManifest {
  assetKey: string;
  version: string;
  botanicalFamily: string;
  variant: string;
  localBounds: BoundingBox2D;
  attachmentPivot: Point2D;
  depthLayer: number;
  detailLevelVariants: {
    low?: string;
    medium?: string;
    high?: string;
  };
  licensingProvenance: {
    source: "procedural" | "custom_svg" | "licensed";
    author?: string;
    notes?: string;
  };
  themeVariants?: Record<"light" | "dim" | "dark", Record<string, string>>;
}
