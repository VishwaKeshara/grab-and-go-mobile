import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    PrimaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { listPickupHubs, signUp } from "@/services/authService";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Hub = { id: string; name: string; address: string };

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+94 ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedHubName, setSelectedHubName] = useState("Malabe Bazaar Hub");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listPickupHubs()
      .then(setHubs)
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    setError("");
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError(
        "Add your name, a valid email, and a password with at least 8 characters.",
      );
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({
        fullName,
        phone,
        email,
        password,
        preferredPickupHubId: displayHubs.find(
          (hub) => hub.name === selectedHubName,
        )?.id,
      });
      if (result.session) {
        router.replace("/(customer)/home");
      } else {
        router.push({
          pathname: "/(auth)/otp-verification",
          params: { email, mode: "signup" },
        });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not create your account.",
      );
    } finally {
      setLoading(false);
    }
  };

  const displayHubs =
    hubs.length > 0
      ? hubs
      : [
          {
            id: "",
            name: "Malabe Bazaar Hub",
            address: "Kaduwela Road (Opposite SLIIT Junction)",
          },
          {
            id: "",
            name: "Pittugala Station Hub",
            address: "Near Chandrika Kumaratunga Mawatha",
          },
        ];

  return (
    <AuthFrame>
      <AuthHeader title="Sign Up" />
      <Text style={styles.body}>
        Save time on daily groceries with instant queue-free local pickup.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}
      <Field
        label="Full Name"
        onChangeText={setFullName}
        placeholder="e.g. Dinithi Perera"
        value={fullName}
      />
      <Field
        autoCapitalize="none"
        keyboardType="phone-pad"
        label="Mobile Phone Number"
        onChangeText={setPhone}
        value={phone}
      />
      <Text style={styles.helper}>
        ♧ Used for SMS QR Pickup Pass &amp; Verification
      </Text>
      <Field
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        label="Email Address"
        onChangeText={setEmail}
        placeholder="e.g. dinithi@gmail.com"
        value={email}
      />
      <Text style={styles.helper}>
        Used for monthly e-receipts and order VAT tax invoices
      </Text>
      <Field
        label="Create Password"
        onChangeText={setPassword}
        placeholder="Min. 8 characters"
        secureTextEntry
        value={password}
      />
      <Text style={styles.sectionLabel}>Preferred Daily Pickup Hub</Text>
      {displayHubs.map((pickupHub) => {
        const selected = selectedHubName === pickupHub.name;
        return (
          <Pressable
            key={pickupHub.name}
            onPress={() => setSelectedHubName(pickupHub.name)}
            style={[styles.hubRow, selected && styles.hubSelected]}
          >
            <View style={styles.hubIcon}>
              <Text>⌂</Text>
            </View>
            <View style={styles.hubCopy}>
              <Text style={styles.hubName}>{pickupHub.name}</Text>
              <Text style={styles.hubAddress}>{pickupHub.address}</Text>
            </View>
            <Text style={[styles.check, selected && styles.checkSelected]}>
              {selected ? "✓" : ""}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        onPress={() => setAcceptedTerms((checked) => !checked)}
        style={styles.termsRow}
      >
        <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
          {acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.terms}>
          I agree to the <Text style={styles.link}>Terms of Service</Text> &amp;{" "}
          <Text style={styles.link}>Privacy Policy</Text>.
        </Text>
      </Pressable>
      <PrimaryButton loading={loading} onPress={submit}>
        Create Account &amp; Get OTP →
      </PrimaryButton>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already a member? </Text>
        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.link}>Log In</Text>
        </Pressable>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  helper: {
    color: colors.muted,
    fontSize: 10,
    marginBottom: 12,
    marginTop: -7,
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 2,
  },
  hubRow: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderColor: "transparent",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    padding: 10,
  },
  hubSelected: { backgroundColor: "#DDE3FF", borderColor: "#B6B9F1" },
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
  check: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 10,
    color: colors.white,
    height: 20,
    textAlign: "center",
    width: 20,
  },
  checkSelected: { backgroundColor: colors.ink, lineHeight: 20 },
  termsRow: { alignItems: "center", flexDirection: "row", marginVertical: 14 },
  checkbox: {
    backgroundColor: "#DCE2FF",
    borderRadius: 4,
    height: 17,
    marginRight: 8,
    width: 17,
  },
  checkboxChecked: { backgroundColor: colors.ink },
  checkboxMark: { color: colors.mint, fontSize: 12, fontWeight: "900", lineHeight: 17, textAlign: "center" },
  terms: { color: colors.muted, flex: 1, fontSize: 10, lineHeight: 15 },
  link: { color: "#07856A", fontWeight: "800" },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerText: { color: colors.muted, fontSize: 11 },
});
