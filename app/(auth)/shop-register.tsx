// Shop Register screen with metadata‑based flow
import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  Field,
  PrimaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { signUpShopOwner } from "@/services/authService";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ShopRegister() {
  const [hasSession, setHasSession] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("+94 ");

  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("+94 ");
  const [pickupCounter, setPickupCounter] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("25");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate real auth state on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setHasSession(!!user);
      setAuthLoading(false);
    })();
  }, []);

  const submit = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      // Validate shop fields (always required)
      if (!shopName.trim()) {
        setError("Shop name is required.");
        return;
      }
      if (!shopAddress.trim()) {
        setError("Shop address is required.");
        return;
      }
      if (!shopPhone.trim()) {
        setError("Shop phone number is required.");
        return;
      }
      if (!pickupCounter.trim()) {
        setError("Pickup counter is required.");
        return;
      }
      const prep = Number(prepMinutes);
      if (!Number.isInteger(prep) || prep < 1 || prep > 180) {
        setError("Preparation time must be a whole number between 1 and 180 minutes.");
        return;
      }

      // Check current authenticated user
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        // Anonymous merchant – validate owner fields then sign up
        if (!ownerName.trim()) { setError("Owner full name is required."); return; }
        if (!ownerEmail.trim()) { setError("Owner email address is required."); return; }
        if (ownerPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (ownerPassword !== confirmPassword) { setError("Passwords do not match."); return; }

        const result = await signUpShopOwner({
          fullName: ownerName.trim(),
          phone: ownerPhone.trim(),
          email: ownerEmail.trim(),
          password: ownerPassword,
          shopName: shopName.trim(),
          shopAddress: shopAddress.trim(),
          shopPhone: shopPhone.trim(),
          pickupCounter: pickupCounter.trim(),
          prepMinutes: prep,
        });
        // Supabase may send email verification – no session returned
        if (!result.session) {
          setError("Account created. Please verify your email, then sign in and continue your shop setup.");
          return;
        }
        setHasSession(true);
      }

      // At this point we have an active session (newly created or existing)
      const { error: rpcError } = await supabase.rpc("register_shop", {
        p_shop_name: shopName.trim(),
        p_address: shopAddress.trim(),
        p_phone: shopPhone.trim(),
        p_pickup_counter: pickupCounter.trim(),
        p_prep_minutes: prep,
      });

      if (rpcError) {
        if (rpcError.message.toLowerCase().includes("already owns a shop")) {
          router.replace("/(shop)/shop-dashboard" as any);
          return;
        }
        throw rpcError;
      }

      router.replace("/(shop)/shop-dashboard" as any);
    } catch (e: any) {
      const status = e?.status;
      const message = e instanceof Error ? e.message : String(e ?? "");
      if (status === 429 || message.includes("429") || message.toLowerCase().includes("rate limit")) {
        setError("Too many signup attempts. Please wait a little and try again.");
      } else {
        setError(message || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame>
      <AuthHeader title="Register Shop" />
      <Text style={styles.body}>Partner with us to grow your business and reach more local customers.</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Owner details – only for unauthenticated users */}
      {!authLoading && !hasSession && (
        <>
          <Text style={styles.sectionTitle}>Owner Details</Text>
          <Field label="Owner Full Name" value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Jane Doe" />
          <Field label="Owner Email Address" value={ownerEmail} onChangeText={setOwnerEmail} placeholder="e.g. jane@freshmart.lk" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Owner Phone Number" value={ownerPhone} onChangeText={setOwnerPhone} placeholder="+94 77 123 4567" keyboardType="phone-pad" />
          <Field label="Owner Password" value={ownerPassword} onChangeText={setOwnerPassword} placeholder="At least 8 characters" secureTextEntry />
          <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry />
        </>
      )}

      {/* Shop details – always visible */}
      <Text style={styles.sectionTitle}>Shop Details</Text>
      <Field label="Shop Name" value={shopName} onChangeText={setShopName} placeholder="e.g. Fresh Mart" />
      <Field label="Shop Address" value={shopAddress} onChangeText={setShopAddress} placeholder="123 Main St, Colombo" />
      <Field label="Shop Phone Number" value={shopPhone} onChangeText={setShopPhone} placeholder="+94 11 234 5678" keyboardType="phone-pad" />
      <Field label="Pickup Counter / Location" value={pickupCounter} onChangeText={setPickupCounter} placeholder="e.g. Counter 1, Main Entrance" />
      <Field label="Default Preparation Time (Minutes)" value={prepMinutes} onChangeText={setPrepMinutes} placeholder="e.g. 25" keyboardType="number-pad" />

      <PrimaryButton onPress={submit} loading={loading}>Register Shop</PrimaryButton>

      {/* Link to login for existing accounts */}
      {!hasSession && (
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already registered? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.link}>Log in</Text>
          </Pressable>
        </View>
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  body: {fontWeight: "400", fontSize: 15,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 16,
    marginBottom: 12,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  loginText: {fontWeight: "400", color: colors.muted,
    fontSize: 16,
  },
  link: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
});
