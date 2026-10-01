import {
    AuthFrame,
    AuthHeader,
    ErrorBanner,
    PrimaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
    resendSignupOtp,
    sendPhoneOtp,
    verifyPhoneOtp,
    verifySignupOtp,
} from "@/services/authService";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function OtpVerification() {
  const params = useLocalSearchParams<{
    email?: string;
    phone?: string;
    mode?: string;
  }>();
  const email = typeof params.email === "string" ? params.email : "";
  const phone = typeof params.phone === "string" ? params.phone : "";
  const mode = params.mode === "phone" ? "phone" : "signup";
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(47);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((current) => current - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const verify = async () => {
    setError("");
    if (code.length !== 8) {
      setError("Enter the 8-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "phone") await verifyPhoneOtp(phone, code);
      else await verifySignupOtp(email, code);
      router.replace("/(customer)/home");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "That code is not valid. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    try {
      if (mode === "phone") await sendPhoneOtp(phone);
      else await resendSignupOtp(email);
      setSeconds(47);
      setError("");
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "We could not resend the code.",
      );
    }
  };

  return (
    <AuthFrame>
      <AuthHeader title="OTP Verification" />
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>⌁</Text>
      </View>
      <Text style={styles.heading}>Verify Your Mobile Number</Text>
      <Text style={styles.body}>
        We&apos;ve sent an 8-digit code via {mode === "phone" ? "SMS" : "email"}{" "}
        to{`\n`}
        <Text style={styles.strong}>{mode === "phone" ? phone : email}</Text>
      </Text>
      {error ? <ErrorBanner message={error} /> : null}
      <TextInput
        autoFocus
        keyboardType="number-pad"
        maxLength={8}
        onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
        placeholder="• • • • • • • •"
        placeholderTextColor="#C9CBDD"
        style={styles.otpInput}
        value={code}
      />
      <View style={styles.autoPill}>
        <View style={styles.greenDot} />
        <Text style={styles.autoText}>
          Auto-detecting SMS OTP on this device...
        </Text>
      </View>
      <Pressable disabled={seconds > 0} onPress={resend}>
        <Text style={[styles.resend, seconds > 0 && styles.resendDisabled]}>
          {seconds > 0
            ? `Resend code in 00:${String(seconds).padStart(2, "0")}`
            : "Resend verification code"}
        </Text>
      </Pressable>
      <PrimaryButton loading={loading} onPress={verify}>
        Verify &amp; Continue →
      </PrimaryButton>
      <Text style={styles.note}>
        Your verification code expires in 10 minutes.
      </Text>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#E5E6FB",
    borderRadius: 42,
    height: 78,
    justifyContent: "center",
    marginBottom: 14,
    width: 78,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 30,
    color: colors.white,
    fontSize: 32,
    height: 58,
    lineHeight: 58,
    textAlign: "center",
    width: 58,
  },
  heading: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
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
  strong: { color: colors.ink, fontWeight: "800" },
  otpInput: {
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 1.5,
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 12,
    marginHorizontal: 6,
    padding: 13,
    textAlign: "center",
  },
  autoPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 15,
    flexDirection: "row",
    marginTop: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  greenDot: {
    backgroundColor: "#07856A",
    borderRadius: 5,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  autoText: { color: "#176F5C", fontSize: 10, fontWeight: "700" },
  resend: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 18,
    textAlign: "center",
  },
  resendDisabled: { color: colors.muted, fontWeight: "500" },
  note: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 22,
    textAlign: "center",
  },
});
