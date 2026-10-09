import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    PrimaryButton,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors, accentOnDark } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { getProfile, updateProfile } from "@/services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const profilePhotoKey = (profileId: string) => `profile-photo:${profileId}`;

export default function Profile() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hubName, setHubName] = useState("Malabe Bazaar Hub");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active || !profile) return;
        setProfileId(profile.id);
        setFullName(profile.full_name);
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? "");
        setHubName(
          profile.preferred_pickup_hub_id
            ? "Preferred pickup hub"
            : "Malabe Bazaar Hub",
        );
        AsyncStorage.getItem(profilePhotoKey(profile.id)).then((uri) => {
          if (active && uri) setPhotoUri(uri);
        });
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

  const changePhoto = async () => {
    if (!profileId) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo access in your device settings to choose a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets[0]?.uri;
      if (!uri) return;

      await AsyncStorage.setItem(profilePhotoKey(profileId), uri);
      setPhotoUri(uri);
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? photoError.message
          : "We could not update your profile picture.",
      );
    }
  };

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
      <AuthHeader
        backRoute="/(customer)/home"
        eyebrow="PROFILE"
        title="Grab & Go"
      />
      <View style={styles.profileHero}>
        <Pressable
          accessibilityLabel="Change profile picture"
          accessibilityRole="button"
          onPress={() => void changePhoto()}
          style={styles.avatarButton}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {fullName.slice(0, 2).toUpperCase() || "DP"}
              </Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraIcon}>✎</Text>
          </View>
        </Pressable>
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
        <Pressable onPress={() => void changePhoto()} style={styles.changePhoto}>
          <Text style={styles.changePhotoText}>Change{"\n"}photo</Text>
        </Pressable>
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
      <SecondaryButton onPress={() => router.replace("/(customer)/home")}>
        ← Back to Home
      </SecondaryButton>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  profileHero: {
    alignItems: "center",
    backgroundColor: colors.night,
    borderColor: "#374151",
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    marginBottom: 20,
    padding: 14,
  },
  avatarButton: {
    alignItems: "center",
    height: 64,
    justifyContent: "center",
    position: "relative",
    width: 64,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderColor: colors.white,
    borderRadius: 32,
    borderWidth: 3,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  avatarImage: {
    borderColor: colors.white,
    borderRadius: 32,
    borderWidth: 3,
    height: 64,
    width: 64,
  },
  avatarText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderColor: colors.night,
    borderRadius: 11,
    borderWidth: 2,
    bottom: -1,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: -1,
    width: 22,
  },
  cameraIcon: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  heroCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  heroName: { color: colors.white, fontSize: 16, fontWeight: "600" },
  heroEmail: {fontWeight: "400", color: "#D1D5DB", fontSize: 12, marginTop: 3 },
  activePill: { alignItems: "center", flexDirection: "row", marginTop: 8 },
  activeDot: {
    backgroundColor: "#15803D",
    borderRadius: 4,
    height: 8,
    marginRight: 5,
    width: 8,
  },
  activeText: { color: accentOnDark, fontSize: 12, fontWeight: "500" },
  changePhoto: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 9,
  },
  changePhotoText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 12,
    textAlign: "center",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 11,
    marginTop: 5,
  },
  readOnly: {
    backgroundColor: "#F3F4F6",
    borderRadius: 11,
    marginBottom: 15,
    padding: 13,
  },
  readOnlyLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  readOnlyValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  readOnlyHint: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 },
  hubCard: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
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
  hubName: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  hubAddress: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: colors.ink, fontSize: 21 },
  saved: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  loading: {fontWeight: "400", color: colors.muted, fontSize: 12, textAlign: "center" },
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
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
  },
  link: { color: "#15803D", fontSize: 12, fontWeight: "600" },
  danger: { color: colors.coral, fontSize: 12, fontWeight: "600" },
  separator: { color: colors.muted, marginHorizontal: 12 },
});
