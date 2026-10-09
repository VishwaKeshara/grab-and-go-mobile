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
              You can return to the login screen and use your password instead.
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
    backgroundColor: "#F3F4F6",
    borderRadius: 42,
    height: 78,
    justifyContent: "center",
    marginBottom: 12,
    width: 78,
  },
  icon: {fontWeight: "400", alignItems: "center",
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
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  body: {fontWeight: "400", color: colors.muted,
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 20,
    marginTop: 5,
    textAlign: "center",
  },
  tip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 11,
    marginBottom: 10,
    padding: 13,
  },
  tipTitle: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  tipText: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 15, marginTop: 4 },
  link: { color: "#15803D", fontWeight: "800" },
  success: {
    backgroundColor: colors.mintSoft,
    borderRadius: 12,
    marginBottom: 14,
    padding: 16,
  },
  successTitle: { color: "#15803D", fontSize: 14, fontWeight: "600" },
  successText: {fontWeight: "400", color: "#15803D", fontSize: 12, lineHeight: 16, marginTop: 5 },
  help: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    marginTop: 34,
    textAlign: "center",
  },
});
