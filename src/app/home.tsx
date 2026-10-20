import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsAuthorized(false);

      async function checkUser() {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          router.replace("/");
          return;
        }

        setIsAuthorized(true);
      }

      void checkUser();

      return () => {
        active = false;
      };
    }, [router]),
  );

  if (!isAuthorized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6E416D" />
        <Text>Loading your space...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>RELATIONSHIP OS</Text>
      <Text style={styles.title}>Your space</Text>
      <Text style={styles.subtitle}>
        A place to remember meaningful moments and understand your relationship
        over time.
      </Text>

      <Pressable
        style={styles.primaryCard}
        onPress={() => router.push("/record-moment")}
        accessibilityRole="button"
      >
        <Text style={styles.primaryTitle}>Record a moment</Text>
        <Text style={styles.primaryDescription}>
          Something good or something that felt difficult.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push("/events")}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>Moments</Text>
        <Text style={styles.cardDescription}>
          Revisit moments you are allowed to see.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push("/profile")}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>Profile & partner connection</Text>
        <Text style={styles.cardDescription}>
          Manage your profile and relationship space.
        </Text>
      </Pressable>

      <Text style={styles.footer}>
        Private reflections stay private. You decide what belongs in Ours.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: "#FBF7FC",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  eyebrow: {
    color: "#6E416D",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#6D6072",
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryCard: {
    backgroundColor: "#6E416D",
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
  },
  primaryTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  primaryDescription: {
    color: "#F3EAF3",
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DCE9",
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 8,
  },
  cardDescription: {
    color: "#6D6072",
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    marginTop: 24,
    textAlign: "center",
    color: "#7E6D82",
    fontSize: 13,
    lineHeight: 20,
  },
});
