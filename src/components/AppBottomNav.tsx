import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomNavTab = "rhythm" | "our_space" | "moments" | "settings";

export interface BottomNavThemeColors {
  surface?: string;
  border?: string;
  accent?: string;
  iconMuted?: string;
  selectedNavigation?: string;
  secondaryText?: string;
}

export interface AppBottomNavProps {
  activeTab: BottomNavTab;
  isRootTab?: boolean;
  themeColors?: BottomNavThemeColors;
  onPreviewPress?: (label: string) => void;
}

interface NavItemConfig {
  key: BottomNavTab;
  label: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: "rhythm", label: "My Rhythm" },
  { key: "our_space", label: "Our Space" },
  { key: "moments", label: "Moments" },
  { key: "settings", label: "Settings" },
];

function NavIcon({
  itemKey,
  color,
}: {
  itemKey: BottomNavTab;
  color: string;
}) {
  if (itemKey === "rhythm") {
    return (
      <View style={navIconStyles.container}>
        <Text style={[navIconStyles.glyph, { color }]}>♡</Text>
      </View>
    );
  }
  if (itemKey === "our_space") {
    return (
      <View style={navIconStyles.container}>
        <View style={navIconStyles.peopleWrapper}>
          <View
            style={[navIconStyles.personHead, { borderColor: color, left: 1 }]}
          />
          <View
            style={[navIconStyles.personBody, { borderColor: color, left: 0 }]}
          />
          <View
            style={[navIconStyles.personHead, { borderColor: color, right: 1 }]}
          />
          <View
            style={[navIconStyles.personBody, { borderColor: color, right: 0 }]}
          />
        </View>
      </View>
    );
  }
  if (itemKey === "moments") {
    return (
      <View style={navIconStyles.container}>
        <View style={[navIconStyles.momentsFrame, { borderColor: color }]}>
          <View
            style={[navIconStyles.momentsDot, { backgroundColor: color }]}
          />
          <View
            style={[navIconStyles.momentsLine, { backgroundColor: color }]}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={navIconStyles.container}>
      <Text style={[navIconStyles.glyph, { color }]}>⚙︎</Text>
    </View>
  );
}

export function AppBottomNav({
  activeTab,
  isRootTab = true,
  themeColors,
  onPreviewPress,
}: AppBottomNavProps) {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // When keyboard is visible, hide navigation pill cleanly to avoid obstructing inputs
  if (isKeyboardVisible) {
    return null;
  }

  const isLight = mode === "light" || (!mode && theme.key === "light");
  const isDim = mode === "dim";

  // Translucent theme-aware background pill
  const translucentBg = isLight
    ? "rgba(255, 255, 255, 0.90)"
    : isDim
    ? "rgba(38, 30, 48, 0.90)"
    : "rgba(26, 20, 32, 0.92)";

  const colors = {
    surface: translucentBg,
    border: theme.border,
    accent: theme.primaryAccent,
    iconMuted: theme.iconMuted,
    selectedNavigation: isLight
      ? "rgba(110, 65, 109, 0.12)"
      : "rgba(255, 255, 255, 0.12)",
    secondaryText: theme.secondaryText,
    ...themeColors,
  };

  const handleItemPress = (key: BottomNavTab, label: string) => {
    if (key === "rhythm") {
      if (activeTab !== "rhythm" || !isRootTab) {
        router.replace("/home");
      } else {
        onPreviewPress?.("My Rhythm: Current active home space.");
      }
      return;
    }
    if (key === "moments") {
      if (activeTab !== "moments") {
        router.replace("/events");
      }
      return;
    }
    if (key === "settings") {
      if (activeTab !== "settings") {
        router.replace("/settings" as any);
      }
      return;
    }
    if (key === "our_space") {
      router.replace("/events?scope=ours");
      return;
    }
  };

  // Safe area bottom inset calculation ensuring floating separation from home indicator
  const bottomOffset = Math.max(12, insets.bottom + 8);

  return (
    <View
      style={[
        styles.floatingContainer,
        {
          bottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.floatingPill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeTab;

          return (
            <Pressable
              key={item.key}
              style={[
                styles.navItem,
                isActive && {
                  backgroundColor: colors.selectedNavigation,
                },
              ]}
              onPress={() => handleItemPress(item.key, item.label)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${item.label}${
                isActive ? ", active tab" : ""
              }`}
            >
              <NavIcon
                itemKey={item.key}
                color={isActive ? colors.accent : colors.iconMuted}
              />
              <Text
                style={[
                  styles.navItemLabel,
                  {
                    color: isActive ? colors.accent : colors.secondaryText,
                    fontWeight: isActive ? "600" : "500",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const navIconStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  glyph: {
    fontSize: 17,
    lineHeight: 19,
    textAlign: "center",
  },
  peopleWrapper: {
    width: 20,
    height: 16,
    position: "relative",
  },
  personHead: {
    position: "absolute",
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.3,
  },
  personBody: {
    position: "absolute",
    bottom: 0,
    width: 10,
    height: 7,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 1.3,
    borderBottomWidth: 0,
  },
  momentsFrame: {
    width: 16,
    height: 16,
    borderWidth: 1.3,
    borderRadius: 3,
    position: "relative",
  },
  momentsDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  momentsLine: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    height: 1.2,
    borderRadius: 0.6,
  },
});

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  floatingPill: {
    width: "100%",
    maxWidth: Math.min(tokens.layout.appShell, 480),
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 48,
    borderRadius: 20,
  },
  navItemLabel: {
    fontSize: tokens.typeScale.caption,
    marginTop: 2,
  },
});
