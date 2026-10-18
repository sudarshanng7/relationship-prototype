import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  themeColors?: BottomNavThemeColors;
  onSettingsPress?: () => void;
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

const DEFAULT_THEME: Required<BottomNavThemeColors> = {
  surface: "#FFFFFF",
  border: "#E8DCE9",
  accent: "#6E416D",
  iconMuted: "#7E6F86",
  selectedNavigation: "#F1E8F3",
  secondaryText: "#6D6072",
};

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
  themeColors,
  onSettingsPress,
  onPreviewPress,
}: AppBottomNavProps) {
  const router = useRouter();

  const colors = {
    ...DEFAULT_THEME,
    ...themeColors,
  };

  const handleItemPress = (key: BottomNavTab, label: string) => {
    if (key === "rhythm") {
      if (activeTab !== "rhythm") {
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
      if (onSettingsPress) {
        onSettingsPress();
      } else {
        onPreviewPress?.("Settings: Navigation tab preview only.");
      }
      return;
    }
    if (key === "our_space") {
      onPreviewPress?.("Our Space: Navigation tab preview only.");
      return;
    }
  };

  return (
    <View
      style={[
        styles.fixedBottomNav,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.bottomNavInner}>
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
  fixedBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomNavInner: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 48,
    borderRadius: 14,
  },
  navItemLabel: {
    fontSize: 12.5,
    marginTop: 3,
  },
});
