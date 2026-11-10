import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme as useRNColorScheme } from "react-native";

export type AppearanceMode = "system" | "light" | "dim" | "dark";
export type EffectiveTheme = "light" | "dim" | "dark";

export interface StatusColorSet {
  bg: string;
  border: string;
  text: string;
}

export interface ThemeColors {
  key: EffectiveTheme;
  name: string;
  brandedCaption: string;
  description: string;
  paletteCircles: string[];

  // Surfaces
  pageBackground: string;
  surface: string;
  secondarySurface: string;
  elevatedSurface: string;
  blushSurface: string;

  // Borders
  border: string;
  borderSoft: string;

  // Typography
  primaryText: string;
  secondaryText: string;
  mutedText: string;

  // Primary Actions
  primaryAccent: string;
  primaryActionText: string;
  pressedAccent: string;

  // Navigation
  selectedNavigation: string;
  iconMuted: string;

  // Badges & Avatars
  badgeBackground: string;
  badgeDot: string;
  avatarCircle: string;
  avatarBorder: string;

  // Accessible Mode-Specific Status Colors
  status: {
    open: StatusColorSet;
    inCare: StatusColorSet;
    softening: StatusColorSet;
    reconnecting: StatusColorSet;
    reconnected: StatusColorSet;
    celebration: StatusColorSet;
    positive: StatusColorSet;
    error: StatusColorSet;
    preview: StatusColorSet;
    neutral: StatusColorSet;
  };

  // Backwards compatibility aliases
  text: string;
  textSecondary: string;
  backgroundElement: string;
  backgroundSelected: string;
  background: string;
  privateSurface: string;
  privateBorder: string;
  privateText: string;
  sharedSurface: string;
  sharedBorder: string;
  sharedText: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  surfaceBorder: string;
  savedBoxBg: string;
  savedBoxBorder: string;
  buttonSecondaryBg: string;
  buttonSecondaryBorder: string;
}

export const LIGHT_THEME: ThemeColors = {
  key: "light",
  name: "Light",
  brandedCaption: "Lilac Morning",
  description: "Light, clear, and gently welcoming.",
  paletteCircles: ["#FBF8FC", "#FFFFFF", "#6E416D"],

  pageBackground: "#FBF8FC",
  surface: "#FFFFFF",
  secondarySurface: "#F4EEF7",
  elevatedSurface: "#FFFFFF",
  blushSurface: "#FBEFF7",

  border: "#E8DCE9",
  borderSoft: "#F0E4F1",

  primaryText: "#3D3040",
  secondaryText: "#6D6072",
  mutedText: "#8E7E94",

  primaryAccent: "#6E416D",
  primaryActionText: "#FFFFFF",
  pressedAccent: "#593258",

  selectedNavigation: "#EFE4F1",
  iconMuted: "#7B6A80",

  badgeBackground: "#F4EEF7",
  badgeDot: "#6E416D",
  avatarCircle: "#F1DDF0",
  avatarBorder: "#DFBFDE",

  status: {
    open: { bg: "#FDF3EB", border: "#F5DEC9", text: "#8D4E26" },
    inCare: { bg: "#F4EEF7", border: "#E2D3E4", text: "#6E416D" },
    softening: { bg: "#F4EEF7", border: "#E2D3E4", text: "#6E416D" },
    reconnecting: { bg: "#EAF3F9", border: "#C6DFF1", text: "#1C5B83" },
    reconnected: { bg: "#EBF5F0", border: "#C9E7D8", text: "#256345" },
    celebration: { bg: "#FDF0EB", border: "#F4D9CE", text: "#9E442F" },
    positive: { bg: "#FDF0EB", border: "#F4D9CE", text: "#9E442F" },
    error: { bg: "#FDF0F0", border: "#FECDCA", text: "#B42318" },
    preview: { bg: "#F3EDF6", border: "#E2D3E4", text: "#593B63" },
    neutral: { bg: "#F4EEF7", border: "#E8DCE9", text: "#5D4D63" },
  },

  // Backwards compatibility aliases
  text: "#3D3040",
  textSecondary: "#6D6072",
  backgroundElement: "#F4EEF7",
  backgroundSelected: "#EFE4F1",
  background: "#FBF8FC",
  privateSurface: "#F4EEF7",
  privateBorder: "#E8DCE9",
  privateText: "#3D3040",
  sharedSurface: "#FBEFF7",
  sharedBorder: "#E8DCE9",
  sharedText: "#6E416D",
  accent: "#6E416D",
  accentPressed: "#593258",
  accentText: "#FFFFFF",
  surfaceBorder: "#E8DCE9",
  savedBoxBg: "#F4EEF7",
  savedBoxBorder: "#E8DCE9",
  buttonSecondaryBg: "#F4EEF7",
  buttonSecondaryBorder: "#E8DCE9",
};

export const DIM_THEME: ThemeColors = {
  key: "dim",
  name: "Dim",
  brandedCaption: "Violet Garden",
  description: "A softer, lower-contrast evening atmosphere.",
  paletteCircles: ["#39333D", "#45404A", "#D4A9D4"],

  pageBackground: "#39333D",
  surface: "#45404A",
  secondarySurface: "#514958",
  elevatedSurface: "#5A5060",
  blushSurface: "#544658",

  border: "#6D6172",
  borderSoft: "#5D5362",

  primaryText: "#FAF5FB",
  secondaryText: "#D8CBDC",
  mutedText: "#B8A9BD",

  primaryAccent: "#D4A9D4",
  primaryActionText: "#2E2531",
  pressedAccent: "#C294C3",

  selectedNavigation: "#514958",
  iconMuted: "#B8A9BD",

  badgeBackground: "#514958",
  badgeDot: "#D4A9D4",
  avatarCircle: "#584B5F",
  avatarBorder: "#73637C",

  status: {
    open: { bg: "#4D3B2F", border: "#70503B", text: "#FDDCC2" },
    inCare: { bg: "#4D3E53", border: "#715D7A", text: "#ECCEEF" },
    softening: { bg: "#4D3E53", border: "#715D7A", text: "#ECCEEF" },
    reconnecting: { bg: "#2F4452", border: "#46677D", text: "#C7E5F8" },
    reconnected: { bg: "#2E4738", border: "#436A53", text: "#C3EBD3" },
    celebration: { bg: "#543632", border: "#7A4C46", text: "#FED2C7" },
    positive: { bg: "#543632", border: "#7A4C46", text: "#FED2C7" },
    error: { bg: "#552C2D", border: "#7B3F40", text: "#FECDC9" },
    preview: { bg: "#483D4F", border: "#6A5A74", text: "#DECDE3" },
    neutral: { bg: "#514958", border: "#6D6172", text: "#D8CBDC" },
  },

  // Backwards compatibility aliases
  text: "#FAF5FB",
  textSecondary: "#D8CBDC",
  backgroundElement: "#514958",
  backgroundSelected: "#5A5060",
  background: "#39333D",
  privateSurface: "#514958",
  privateBorder: "#6D6172",
  privateText: "#FAF5FB",
  sharedSurface: "#544658",
  sharedBorder: "#6D6172",
  sharedText: "#D4A9D4",
  accent: "#D4A9D4",
  accentPressed: "#C294C3",
  accentText: "#2E2531",
  surfaceBorder: "#6D6172",
  savedBoxBg: "#514958",
  savedBoxBorder: "#6D6172",
  buttonSecondaryBg: "#514958",
  buttonSecondaryBorder: "#6D6172",
};

export const DARK_THEME: ThemeColors = {
  key: "dark",
  name: "Dark",
  brandedCaption: "Plum Night",
  description: "Deep, quiet colours for darker surroundings.",
  paletteCircles: ["#18131A", "#241C27", "#D8AFD8"],

  pageBackground: "#18131A",
  surface: "#241C27",
  secondarySurface: "#302536",
  elevatedSurface: "#392D3F",
  blushSurface: "#36203A",

  border: "#4A3A50",
  borderSoft: "#3A2C40",

  primaryText: "#FBF6FC",
  secondaryText: "#D4C7D8",
  mutedText: "#AFA0B4",

  primaryAccent: "#D8AFD8",
  primaryActionText: "#251C28",
  pressedAccent: "#C796C8",

  selectedNavigation: "#302536",
  iconMuted: "#AFA0B4",

  badgeBackground: "#302536",
  badgeDot: "#D8AFD8",
  avatarCircle: "#3B2B43",
  avatarBorder: "#563E62",

  status: {
    open: { bg: "#3A281C", border: "#5E3D28", text: "#FBD6BA" },
    inCare: { bg: "#38243E", border: "#573A63", text: "#E8C5EC" },
    softening: { bg: "#38243E", border: "#573A63", text: "#E8C5EC" },
    reconnecting: { bg: "#1A3241", border: "#2A4F66", text: "#B9DFF6" },
    reconnected: { bg: "#183424", border: "#27533A", text: "#B4E6C7" },
    celebration: { bg: "#3E221E", border: "#62342D", text: "#FCC9BC" },
    positive: { bg: "#3E221E", border: "#62342D", text: "#FCC9BC" },
    error: { bg: "#411B1D", border: "#652729", text: "#FDBFBA" },
    preview: { bg: "#332539", border: "#513B5B", text: "#D8C7DD" },
    neutral: { bg: "#302536", border: "#4A3A50", text: "#D4C7D8" },
  },

  // Backwards compatibility aliases
  text: "#FBF6FC",
  textSecondary: "#D4C7D8",
  backgroundElement: "#302536",
  backgroundSelected: "#392D3F",
  background: "#18131A",
  privateSurface: "#302536",
  privateBorder: "#4A3A50",
  privateText: "#FBF6FC",
  sharedSurface: "#36203A",
  sharedBorder: "#4A3A50",
  sharedText: "#D8AFD8",
  accent: "#D8AFD8",
  accentPressed: "#C796C8",
  accentText: "#251C28",
  surfaceBorder: "#4A3A50",
  savedBoxBg: "#302536",
  savedBoxBorder: "#4A3A50",
  buttonSecondaryBg: "#302536",
  buttonSecondaryBorder: "#4A3A50",
};

export const THEMES: Record<EffectiveTheme, ThemeColors> = {
  light: LIGHT_THEME,
  dim: DIM_THEME,
  dark: DARK_THEME,
};

export interface AppearanceChoice {
  key: AppearanceMode;
  name: string;
  brandedCaption: string;
  description: string;
  paletteCircles: string[];
  isRecommended?: boolean;
}

export const APPEARANCE_CHOICES: AppearanceChoice[] = [
  {
    key: "system",
    name: "System",
    brandedCaption: "Use device setting",
    description: "Automatically follows your phone or browser.",
    paletteCircles: ["#FBF8FC", "#39333D", "#18131A"],
    isRecommended: true,
  },
  {
    key: "light",
    name: "Light",
    brandedCaption: "Lilac Morning",
    description: "Light, clear, and gently welcoming.",
    paletteCircles: ["#FBF8FC", "#FFFFFF", "#6E416D"],
  },
  {
    key: "dim",
    name: "Dim",
    brandedCaption: "Violet Garden",
    description: "A softer, lower-contrast evening atmosphere.",
    paletteCircles: ["#39333D", "#45404A", "#D4A9D4"],
  },
  {
    key: "dark",
    name: "Dark",
    brandedCaption: "Plum Night",
    description: "Deep, quiet colours for darker surroundings.",
    paletteCircles: ["#18131A", "#241C27", "#D8AFD8"],
  },
];

const STORAGE_KEY = "@purple_garden_appearance_mode";

export interface ThemeContextType {
  mode: AppearanceMode;
  effectiveTheme: EffectiveTheme;
  theme: ThemeColors;
  setMode: (mode: AppearanceMode) => void;
}

const defaultContextValue: ThemeContextType = {
  mode: "system",
  effectiveTheme: "light",
  theme: LIGHT_THEME,
  setMode: () => {},
};

export const ThemeContext = createContext<ThemeContextType>(defaultContextValue);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rnColorScheme = useRNColorScheme();
  const [deviceScheme, setDeviceScheme] = useState<"light" | "dark">(
    rnColorScheme === "dark" ? "dark" : "light"
  );
  const [mode, setModeState] = useState<AppearanceMode>("system");

  // Keep deviceScheme in sync with OS changes
  useEffect(() => {
    const current = Appearance.getColorScheme();
    if (current === "dark" || current === "light") {
      setDeviceScheme(current);
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setDeviceScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, []);

  // Sync with RN hook
  useEffect(() => {
    if (rnColorScheme === "dark" || rnColorScheme === "light") {
      setDeviceScheme(rnColorScheme);
    }
  }, [rnColorScheme]);

  // Load persisted preference safely
  useEffect(() => {
    let isMounted = true;
    async function loadPreference() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          isMounted &&
          saved &&
          (saved === "system" ||
            saved === "light" ||
            saved === "dim" ||
            saved === "dark")
        ) {
          setModeState(saved as AppearanceMode);
        }
      } catch (e) {
        // Safe fallback in-session
      }
    }
    loadPreference();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback((newMode: AppearanceMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {
      // In-session fallback if storage is restricted
    });
  }, []);

  const effectiveTheme: EffectiveTheme = useMemo(() => {
    if (mode === "system") {
      return deviceScheme === "dark" ? "dark" : "light";
    }
    return mode;
  }, [mode, deviceScheme]);

  const theme: ThemeColors = useMemo(() => {
    return THEMES[effectiveTheme] || LIGHT_THEME;
  }, [effectiveTheme]);

  const value = useMemo(
    () => ({
      mode,
      effectiveTheme,
      theme,
      setMode,
    }),
    [mode, effectiveTheme, theme, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return defaultContextValue;
  }
  return context;
}
