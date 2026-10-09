import React, { useState } from "react";
import { colors } from "@/constants/colors";
import { Image, View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { signIn, getProfile, signOut } from "@/services/authService";

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError("Please enter your Admin Email or Staff ID.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Supabase
      await signIn(identifier, password);
      
      // 2. Fetch User Profile
      const profile = await getProfile();

      // 3. Verify Admin Role
      if (profile && profile.role === "admin") {
        router.replace("/(admin)/admin-dashboard");
      } else {
        await signOut();
        setError("This account does not have administrator access.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundOrb} />
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <View style={styles.brandLogoFrame}>
            <Image
              accessibilityLabel="Grab And Go logo"
              source={require("../../assets/images/grab-and-go-logo.png")}
              style={styles.brandLogo}
            />
          </View>
          <View>
            <Text style={styles.brandText}>GRAB &amp; GO</Text>
            <Text style={styles.brandCaption}>OPERATIONS CONSOLE</Text>
          </View>
        </View>
        <Text style={styles.portalTitle}>ADMIN PORTAL</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>Secure</Text>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin Access</Text>
          <Text style={styles.cardSubtitle}>
            Sign in to manage platform operations and security.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Admin Email / Staff ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email or ID"
              placeholderTextColor="#A0A0B8"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#A0A0B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Text style={styles.eyeBtnText}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.securityInfo}>
            <Text style={styles.securityText}>✓ Secure Session</Text>
            <Text style={styles.securityText}>✓ Encrypted Access</Text>
            <Text style={styles.securityText}>✓ Platform Administration</Text>
          </View>

          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.btnPrimary,
              loading && styles.btnDisabled,
              pressed && !loading && styles.btnPressed,
            ]}
            disabled={loading}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnPrimaryText}>Sign In as Administrator</Text>
            )}
          </Pressable>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.btnSecondaryText}>Back to Main Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    position: "relative",
  },
  backgroundOrb: {
    backgroundColor: "#EAF8F3",
    borderRadius: 160,
    height: 260,
    position: "absolute",
    right: -100,
    top: -80,
    width: 260,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  brandLockup: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 24,
  },
  brandLogoFrame: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#DDEBE5",
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    height: 52,
    justifyContent: "center",
    marginRight: 11,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    width: 52,
  },
  brandText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  brandCaption: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 3,
  },
  brandLogo: { height: 48, width: 48 },
  portalTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1E2030", // dark navy/purple
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: "#E6F7ED",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    color: "#00A859",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#ECEBF4",
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#8A8A9E",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "#FFEBEB",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFD6D6",
  },
  errorText: {
    color: "#D0021B",
    fontSize: 14,
    fontWeight: "500",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E2030",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F8F8FC",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E2030",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8FC",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E2030",
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A4A68",
  },
  securityInfo: {
    marginVertical: 16,
    gap: 6,
  },
  securityText: {
    fontSize: 13,
    color: "#00A859",
    fontWeight: "600",
  },
  btnPrimary: {
    backgroundColor: "#1E2030",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  btnSecondary: {
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#4A4A68",
    fontSize: 15,
    fontWeight: "600",
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    backgroundColor: "#A0A0B8",
  },
});
