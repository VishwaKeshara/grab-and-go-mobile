import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  Field,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { verifyStaffPin, clearLocalStaffSession, setLocalStaffSession } from "@/services/shopService";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function StaffLogin() {
  const [shopCode, setShopCode] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = shopCode.trim().length > 0 && staffId.trim().length > 0 && pin.length === 4;

  const handleAuth = async () => {
    setError("");
    setLoading(true);

    try {
      // Clear cross-contamination
      await supabase.auth.signOut();
      await clearLocalStaffSession();

      const staff = await verifyStaffPin(
        staffId.trim(),
        pin,
        shopCode.trim()
      );

      if (!staff || !staff.token) {
        throw new Error("Invalid Staff ID or PIN.");
      }

      await setLocalStaffSession(staff.token);

      router.replace("/(shop)/new-orders");
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

  return (
    <AuthFrame>
      <AuthHeader
        title="Staff Login"
        eyebrow="GRAB & GO"
        subtitle="Start your shift"
      />
      
      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.roleContainer}>
        <View style={{ marginTop: 14 }}>
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            label="Shop Code"
            onChangeText={setShopCode}
            value={shopCode}
            placeholder="Enter Shop Code"
          />
        </View>

        <View style={{ marginTop: 14 }}>
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            label="Staff ID"
            onChangeText={setStaffId}
            value={staffId}
            placeholder="Enter Staff ID"
          />
        </View>

        <Text style={styles.fieldLabel}>4-digit PIN</Text>
        <View style={styles.pinRow}>
          <TextInput
            style={styles.pinInput}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={!showPin}
            value={pin}
            onChangeText={setPin}
          />
          <Pressable onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
            <FontAwesome color={colors.muted} name={showPin ? "eye-slash" : "eye"} size={20} />
          </Pressable>
        </View>

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
              Start Shift
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.footerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back to Login</Text>
        </Pressable>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 14,
  },
  roleContainer: {
    flex: 1,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 10,
    elevation: 3,
    justifyContent: "center",
    marginTop: 24,
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
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pinInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    letterSpacing: 4,
  },
  eyeBtn: {
    padding: 14,
  },
  footerRow: {
    alignItems: "center",
    marginTop: 40,
  },
  link: { color: "#07856A", fontSize: 12, fontWeight: "800" },
});

