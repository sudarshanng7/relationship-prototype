import { ChallengePreviewProvider } from "@/context/ChallengePreviewContext";
import { RepairPreviewProvider } from "@/context/RepairPreviewContext";
import { UserIdentityProvider } from "@/context/UserIdentityContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <UserIdentityProvider>
      <RepairPreviewProvider>
        <ChallengePreviewProvider>
          <Stack>
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
      </Stack>
        </ChallengePreviewProvider>
      </RepairPreviewProvider>
    </UserIdentityProvider>
  );
}
