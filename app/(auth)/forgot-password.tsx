import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    Field,
    PrimaryButton,
    SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { requestPasswordReset } from "@/services/authService";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not send the reset email.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame>
      <AuthHeader eyebrow="MALABE EXPRESS" title="Forgot Password" />
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>↻</Text>
      </View>
      <Text style={styles.heading}>Forgot Your Password?</Text>
      <Text style={styles.body}>
        Don&apos;t worry! Enter your registered email and we&apos;ll send you a
        secure reset link.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}
      {sent ? (
        <View style={styles.success}>
          <Text style={styles.successTitle}>Reset link sent</Text>
          <Text style={styles.successText}>
            Check your inbox and follow the secure link to choose a new
            password.
          </Text>
        </View>
      ) : (
        <>
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            label="Registered Email Address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          <View style={styles.tip}>
            <Text style={styles.tipTitle}>
              Need quick access for active pickup?
            </Text>
            <Text style={styles.tipText}>
              You can log in directly via{" "}
              <Text style={styles.link}>OTP verification</Text> without
              resetting your password.
            </Text>
          </View>
          <PrimaryButton loading={loading} onPress={submit}>
            Send Reset Link →
          </PrimaryButton>
        </>
      )}
      <SecondaryButton onPress={() => router.replace("/(auth)/login")}>
        ← Back to Login
      </SecondaryButton>
      <Text style={styles.help}>
        Having trouble?{" "}
        <Text style={styles.link}>Contact Malabe Express Help Desk</Text>
      </Text>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#E3E5FF",
    borderRadius: 42,
    height: 78,
    justifyContent: "center",
    marginBottom: 12,
    width: 78,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 30,
    color: colors.white,
    fontSize: 28,
    height: 58,
    lineHeight: 58,
    textAlign: "center",
    width: 58,
  },
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  body: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    marginTop: 5,
    textAlign: "center",
  },
  tip: {
    backgroundColor: "#EEF0FF",
    borderRadius: 11,
    marginBottom: 10,
    padding: 13,
  },
  tipTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  tipText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  link: { color: "#07856A", fontWeight: "800" },
  success: {
    backgroundColor: colors.mintSoft,
    borderRadius: 12,
    marginBottom: 14,
    padding: 16,
  },
  successTitle: { color: "#096E58", fontSize: 14, fontWeight: "800" },
  successText: { color: "#286B5D", fontSize: 11, lineHeight: 16, marginTop: 5 },
  help: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 34,
    textAlign: "center",
  },
});
