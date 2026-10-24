import { RepairPreviewProvider } from "@/context/RepairPreviewContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <RepairPreviewProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: "Relationship OS",
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
            title: "Profile",
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
            title: "Record a Moment",
          }}
        />
        <Stack.Screen
          name="event/[id]"
          options={{
            title: "Moment",
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            title: "Getting started",
            headerBackVisible: false,
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
      </Stack>
    </RepairPreviewProvider>
  );
}
