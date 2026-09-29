import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    PrimaryButton,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { sendPhoneOtp, signIn, signInWithGoogle } from "@/services/authService";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Login() {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("+94 ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "phone") {
        await sendPhoneOtp(phone);
        router.push({
          pathname: "/(auth)/otp-verification",
          params: { mode: "phone", phone },
        });
      } else {
        await signIn(email, password);
        router.replace("/(customer)/home");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/(customer)/home");
    } catch (googleError) {
      setError(
        googleError instanceof Error
          ? googleError.message
          : "Google sign-in could not be completed.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthFrame>
      <AuthHeader title="Login" />
      <Text style={styles.heading}>Welcome back!</Text>
      <Text style={styles.body}>
        Enter your registered details to access express pre-orders and pickup
        passes.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.segmented}>
        <Pressable
          onPress={() => setMode("phone")}
          style={[styles.segment, mode === "phone" && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "phone" && styles.segmentTextActive,
            ]}
          >
            Phone Number
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("email")}
          style={[styles.segment, mode === "email" && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "email" && styles.segmentTextActive,
            ]}
          >
            Email Address
          </Text>
        </Pressable>
      </View>
      {mode === "phone" ? (
        <>
          <Field
            autoCapitalize="none"
            keyboardType="phone-pad"
            label="Mobile Number"
            onChangeText={setPhone}
            value={phone}
          />
          <Pressable onPress={() => setMode("email")}>
            <Text style={styles.forgotLink}>
              Use email and password instead
            </Text>
          </Pressable>
          <PrimaryButton loading={loading} onPress={submit}>
            Send Login OTP →
          </PrimaryButton>
        </>
      ) : (
        <>
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email Address"
            onChangeText={setEmail}
            value={email}
          />
          <Field
            label="Password"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={styles.forgotLink}>Forgot Password?</Text>
          </Pressable>
          <PrimaryButton loading={loading} onPress={submit}>
            Log In →
          </PrimaryButton>
        </>
      )}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.socialRow}>
        <SecondaryButton
          onPress={continueWithGoogle}
        >
          {googleLoading ? "Connecting..." : "Google"}
        </SecondaryButton>
        <SecondaryButton
          onPress={() =>
            setError(
              "Apple sign-in will be enabled after the provider is configured in Supabase.",
            )
          }
        >
          Apple
        </SecondaryButton>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/signup")}>
          <Text style={styles.link}>Sign Up</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Login as Admin </Text>
        <Pressable onPress={() => router.push("/(admin)/admin-login")}>
          <Text style={styles.link}>Admin Login</Text>
        </Pressable>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  body: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 19,
    marginTop: 6,
  },
  segmented: {
    backgroundColor: "#E7E8F9",
    borderRadius: 10,
    flexDirection: "row",
    marginBottom: 20,
    padding: 4,
  },
  segment: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  segmentTextActive: { color: colors.white },
  forgotLink: {
    alignSelf: "flex-end",
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: -4,
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 22,
  },
  dividerLine: { backgroundColor: colors.line, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  socialRow: { flexDirection: "row", gap: 9 },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: { color: colors.muted, fontSize: 11 },
  link: { color: "#07856A", fontSize: 11, fontWeight: "800" },
});
