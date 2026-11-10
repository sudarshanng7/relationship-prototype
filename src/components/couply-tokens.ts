export const tokens = {
  colors: {
    pageBackground: "#F4EFF7",
    surface: "#FFFFFF",
    surfaceMuted: "#F3ECF6",
    surfaceLilac: "#ECE3F2",
    surfaceBlush: "#F7EEF5",
    border: "#DECDE3",
    borderSoft: "#EAE0EE",
    text: "#2D1F33",
    textSecondary: "#5D4D63",
    textMuted: "#837389",
    plum: "#5E336A",
    plumPressed: "#4A2554",
    accentSage: "#42684E",
    accentSageSoft: "#EAF1EC",
    accentSageBorder: "#CFDFD5",
    positiveSoft: "#EBF5F0",
    positiveBorder: "#C9E7D8",
    positiveText: "#2A6A4E",
    celebrationSoft: "#FDF0EB",
    celebrationBorder: "#F4D9CE",
    celebrationText: "#8B412D",
    warningSoft: "#FFF6ED",
    warningBorder: "#FEDF89",
    warningText: "#B54708",
    openSoft: "#FDF3EB",
    openBorder: "#F5DEC9",
    openText: "#8D4E26",
    softeningSoft: "#ECE3F2",
    softeningBorder: "#DECDE3",
    softeningText: "#5E336A",
    reconnectedSoft: "#EBF5F0",
    reconnectedBorder: "#C9E7D8",
    reconnectedText: "#2A6A4E",
    previewSoft: "#F2ECF5",
    previewBorder: "#DECDE3",
    previewText: "#5E336A",
    dangerText: "#B42318",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    page: 20,
  },
  radii: {
    small: 12,
    card: 16,
    large: 20,
    pill: 999,
  },
  typeScale: {
    overline: 11,
    caption: 12.5,
    body: 13.5,
    bodyLarge: 14.5,
    sectionTitle: 16,
    screenTitle: 28,
  },
  layout: {
    /** Outer application shell for authenticated screens and bottom navigation alignment on web */
    appShell: 560,

    /** Standard readable content width for long-form reading and cards */
    readableContent: 520,

    /** Focused width for authentication, onboarding, and compact input forms */
    focusedForm: 480,

    /** Standard modal and bottom sheet dialog constraint */
    modal: 460,

    /** Compact alert / confirmation dialog constraint */
    dialogCompact: 380,

    /** Standard page horizontal paddings */
    pagePaddingMobile: 16,
    pagePaddingStandard: 20,

    /** Temporary backwards-compatibility alias. Remove after legacy screens migrate. */
    maxContentWidth: 520,
  },
} as const;

export type CouplyTokens = typeof tokens;

export function getThemedTokens(theme: import("@/context/ThemeContext").ThemeColors) {
  return {
    ...tokens,
    colors: {
      pageBackground: theme.pageBackground,
      surface: theme.surface,
      surfaceMuted: theme.secondarySurface,
      surfaceLilac: theme.secondarySurface,
      surfaceBlush: theme.blushSurface,
      border: theme.border,
      borderSoft: theme.borderSoft,
      text: theme.primaryText,
      textSecondary: theme.secondaryText,
      textMuted: theme.mutedText,
      plum: theme.primaryAccent,
      plumPressed: theme.pressedAccent,
      accentSage: theme.status.reconnected.text,
      accentSageSoft: theme.status.reconnected.bg,
      accentSageBorder: theme.status.reconnected.border,
      positiveSoft: theme.status.celebration.bg,
      positiveBorder: theme.status.celebration.border,
      positiveText: theme.status.celebration.text,
      celebrationSoft: theme.status.celebration.bg,
      celebrationBorder: theme.status.celebration.border,
      celebrationText: theme.status.celebration.text,
      warningSoft: theme.status.open.bg,
      warningBorder: theme.status.open.border,
      warningText: theme.status.open.text,
      openSoft: theme.status.open.bg,
      openBorder: theme.status.open.border,
      openText: theme.status.open.text,
      softeningSoft: theme.status.inCare.bg,
      softeningBorder: theme.status.inCare.border,
      softeningText: theme.status.inCare.text,
      reconnectedSoft: theme.status.reconnected.bg,
      reconnectedBorder: theme.status.reconnected.border,
      reconnectedText: theme.status.reconnected.text,
      previewSoft: theme.status.preview.bg,
      previewBorder: theme.status.preview.border,
      previewText: theme.status.preview.text,
      dangerText: theme.status.error.text,
    },
  };
}
