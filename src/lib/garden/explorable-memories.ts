/**
 * Purple Garden - Explorable Memory World & Spatial Navigation Contract
 *
 * Provides a canonical, deterministic ordered collection of explorable memories
 * derived strictly from authorized shared metadata within GardenWorld.
 *
 * Invariants:
 * 1. Every explorable memory maps 1:1 to an actual authorized database record.
 * 2. Decorative nodes (tree, bark, meadow, stream, atmosphere) are NEVER memories.
 * 3. Chronological ordering uses canonical earned timestamps with deterministic ID tie-breaking.
 * 4. Privacy Boundary: Never exposes private reflections, private notes, Mine-only moments,
 *    repair text belonging to another person, emails, internal DB IDs, or relationship scores.
 * 5. Reconnection features route directly to the parent relationship event (/event/[id]).
 * 6. Both partners resolve identical memories, positions, and bounds for the same history.
 */

import {
  type BoundingBox2D,
  type GardenMemorySource,
  type GardenWorld,
  type Point2D,
  type ScenicRegion,
} from "./world-types";
import { type GardenCareEvent } from "../garden-generator";
import { getCanonicalEventHeading } from "../event-heading";

export interface ExplorableMemoryItem {
  index: number; // 0-based index in the sequence (0 to totalMemories - 1)
  totalMemories: number;
  nodeId: string; // Canonical node ID (e.g. "earned:positive_moment:uuid")
  legacyFeatureId: string; // Compatibility visual ID (e.g. "care-positive-a1b2c3d4")
  semanticKey: string; // e.g. "positive_moment:uuid"
  source: GardenMemorySource;
  bounds: BoundingBox2D;
  anchor: Point2D;
  scenicRegion?: ScenicRegion;
  chronologicalTimestamp: string;
  memoryType: "Shared Good Moment" | "Reconnection" | "Important Date";
  botanicalRepresentation:
    | "Shared Moment Growth"
    | "Reconnection Shoot"
    | "Reconnection Blossom"
    | "Important-Date Landmark"
    | "Foundation Memory Leaf"
    | "Foundation Reconnection Pair"
    | "Foundation Date Acorn";
  displayHeadline: string;
  displayDateLabel: string;
  explanatoryCopy: string;
  actionLabel: string;
  actionRoute: string | null;
  accessibilityLabel: string;
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Extracts and sorts the complete collection of explorable earned memories
 * from a GardenWorld and its authorized care events snapshot.
 */
export function getExplorableMemories(
  world: GardenWorld,
  careEvents?: GardenCareEvent[]
): ExplorableMemoryItem[] {
  if (!world || !world.earnedFeatureGroups) return [];

  const eventMap = new Map<string, GardenCareEvent>();
  if (careEvents) {
    for (const ev of careEvents) {
      eventMap.set(`${ev.kind}:${ev.id}`, ev);
      eventMap.set(ev.id, ev);
    }
  }

  const rawItems: Array<{
    nodeId: string;
    legacyFeatureId: string;
    semanticKey: string;
    source: GardenMemorySource;
    bounds: BoundingBox2D;
    anchor: Point2D;
    scenicRegion?: ScenicRegion;
    chronologicalTimestamp: string;
    sortTimeMs: number;
    memoryType: "Shared Good Moment" | "Reconnection" | "Important Date";
    botanicalRepresentation:
      | "Shared Moment Growth"
      | "Reconnection Shoot"
      | "Reconnection Blossom"
      | "Important-Date Landmark"
      | "Foundation Memory Leaf"
      | "Foundation Reconnection Pair"
      | "Foundation Date Acorn";
    displayHeadline: string;
    displayDateLabel: string;
    explanatoryCopy: string;
    actionLabel: string;
    actionRoute: string | null;
  }> = [];

  const groupKeys = Object.keys(world.earnedFeatureGroups);

  for (const groupKey of groupKeys) {
    const group = world.earnedFeatureGroups[groupKey];
    if (!group) continue;

    // Find the primary node in world.nodes
    const primaryNodeId = group.nodeIds[0];
    const primaryNode = world.nodes[primaryNodeId];

    // Authoritative event
    const matchedEvent =
      eventMap.get(group.semanticKey) || eventMap.get(group.sourceEvent.id);

    // Derive canonical memory source
    let source: GardenMemorySource;
    if (group.sourceMemory) {
      source = group.sourceMemory;
    } else if (primaryNode?.sourceMemory) {
      source = primaryNode.sourceMemory;
    } else {
      let sourceType: GardenMemorySource["sourceType"];
      if (group.sourceEvent.kind === "reconnection") {
        sourceType = "completed_reconnection";
      } else if (group.sourceEvent.kind === "important_date") {
        sourceType = "important_date";
      } else {
        sourceType = "shared_positive";
      }

      const canonicalHeading = getCanonicalEventHeading(matchedEvent);
      const targetRoute =
        group.sourceEvent.kind === "positive_moment" ||
        group.sourceEvent.kind === "reconnection"
          ? `/event/${group.sourceEvent.id}`
          : null;

      source = {
        sourceType,
        sourceId: group.sourceEvent.id,
        coupleId: "",
        occurredAt:
          matchedEvent?.occurredAt ||
          matchedEvent?.createdAt ||
          group.sourceEvent.authoritativeTimestamp ||
          "",
        canonicalHeading,
        targetRoute,
        privacyClass: "shared_safe_metadata",
      };
    }

    // Determine presentation metadata
    let memoryType: "Shared Good Moment" | "Reconnection" | "Important Date";
    let botanicalRepresentation:
      | "Shared Moment Growth"
      | "Reconnection Shoot"
      | "Reconnection Blossom"
      | "Important-Date Landmark"
      | "Foundation Memory Leaf"
      | "Foundation Reconnection Pair"
      | "Foundation Date Acorn";
    let explanatoryCopy: string;
    let actionLabel: string;

    if (source.sourceType === "completed_reconnection") {
      memoryType = "Reconnection";
      botanicalRepresentation = "Foundation Reconnection Pair";
      explanatoryCopy = "A paired leaf marker grown from a moment of reconnection.";
      actionLabel = "View reconnection";
    } else if (source.sourceType === "important_date") {
      memoryType = "Important Date";
      botanicalRepresentation = "Foundation Date Acorn";
      explanatoryCopy =
        "A warm acorn marker holding an important date in your shared history.";
      actionLabel = "View important date";
    } else {
      memoryType = "Shared Good Moment";
      botanicalRepresentation = "Foundation Memory Leaf";
      explanatoryCopy = "A young oak leaf marking shared care and appreciation.";
      actionLabel = "Open moment";
    }

    const sortTimestamp =
      source.occurredAt ||
      group.sourceEvent.authoritativeTimestamp ||
      matchedEvent?.createdAt ||
      matchedEvent?.occurredAt ||
      "";

    const sortTimeMs = new Date(sortTimestamp).getTime() || 0;

    rawItems.push({
      nodeId: primaryNodeId || `earned:${group.semanticKey}`,
      legacyFeatureId: primaryNode?.legacyFeatureId || primaryNodeId || groupKey,
      semanticKey: group.semanticKey,
      source,
      bounds: { ...group.bounds },
      anchor: { ...group.anchor },
      scenicRegion: primaryNode?.scenicRegion,
      chronologicalTimestamp: sortTimestamp,
      sortTimeMs,
      memoryType,
      botanicalRepresentation,
      displayHeadline: source.canonicalHeading,
      displayDateLabel: formatDate(source.occurredAt),
      explanatoryCopy,
      actionLabel,
      actionRoute: source.targetRoute,
    });
  }

  // Canonical Chronological Sort:
  // 1. sortTimeMs ascending
  // 2. sourceId ascending (deterministic tie-breaker)
  rawItems.sort((a, b) => {
    if (a.sortTimeMs !== b.sortTimeMs) {
      return a.sortTimeMs - b.sortTimeMs;
    }
    return a.source.sourceId.localeCompare(b.source.sourceId);
  });

  const total = rawItems.length;

  return rawItems.map((item, idx) => {
    const memoryNumber = idx + 1;
    const accessibilityLabel = `Memory ${memoryNumber} of ${total}, ${item.memoryType}, ${item.displayHeadline}${
      item.displayDateLabel ? `, recorded ${item.displayDateLabel}` : ""
    }`;

    return {
      index: idx,
      totalMemories: total,
      nodeId: item.nodeId,
      legacyFeatureId: item.legacyFeatureId,
      semanticKey: item.semanticKey,
      source: item.source,
      bounds: item.bounds,
      anchor: item.anchor,
      scenicRegion: item.scenicRegion,
      chronologicalTimestamp: item.chronologicalTimestamp,
      memoryType: item.memoryType,
      botanicalRepresentation: item.botanicalRepresentation,
      displayHeadline: item.displayHeadline,
      displayDateLabel: item.displayDateLabel,
      explanatoryCopy: item.explanatoryCopy,
      actionLabel: item.actionLabel,
      actionRoute: item.actionRoute,
      accessibilityLabel,
    };
  });
}

/**
 * Finds the index of a memory matching a nodeId, legacyFeatureId, or eventId.
 */
export function findMemoryIndexByNodeId(
  memories: ExplorableMemoryItem[],
  nodeIdOrFeatureId: string
): number {
  if (!nodeIdOrFeatureId || !memories.length) return -1;
  return memories.findIndex(
    (m) =>
      m.nodeId === nodeIdOrFeatureId ||
      m.legacyFeatureId === nodeIdOrFeatureId ||
      m.semanticKey === nodeIdOrFeatureId ||
      m.source.sourceId === nodeIdOrFeatureId ||
      m.nodeId.includes(nodeIdOrFeatureId)
  );
}

/**
 * Returns the next memory in sequence, or null if empty.
 */
export function getNextMemory(
  memories: ExplorableMemoryItem[],
  currentIndex: number
): ExplorableMemoryItem | null {
  if (!memories.length) return null;
  const nextIdx = (currentIndex + 1) % memories.length;
  return memories[nextIdx];
}

/**
 * Returns the previous memory in sequence, or null if empty.
 */
export function getPreviousMemory(
  memories: ExplorableMemoryItem[],
  currentIndex: number
): ExplorableMemoryItem | null {
  if (!memories.length) return null;
  const prevIdx = (currentIndex - 1 + memories.length) % memories.length;
  return memories[prevIdx];
}
