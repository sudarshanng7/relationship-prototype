import { ChallengePreviewProvider } from "@/context/ChallengePreviewContext";
import { RepairPreviewProvider } from "@/context/RepairPreviewContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { UserIdentityProvider } from "@/context/UserIdentityContext";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

function RootLayoutNavigator() {
  const { theme, effectiveTheme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const colorScheme = effectiveTheme === "light" ? "light" : "dark";
    document.documentElement.style.backgroundColor = theme.pageBackground;
    document.documentElement.style.colorScheme = colorScheme;
    if (document.body) {
      document.body.style.backgroundColor = theme.pageBackground;
      document.body.style.colorScheme = colorScheme;
    }
  }, [theme.pageBackground, effectiveTheme]);

  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: theme.pageBackground,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="events"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="record-moment"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="event/[id]"
        options={{
          title: "Moment",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="playful-reframe"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="challenge-lifecycle-preview"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="make-challenge-preview"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="shared-list"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="garden"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <UserIdentityProvider>
        <RepairPreviewProvider>
          <ChallengePreviewProvider>
            <RootLayoutNavigator />
          </ChallengePreviewProvider>
        </RepairPreviewProvider>
      </UserIdentityProvider>
    </ThemeProvider>
  );
}
