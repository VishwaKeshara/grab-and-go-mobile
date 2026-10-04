import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    PrimaryButton,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { getProfile, updateProfile } from "@/services/authService";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Profile() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hubName, setHubName] = useState("Malabe Bazaar Hub");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active || !profile) return;
        setFullName(profile.full_name);
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? "");
        setHubName(
          profile.preferred_pickup_hub_id
            ? "Preferred pickup hub"
            : "Malabe Bazaar Hub",
        );
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load your profile.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({ fullName, phone });
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <AuthFrame>
      <AuthHeader eyebrow="PROFILE" title="Grab & Go" />
      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {fullName.slice(0, 2).toUpperCase() || "DP"}
          </Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroName}>{fullName || "Your profile"}</Text>
          <Text style={styles.heroEmail}>
            {email || "Connect your account to edit details"}
          </Text>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Verified commuter</Text>
          </View>
        </View>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Text style={styles.loading}>Loading your profile...</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Account details</Text>
          <Field
            label="Full Name"
            onChangeText={setFullName}
            value={fullName}
          />
          <Field
            keyboardType="phone-pad"
            label="Mobile Phone Number"
            onChangeText={setPhone}
            value={phone}
          />
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyLabel}>Email Address</Text>
            <Text style={styles.readOnlyValue}>{email || "Not available"}</Text>
            <Text style={styles.readOnlyHint}>
              Managed securely by Supabase Auth
            </Text>
          </View>
          <Text style={styles.sectionTitle}>Pickup preference</Text>
          <View style={styles.hubCard}>
            <View style={styles.hubIcon}>
              <Text>⌂</Text>
            </View>
            <View style={styles.hubCopy}>
              <Text style={styles.hubName}>{hubName}</Text>
              <Text style={styles.hubAddress}>
                Kaduwela Road • Opposite SLIIT Junction
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          {saved ? (
            <Text style={styles.saved}>✓ Profile saved successfully</Text>
          ) : null}
          <PrimaryButton loading={saving} onPress={save}>
            Save Profile →
          </PrimaryButton>
        </>
      )}
      <View style={styles.quickLinks}>
            <Pressable onPress={() => router.push("/(customer)/notifications")}>
              <Text style={styles.link}>Notifications</Text>
            </Pressable>
            <Text style={styles.separator}>•</Text>
            <Pressable
              onPress={() => router.push("/(customer)/help-support")}
              style={styles.helpLink}
            >
              <Text style={styles.link}>Help &amp; Support</Text>
              <Text style={styles.helpIcon}>?</Text>
            </Pressable>
            <Text style={styles.separator}>•</Text>
            <Pressable onPress={signOut}>
              <Text style={styles.danger}>Sign out</Text>
            </Pressable>
          </View>
      <SecondaryButton onPress={() => router.back()}>← Back</SecondaryButton>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  profileHero: {
    alignItems: "center",
    backgroundColor: "#E7E9FC",
    borderRadius: 15,
    flexDirection: "row",
    marginBottom: 20,
    padding: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 29,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  avatarText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  heroCopy: { flex: 1, marginLeft: 12 },
  heroName: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  heroEmail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  activePill: { alignItems: "center", flexDirection: "row", marginTop: 8 },
  activeDot: {
    backgroundColor: "#07856A",
    borderRadius: 4,
    height: 8,
    marginRight: 5,
    width: 8,
  },
  activeText: { color: "#07856A", fontSize: 9, fontWeight: "800" },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 11,
    marginTop: 5,
  },
  readOnly: {
    backgroundColor: "#F1F2FB",
    borderRadius: 11,
    marginBottom: 15,
    padding: 13,
  },
  readOnlyLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  readOnlyValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  readOnlyHint: { color: colors.muted, fontSize: 9, marginTop: 4 },
  hubCard: {
    alignItems: "center",
    backgroundColor: "#E9EAFB",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 5,
    padding: 11,
  },
  hubIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  hubCopy: { flex: 1, marginLeft: 10 },
  hubName: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  hubAddress: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chevron: { color: colors.ink, fontSize: 21 },
  saved: {
    color: "#07856A",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },
  loading: { color: colors.muted, fontSize: 12, textAlign: "center" },
  quickLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 18,
  },
  helpLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  helpIcon: {
    color: "#07856A",
    fontSize: 11,
    fontWeight: "900",
  },
  link: { color: "#07856A", fontSize: 11, fontWeight: "800" },
  danger: { color: colors.coral, fontSize: 11, fontWeight: "800" },
  separator: { color: colors.muted, marginHorizontal: 12 },
});
