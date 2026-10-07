import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  Field,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import {
  signIn,
  signInWithApple,
  signInWithGoogle,
  getProfile,
} from "@/services/authService";
import { getShopByProfileId, clearLocalStaffSession } from "@/services/shopService";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const isValid = email.trim().length > 0 && password.length > 0;

  const handleAuth = async () => {
  setError("");
  setLoading(true);
  try {
    // Clear any staff session first
    await clearLocalStaffSession();
    // Sign in with email & password
    await signIn(email.trim(), password);

    // Verify signed‑in user via Supabase auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw userError ?? new Error("Could not verify signed‑in user.");
    }

    // ---------- Shop intent recovery ----------
    if (user.user_metadata?.registration_intent === "shop") {
      const pending = user.user_metadata?.pending_shop_registration;
      const validPending =
        pending &&
        typeof pending.shopName === "string" && !!pending.shopName.trim() &&
        typeof pending.shopAddress === "string" && !!pending.shopAddress.trim() &&
        typeof pending.shopPhone === "string" && !!pending.shopPhone.trim() &&
        typeof pending.pickupCounter === "string" && !!pending.pickupCounter.trim() &&
        typeof pending.prepMinutes === "number" &&
        Number.isInteger(pending.prepMinutes) &&
        pending.prepMinutes >= 1 && pending.prepMinutes <= 180;

      if (!validPending) {
        setError(
          "Your saved shop registration details are incomplete. Please return to Register Shop."
        );
        return;
      }

      // Check if shop is already completed for this user
      const currentProfile = await getProfile();
      if (currentProfile?.role === "shop") {
        const existingShop = await getShopByProfileId(currentProfile.id);
        if (!existingShop) {
          setError(
            "Your shop account exists, but the shop record could not be found."
          );
          return;
        }
        // Clear onboarding metadata and route to dashboard
        await supabase.auth.updateUser({
          data: { registration_intent: null, pending_shop_registration: null },
        });
        router.replace("/(shop)/shop-dashboard" as any);
        return;
      }

      // Register shop via RPC
      const { error: rpcError } = await supabase.rpc("register_shop", {
        p_shop_name: pending.shopName.trim(),
        p_address: pending.shopAddress.trim(),
        p_phone: pending.shopPhone.trim(),
        p_pickup_counter: pending.pickupCounter.trim(),
        p_prep_minutes: pending.prepMinutes,
      });

      if (rpcError) {
        if (!rpcError.message.toLowerCase().includes("already owns a shop")) {
          setError(rpcError.message);
          return;
        }
        // else fall through to verification below
      }

      // Verify database state before clearing metadata
      const freshProfile = await getProfile();
      if (freshProfile?.role !== "shop") {
        setError(
          "Your shop account could not be verified. Please sign out and try again."
        );
        return;
      }
      const shop = await getShopByProfileId(freshProfile.id);
      if (!shop) {
        setError("Shop not found after registration.");
        return;
      }
      // Clear onboarding metadata and route to dashboard
      await supabase.auth.updateUser({
        data: { registration_intent: null, pending_shop_registration: null },
      });
      router.replace("/(shop)/shop-dashboard" as any);
      return;
    }

    // ---------- Normal role routing ----------
    const profile = await getProfile();
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error("Could not fetch profile.");
    }
    if (profile.role === "customer") {
      router.replace("/(customer)/home");
    } else if (profile.role === "shop") {
      const shop = await getShopByProfileId(profile.id);
      if (!shop) {
        router.replace("/(shop)/shop-dashboard");
      } else {
        router.replace("/(shop)/shop-dashboard");
      }
    } else if (profile.role === "admin") {
      router.replace("/(admin)/admin-dashboard");
    } else {
      await supabase.auth.signOut();
      throw new Error("Unknown account role.");
    }
  } catch (submitError) {
    setError(
      submitError instanceof Error
        ? submitError.message
        : "We could not sign you in. Please try again."
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
      const profile = await getProfile();

      if (profile?.role === "customer") {
        router.replace("/(customer)/home");
      } else {
        await supabase.auth.signOut();
        throw new Error("Google sign-in is currently available for customer accounts.");
      }
    } catch (googleError) {
      setError(
        googleError instanceof Error
          ? googleError.message
          : "Google sign-in could not be completed."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const continueWithApple = async () => {
    setError("");
    setAppleLoading(true);

    try {
      await signInWithApple();
      const profile = await getProfile();

      if (profile?.role === "customer") {
        router.replace("/(customer)/home");
      } else {
        await supabase.auth.signOut();
        throw new Error("Apple sign-in is currently available for customer accounts.");
      }
    } catch (appleError) {
      setError(
        appleError instanceof Error
          ? appleError.message
          : "Apple sign-in could not be completed."
      );
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <AuthFrame>
      <AuthHeader
        title="Welcome"
        eyebrow="GRAB & GO"
        subtitle="Sign in to your account"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.formContainer}>
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

        <Pressable
          disabled={!isValid || loading}
          onPress={handleAuth}
          style={({ pressed }) => [
            styles.submitBtn,
            !isValid && styles.submitBtnDisabled,
            isValid && !loading && pressed && styles.submitBtnPressed
          ]}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={colors.ink} size="small" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Signing in...</Text>
            </View>
          ) : (
            <Text style={[styles.submitBtnText, !isValid && styles.submitBtnTextDisabled]}>
              Sign In
            </Text>
          )}
        </Pressable>

        <View style={styles.signupRow}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text style={styles.link}>Sign Up</Text>
          </Pressable>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.footerText}>New merchant? </Text>
          <Pressable onPress={() => router.push("/(auth)/shop-register")}>
            <Text style={styles.link}>Register Shop</Text>
          </Pressable>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.footerText}>Shop Staff? </Text>
          <Pressable onPress={() => router.push("/(auth)/staff-login")}>
            <Text style={styles.link}>Start Shift</Text>
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>
        <View style={styles.socialRow}>
          <SocialButton
            icon="google"
            loading={googleLoading}
            onPress={continueWithGoogle}
            title="Google"
          />
          <SocialButton
            icon="apple"
            loading={appleLoading}
            onPress={continueWithApple}
            title="Apple"
          />
        </View>
      </View>
    </AuthFrame>
  );
}

function SocialButton({
  icon,
  loading,
  onPress,
  title,
}: {
  icon: "apple" | "google";
  loading: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        pressed && styles.socialButtonPressed,
        loading && styles.socialButtonDisabled,
      ]}
    >
      <View style={styles.socialIcon}>
        {loading ? (
          <ActivityIndicator color={colors.ink} size="small" />
        ) : (
          <FontAwesome color={colors.ink} name={icon} size={18} />
        )}
      </View>
      <Text style={styles.socialButtonText}>
        {loading ? "Connecting" : `Continue with ${title}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    marginBottom: 10,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 10,
    elevation: 3,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 52,
    shadowColor: colors.mint,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    flexDirection: "row",
  },
  submitBtnDisabled: {
    backgroundColor: "#E0E0EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnPressed: {
    opacity: 0.8,
  },
  submitBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  submitBtnTextDisabled: {
    color: "#9A98AA",
  },
  forgotLink: {
    alignSelf: "flex-end",
    color: "#07856A",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
    marginTop: -4,
  },
  signupRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  footerText: { color: colors.muted, fontSize: 12 },
  link: { color: "#07856A", fontSize: 12, fontWeight: "800" },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 26,
    marginBottom: 16,
  },
  dividerLine: { backgroundColor: colors.line, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  socialRow: { gap: 10 },
  socialButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  socialButtonPressed: {
    backgroundColor: "#F0F1FC",
    transform: [{ scale: 0.99 }],
  },
  socialButtonDisabled: { opacity: 0.6 },
  socialIcon: { alignItems: "center", width: 28 },
  socialButtonText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 5,
  },
});
