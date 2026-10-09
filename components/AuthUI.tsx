import { colors, accentOnDark } from "@/constants/colors";
import { router } from "expo-router";
import { ReactNode } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Image,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from "react-native";

/**
 * The padded, background-washed frame every screen in here sits in.
 *
 * contentStyle is for a caller that renders its own header instead of AuthHeader.
 * The default paddingTop of 42 exists to clear AuthHeader, so dropping that
 * header without adjusting it leaves the screen starting 42px lower than every
 * other one -- visible as a band of nothing above the first control. Passing
 * { paddingTop: smaller } is the way to say "this screen starts its own content".
 */
export function AuthFrame({
  children,
  contentStyle,
  scroll = true,
}: {
  children: ReactNode;
  /** Merged over the default content padding. Use when not rendering AuthHeader. */
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View pointerEvents="none" style={styles.topWash} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

export function AuthHeader({
  title,
  eyebrow = "GRAB & GO",
  subtitle,
  backRoute,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backRoute?: Parameters<typeof router.replace>[0];
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => (backRoute ? router.replace(backRoute) : router.back())}
        style={styles.backButton}
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.headerAvatar}>
        <Image
          accessibilityLabel="Grab And Go logo"
          source={require("../assets/images/grab-and-go-logo.png")}
          style={styles.headerLogo}
        />
      </View>
    </View>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <TextInput
          {...props}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  loading = false,
}: {
  children: ReactNode;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      <Text style={styles.primaryText}>
        {loading ? "Please wait..." : children}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryText}>{children}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, position: "relative", width: "100%", maxWidth: 480, alignSelf: "center", overflow: "hidden" },
  topWash: {
    backgroundColor: "#F3F4F6",
    borderBottomLeftRadius: 120,
    height: 150,
    position: "absolute",
    right: -54,
    top: 0,
    transform: [{ rotate: "-8deg" }],
    width: 230,
  },
  scrollContent: { flexGrow: 1 },
  content: {
    flex: 1,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 42,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 28,
    paddingTop: 4,
  },
  backButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    marginRight: 8,
    width: 32,
  },
  backIcon: { color: colors.ink, fontSize: 25, lineHeight: 28 },
  headerMark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  headerMarkText: { color: accentOnDark, fontSize: 17 },
  headerCopy: { flex: 1, marginLeft: 9 },
  eyebrow: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 1,
  },
  headerSubtitle: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  headerAvatar: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderColor: colors.white,
    borderRadius: 24,
    borderWidth: 3,
    elevation: 3,
    height: 48,
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 48,
  },
  avatarText: { color: colors.ink, fontSize: 15 },
  headerLogo: { height: 42, width: 42 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 7,
  },
  inputWrap: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
    borderRadius: 11,
    borderWidth: 1,
    elevation: 1,
    minHeight: 48,
    shadowColor: colors.ink,
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  input: {fontWeight: "400", color: colors.ink,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: colors.coral },
  errorText: {fontWeight: "400", color: colors.coral, fontSize: 13, marginTop: 5 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 10,
    elevation: 3,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
    shadowColor: colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 9,
    minHeight: 48,
  },
  secondaryText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    padding: 12,
  },
  errorIcon: {
    backgroundColor: colors.coral,
    borderRadius: 10,
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    height: 20,
    lineHeight: 20,
    textAlign: "center",
    width: 20,
  },
  errorBannerText: {fontWeight: "400", color: "#DC2626", flex: 1, fontSize: 12, lineHeight: 16 },
  heading: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.6,
    marginBottom: 7,
  },
  body: {fontWeight: "400", color: colors.muted, fontSize: 15, lineHeight: 18, marginBottom: 18 },
  helper: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 15, marginTop: -5 },
  link: { color: "#15803D", fontSize: 12, fontWeight: "600" },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerText: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  segmented: {
    backgroundColor: "#F3F4F6",
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
  segmentText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: colors.white },
});
