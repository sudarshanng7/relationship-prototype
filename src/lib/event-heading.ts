/**
 * Canonical helper for formatting event categories and resolving moment headings
 * across Events (Our Space), Event Detail (/event/[id]), and Our Garden Story.
 *
 * AUTHORITATIVE RULE:
 * - The moment heading is derived from `relationship_events.category` (e.g. "quality_time",
 *   "phones_screens", or custom category text like "Sunday breakfast").
 * - `relationship_events.shared_topic` is strictly the "SHARED CONTEXT" / note body text,
 *   and must NEVER be used as the moment heading or title.
 * - `couple_important_dates.label` supplies the title for important dates.
 */

/**
 * Transforms a stored category value into a clean, human-readable display label.
 * - Replaces underscores with spaces and title-cases words for snake_case identifiers (e.g. "phones_screens" -> "Phones Screens").
 * - Preserves natural phrase formatting for custom titles (e.g. "Sunday breakfast", "Phones and attention").
 * - Safely handles null, undefined, and non-string inputs.
 */
export function formatCategory(category?: string | null): string {
  if (!category || typeof category !== "string") {
    return "";
  }
  const trimmed = category.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("_")) {
    return trimmed
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  // For natural phrases without underscores, ensure initial capitalization while preserving user casing
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Resolves the canonical visible heading for any moment or important date across
 * Events list, Event Detail, and Garden Story with consistent fallbacks.
 */
export function getCanonicalEventHeading(event?: {
  kind?: string | null;
  event_type?: string | null;
  category?: string | null;
  label?: string | null;
  displayTitle?: string | null;
} | null): string {
  if (!event) return "";

  // 1. Important dates: label
  if (event.kind === "important_date" || event.label) {
    const raw = event.label || event.displayTitle;
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
    return "An important date";
  }

  // 2. Relationship events: authoritative heading is category
  const rawHeading = event.category || event.displayTitle;
  if (typeof rawHeading === "string" && rawHeading.trim()) {
    const formatted = formatCategory(rawHeading);
    if (formatted) return formatted;
  }

  // 3. Fallback chain for blank/missing category
  const isPositive =
    event.kind === "positive_moment" || event.event_type === "positive";
  return isPositive ? "A shared good moment" : "A shared moment";
}
