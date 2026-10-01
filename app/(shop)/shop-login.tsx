/**
 * Shop Login screen — Merchant / Staff terminal authentication.
 *
 * ─── PIN VERIFICATION STATUS ────────────────────────────────────────────────
 * Currently LOCAL VALIDATION ONLY (4 digits entered + non-empty Staff ID).
 * The handleLogin() function simulates an async call and navigates to the
 * dashboard. No real Supabase verification is connected.
 *
 * TODO: Replace the simulated delay inside handleLogin() with:
 *   await shopService.verifyStaffPin(staffId, pin, shopId)
 * once the staff PIN schema is decided and migration 005 is applied.
 * See services/shopService.ts → verifyStaffPin for schema options.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── SHOP PROFILE STATUS ────────────────────────────────────────────────────
 * The merchant card (shop name, counter, hub, terminal) shows MOCK_SHOP data.
 * TODO: Replace with getShopProfile() from shopService once migration 005 is
 * applied and the authenticated session returns a shop profile.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { colors } from "@/constants/colors";
import type { ShopRole, ShiftType } from "@/types/shop";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
// Visual development data only. Replace with getShopProfile() once
// migration 005 (shops table) is confirmed applied to the live project.
const MOCK_SHOP = {
  name: "Pasan Groceries",
  counterNumber: "02",
  hubName: "Malabe Hub",
  terminalCode: "MLB-B02-POS",
} as const;
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: ReadonlyArray<{ role: ShopRole; label: string }> = [
  { role: "clerk", label: "Counter Clerk" },
  { role: "manager", label: "Owner / Manager" },
];

const SHIFTS: ReadonlyArray<{ type: ShiftType; label: string }> = [
  { type: "morning", label: "Morning Shift" },
  { type: "evening", label: "Evening Rush" },
];

const PIN_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["bio", "0", "del"],
];

// ─────────────────────────────────────────────────────────────────────────────

export default function ShopLogin() {
  const [selectedRole, setSelectedRole] = useState<ShopRole>("clerk");
  const [selectedShift, setSelectedShift] = useState<ShiftType>("evening");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const appendDigit = (digit: string) => {
    setError("");
    if (pin.length < 4) setPin((prev) => prev + digit);
  };

  const deleteDigit = () => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const handleBiometric = () => {
    setError("Biometric login is not yet available on this terminal.");
  };

  /**
   * Login handler — LOCAL VALIDATION ONLY.
   *
   * TODO: Replace the simulated delay with a real call to:
   *   await shopService.verifyStaffPin(staffId.trim(), pin, shopId)
   * once the staff PIN schema is defined and migration 005 is applied.
   *
   * Validation rules (current):
   *   • staffId must not be empty
   *   • pin must be exactly 4 digits
   */
  const handleLogin = async () => {
    setError("");

    if (!staffId.trim()) {
      setError("Please enter your Staff ID or mobile number.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter all 4 PIN digits to continue.");
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual Supabase PIN verification.
      // await shopService.verifyStaffPin(staffId.trim(), pin, MOCK_SHOP.id);
      // Current behaviour: simulate async call and navigate on success.
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      router.replace("/(shop)/shop-dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isLoginEnabled =
    pin.length === 4 && staffId.trim().length > 0 && !loading;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {/* ── Scrollable top section ─────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Portal header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkGlyph}>▣</Text>
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>GRAB & GO</Text>
                <Text style={styles.brandTitle}>MERCHANT PORTAL</Text>
              </View>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v2.1</Text>
              </View>
            </View>
            <View style={styles.hubStatusRow}>
              <View style={styles.hubLiveDot} />
              <Text style={styles.hubStatusText}>MALABE HUB ACTIVE</Text>
            </View>
          </View>

          {/* Merchant card */}
          <View style={styles.merchantCard}>
            <View style={styles.merchantIconWrap}>
              <FontAwesome
                color={colors.ink}
                name="shopping-basket"
                size={20}
              />
            </View>
            <View style={styles.merchantCopy}>
              <Text style={styles.merchantName}>{MOCK_SHOP.name}</Text>
              <Text style={styles.merchantSub}>
                Counter #{MOCK_SHOP.counterNumber} · {MOCK_SHOP.hubName}
              </Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>ONLINE</Text>
            </View>
          </View>

          {/* Role selector */}
          <Text style={styles.fieldLabel}>Your Role</Text>
          <View style={styles.segmented}>
            {ROLES.map(({ role, label }) => (
              <Pressable
                key={role}
                onPress={() => setSelectedRole(role)}
                style={[
                  styles.segment,
                  selectedRole === role && styles.segmentRoleActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selectedRole === role && styles.segmentActiveText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Hardware row */}
          <View style={styles.hardwareRow}>
            <FontAwesome
              color={colors.mint}
              name="desktop"
              size={13}
              style={styles.hardwareIcon}
            />
            <Text style={styles.terminalCode}>{MOCK_SHOP.terminalCode}</Text>
            <View style={styles.readyPill}>
              <View style={styles.readyDot} />
              <Text style={styles.readyText}>READY</Text>
            </View>
          </View>

          {/* Shift selector */}
          <Text style={styles.fieldLabel}>Active Shift</Text>
          <View style={styles.segmented}>
            {SHIFTS.map(({ type, label }) => (
              <Pressable
                key={type}
                onPress={() => setSelectedShift(type)}
                style={[
                  styles.segment,
                  selectedShift === type && styles.segmentShiftActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selectedShift === type && styles.segmentShiftText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Staff ID field */}
          <Text style={styles.fieldLabel}>Staff ID</Text>
          <View style={styles.inputWrap}>
            <FontAwesome
              color={colors.mint}
              name="user"
              size={14}
              style={styles.inputIcon}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onChangeText={(t) => {
                setError("");
                setStaffId(t);
              }}
              placeholder="Staff ID or mobile number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.input}
              value={staffId}
            />
          </View>

          {/* PIN dots */}
          <Text style={styles.pinLabel}>ENTER YOUR 4-DIGIT PIN</Text>
          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
              />
            ))}
          </View>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <FontAwesome
                color={colors.coral}
                name="exclamation-circle"
                size={12}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Fixed bottom: keypad + login button ───────────── */}
        <View style={styles.keypadSection}>
          <PinKeypad
            disabled={loading}
            onBiometric={handleBiometric}
            onDelete={deleteDigit}
            onDigit={appendDigit}
          />

          <Pressable
            disabled={!isLoginEnabled}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              !isLoginEnabled && styles.loginButtonDisabled,
              pressed && isLoginEnabled && styles.loginButtonPressed,
            ]}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Signing in…" : "Sign In to Shift →"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── PIN Keypad components ───────────────────────────────────────────────────

type PinKeyVariant = "number" | "bio" | "delete";

interface PinKeyProps {
  label: string;
  variant: PinKeyVariant;
  onPress: () => void;
  disabled: boolean;
}

function PinKey({ label, variant, onPress, disabled }: PinKeyProps) {
  const isBio = variant === "bio";
  const isDelete = variant === "delete";
  const isDisabled = disabled || isBio;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pinKey,
        isBio && styles.pinKeyBio,
        pressed && !isDisabled && styles.pinKeyPressed,
        isDisabled && styles.pinKeyDisabled,
      ]}
    >
      {isBio ? (
        <FontAwesome color="rgba(255,255,255,0.3)" name="eye" size={18} />
      ) : isDelete ? (
        <FontAwesome color={colors.white} name="arrow-left" size={15} />
      ) : (
        <Text style={styles.pinKeyText}>{label}</Text>
      )}
    </Pressable>
  );
}

interface PinKeypadProps {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onBiometric: () => void;
  disabled: boolean;
}

function PinKeypad({ onDigit, onDelete, onBiometric, disabled }: PinKeypadProps) {
  return (
    <View style={styles.keypad}>
      {PIN_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keypadRow}>
          {row.map((key) => {
            if (key === "del") {
              return (
                <PinKey
                  key={key}
                  disabled={disabled}
                  label={key}
                  variant="delete"
                  onPress={onDelete}
                />
              );
            }
            if (key === "bio") {
              return (
                <PinKey
                  key={key}
                  disabled={disabled}
                  label={key}
                  variant="bio"
                  onPress={onBiometric}
                />
              );
            }
            return (
              <PinKey
                key={key}
                disabled={disabled}
                label={key}
                variant="number"
                onPress={() => onDigit(key)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: colors.night, flex: 1 },
  scrollContent: {
    paddingBottom: 16,
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  // ── Header ──
  header: { marginBottom: 20 },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  brandMarkGlyph: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  brandCopy: { flex: 1, marginLeft: 10 },
  brandEyebrow: {
    color: colors.mint,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  brandTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 1,
  },
  versionBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  versionText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "700",
  },
  hubStatusRow: { alignItems: "center", flexDirection: "row" },
  hubLiveDot: {
    backgroundColor: colors.mint,
    borderRadius: 5,
    height: 8,
    marginRight: 6,
    shadowColor: colors.mint,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    width: 8,
  },
  hubStatusText: {
    color: colors.mint,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
  },

  // ── Merchant card ──
  merchantCard: {
    alignItems: "center",
    backgroundColor: colors.nightSoft,
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 18,
    padding: 14,
  },
  merchantIconWrap: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  merchantCopy: { flex: 1, marginLeft: 12 },
  merchantName: { color: colors.white, fontSize: 14, fontWeight: "900" },
  merchantSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 3,
  },
  onlinePill: {
    alignItems: "center",
    backgroundColor: "rgba(85,229,186,0.15)",
    borderRadius: 10,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  onlineDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 7,
    marginRight: 4,
    width: 7,
  },
  onlineText: {
    color: colors.mint,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // ── Segmented control (shared) ──
  segmented: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    flexDirection: "row",
    marginBottom: 16,
    padding: 3,
  },
  segment: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 9,
  },
  segmentText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
  },
  segmentRoleActive: { backgroundColor: colors.mint },
  segmentShiftActive: { backgroundColor: colors.amber },
  segmentActiveText: { color: colors.ink },
  segmentShiftText: { color: colors.ink },

  // ── Hardware row ──
  hardwareRow: {
    alignItems: "center",
    backgroundColor: colors.nightSoft,
    borderRadius: 10,
    flexDirection: "row",
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hardwareIcon: { marginRight: 8 },
  terminalCode: {
    color: colors.white,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  readyPill: {
    alignItems: "center",
    backgroundColor: "rgba(85,229,186,0.15)",
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyDot: {
    backgroundColor: colors.mint,
    borderRadius: 3,
    height: 6,
    marginRight: 4,
    width: 6,
  },
  readyText: {
    color: colors.mint,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  // ── Field labels ──
  fieldLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // ── Staff ID input ──
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.nightSoft,
    borderRadius: 11,
    flexDirection: "row",
    marginBottom: 22,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    color: colors.white,
    flex: 1,
    fontSize: 13,
    paddingVertical: 12,
  },

  // ── PIN dots ──
  pinLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 16,
    textAlign: "center",
  },
  pinDots: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  pinDot: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    height: 18,
    width: 18,
  },
  pinDotFilled: {
    backgroundColor: colors.mint,
    shadowColor: colors.mint,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },

  // ── Error banner ──
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(239,126,105,0.12)",
    borderRadius: 10,
    flexDirection: "row",
    marginTop: 14,
    padding: 12,
  },
  errorText: {
    color: colors.coral,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },

  // ── Keypad section (fixed bottom) ──
  keypadSection: {
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  keypad: { gap: 8, marginBottom: 14 },
  keypadRow: { flexDirection: "row", gap: 8 },
  pinKey: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
  },
  pinKeyPressed: { backgroundColor: "rgba(85,229,186,0.22)" },
  pinKeyBio: { backgroundColor: "rgba(255,255,255,0.04)" },
  pinKeyDisabled: { opacity: 0.35 },
  pinKeyText: { color: colors.white, fontSize: 20, fontWeight: "500" },

  // ── Login button ──
  loginButton: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 13,
    justifyContent: "center",
    minHeight: 52,
  },
  loginButtonPressed: { opacity: 0.85 },
  loginButtonDisabled: { backgroundColor: "rgba(85,229,186,0.22)" },
  loginButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
