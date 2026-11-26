/**
 * In-memory draft note transfer between Playful Reframe and Record Moment (Private Reflection).
 * 
 * Ensures private friction descriptions are never exposed in browser URLs, query parameters,
 * browser history, navigation logs, or analytics.
 */

let draftPrivateReflectionNote: string | null = null;

export function setDraftPrivateReflectionNote(note: string | null): void {
  draftPrivateReflectionNote = note && note.trim().length > 0 ? note.trim() : null;
}

export function consumeDraftPrivateReflectionNote(): string | null {
  const note = draftPrivateReflectionNote;
  draftPrivateReflectionNote = null;
  return note;
}

export function peekDraftPrivateReflectionNote(): string | null {
  return draftPrivateReflectionNote;
}
