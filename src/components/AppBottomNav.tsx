import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type NavTab = "home" | "our_space" | "moments" | "settings";

interface AppBottomNavProps {
  activeTab: NavTab;
}

const TABS: { key: NavTab; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "our_space", label: "Our Space", icon: "♡" },
  { key: "moments", label: "Moments", icon: "▤" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export function AppBottomNav({ activeTab }: AppBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function navigate(tab: NavTab) {
    if (tab === activeTab) return;

    switch (tab) {
      case "home":
        router.replace("/home");
        break;

      case "our_space":
        router.replace({
          pathname: "/events",
          params: { scope: "ours" },
        });
        break;

      case "moments":
        router.replace({
          pathname: "/events",
          params: { scope: "all" },
        });
        break;

      case "settings":
        router.replace("/profile");
        break;
    }
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.items}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() => navigate(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              style={[styles.item, selected && styles.selectedItem]}
            >
              <Text style={[styles.icon, selected && styles.selectedText]}>
                {tab.icon}
              </Text>

              <Text style={[styles.label, selected && styles.selectedText]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8DCE9",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  items: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 5,
  },
  selectedItem: {
    backgroundColor: "#F1E8F3",
  },
  icon: {
    fontSize: 23,
    color: "#7E6F86",
    marginBottom: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6D6072",
  },
  selectedText: {
    color: "#6E416D",
    fontWeight: "700",
  },
});
