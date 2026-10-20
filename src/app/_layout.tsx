import { Stack } from "expo-router";

export default function RootLayout() {
  return (
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
          title: "Relationship Events",
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
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          title: "Getting started",
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
