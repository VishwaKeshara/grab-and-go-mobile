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
import { getShopByProfileId, verifyStaffPin, listShops } from "@/services/shopService";
import { Shop } from "@/types/shop";
import { FontAwesome } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Login() {
  const params = useLocalSearchParams<{
    accountType?: "customer" | "shop";
    shopMode?: "owner" | "staff";
  }>();

  const [accountType, setAccountType] =
    useState<"customer" | "shop">(params.accountType || "customer");

  const [shopRole, setShopRole] =
    useState<"owner" | "staff">(params.shopMode || "owner");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (accountType === "shop" && shopRole === "staff") {
      listShops().then(data => {
        setShops(data);
        if (data.length > 0) {
          setSelectedShopId(prev => prev || data[0].id);
        }
      }).catch(err => {
        console.error(err);
        setError("Could not load shop list for staff login.");
      });
    }
  }, [accountType, shopRole]);

  const isCustomerValid = email.trim().length > 0 && password.length > 0;
  const isOwnerValid = email.trim().length > 0 && password.length > 0;
  const isStaffValid = selectedShopId !== "" && staffId.trim().length > 0 && pin.length === 4;

  const isCurrentValid = accountType === "customer"
    ? isCustomerValid
    : (shopRole === "owner" ? isOwnerValid : isStaffValid);

  const handleAuth = async () => {
    setError("");
    setLoading(true);

    try {
      if (accountType === "customer") {
        await signIn(email.trim(), password);

        const profile = await getProfile();

        if (profile?.role === "customer") {
          router.replace("/(customer)/home");
        } else {
          await supabase.auth.signOut();
          throw new Error("This account is not a customer account.");
        }

        return;
      }

      if (shopRole === "owner") {
        await signIn(email.trim(), password);

        const profile = await getProfile();

        if (profile?.role !== "shop") {
          await supabase.auth.signOut();
          throw new Error("This account does not have merchant access.");
        }

        const shop = await getShopByProfileId(profile.id);

        if (!shop) {
          throw new Error("No shop found. Please complete shop setup.");
        }

        router.replace("/(shop)/shop-dashboard");
        return;
      }

      const staff = await verifyStaffPin(
        staffId.trim(),
        pin,
        selectedShopId
      );

      if (!staff) {
        throw new Error("Invalid Staff ID or PIN.");
      }

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

  const renderSubmitButton = () => {
    const valid = isCurrentValid;
    let label = "Sign In";
    if (accountType === "shop" && shopRole === "staff") {
      label = "Start Shift";
    }

    return (
      <Pressable
        disabled={!valid || loading}
        onPress={handleAuth}
        style={({ pressed }) => [
          styles.submitBtn,
          !valid && styles.submitBtnDisabled,
          valid && !loading && pressed && styles.submitBtnPressed
        ]}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} size="small" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>Signing in...</Text>
          </View>
        ) : (
          <Text style={[styles.submitBtnText, !valid && styles.submitBtnTextDisabled]}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <AuthFrame>
      <AuthHeader
        title="Welcome"
        eyebrow="GRAB & GO"
        subtitle="Choose how you want to continue"
      />
      
      <Text style={styles.fieldLabel}>Choose account type:</Text>
      <View style={styles.segmented}>
        <Pressable
          onPress={() => setAccountType("customer")}
          style={[styles.segment, accountType === "customer" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, accountType === "customer" && styles.segmentTextActive]}>
            Customer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setAccountType("shop")}
          style={[styles.segment, accountType === "shop" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, accountType === "shop" && styles.segmentTextActive]}>
            Shop
          </Text>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {accountType === "customer" ? (
        <View style={styles.modeContainer}>
          <Text style={styles.modeHeading}>CUSTOMER MODE</Text>
          
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

          {renderSubmitButton()}

          <View style={styles.signupRow}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Pressable onPress={() => router.push("/(auth)/signup")}>
              <Text style={styles.link}>Create Customer Account</Text>
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
      ) : (
        <View style={styles.modeContainer}>
          <View style={styles.segmentedSmall}>
            <Pressable
              onPress={() => setShopRole("owner")}
              style={[styles.segmentSmall, shopRole === "owner" && styles.segmentSmallActive]}
            >
              <Text style={[styles.segmentTextSmall, shopRole === "owner" && styles.segmentTextSmallActive]}>
                Owner / Manager
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShopRole("staff")}
              style={[styles.segmentSmall, shopRole === "staff" && styles.segmentSmallActive]}
            >
              <Text style={[styles.segmentTextSmall, shopRole === "staff" && styles.segmentTextSmallActive]}>
                Staff
              </Text>
            </Pressable>
          </View>

          {shopRole === "owner" ? (
            <View style={styles.roleContainer}>
              <Text style={styles.modeHeading}>OWNER / MANAGER</Text>
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

              {renderSubmitButton()}

              <View style={styles.signupRow}>
                <Text style={styles.footerText}>New merchant? </Text>
                <Pressable disabled={true}>
                  <Text style={[styles.link, { opacity: 0.5 }]}>Register Shop</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.roleContainer}>
              <Text style={styles.modeHeading}>STAFF</Text>
              
              <Text style={styles.fieldLabel}>Shop</Text>
              {shops.length === 0 ? (
                <Text style={styles.helper}>Loading shops...</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
                  {shops.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[styles.shopPill, selectedShopId === s.id && styles.shopPillActive]}
                      onPress={() => setSelectedShopId(s.id)}
                    >
                      <Text style={[styles.shopPillText, selectedShopId === s.id && styles.shopPillTextActive]}>
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={{ marginTop: 14 }}>
                <Field
                  autoCapitalize="none"
                  autoCorrect={false}
                  label="Staff ID"
                  onChangeText={setStaffId}
                  value={staffId}
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

              {renderSubmitButton()}
            </View>
          )}
        </View>
      )}

      <View style={styles.adminFooter}>
        <Pressable onPress={() => router.push("/(admin)/admin-login")}>
          <Text style={styles.adminLink}>Admin Access</Text>
        </Pressable>
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
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
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
    minHeight: 44,
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  segmentTextActive: { color: colors.white },
  
  modeContainer: {
    marginBottom: 10,
  },
  modeHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: "center",
  },
  
  segmentedSmall: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 20,
    padding: 3,
  },
  segmentSmall: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
  },
  segmentSmallActive: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  segmentTextSmall: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  segmentTextSmallActive: { color: colors.ink },
  
  roleContainer: {
    flex: 1,
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
    marginTop: 20,
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

  adminFooter: {
    alignItems: "center",
    marginTop: 40,
  },
  adminLink: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },

  shopScroll: {
    flexGrow: 0,
    marginBottom: 10,
  },
  shopPill: {
    backgroundColor: "#F0F1FC",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  shopPillActive: {
    backgroundColor: colors.mint,
    borderColor: "#0E8067",
  },
  shopPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  shopPillTextActive: {
    fontWeight: "800",
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 10,
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
  }
});
