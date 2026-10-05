import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type OrderDialogContent = {
  tone: "confirm" | "success" | "error" | "info";
  title: string;
  message: string;
};

type Props = {
  dialog: OrderDialogContent | null;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  busy?: boolean;
  destructive?: boolean;
};

const icons = {
  confirm: "question-circle" as const,
  success: "check-circle" as const,
  error: "exclamation-circle" as const,
  info: "phone" as const,
};

export function OrderActionDialog({ dialog, onClose, primaryLabel = "Got it", onPrimary, secondaryLabel, onSecondary, busy = false, destructive = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const topPadding = Math.max(insets.top, 16) + 16;
  const bottomPadding = Math.max(insets.bottom, 16) + 16;
  const close = () => { if (!busy) onClose(); };
  const primary = () => { if (!busy) (onPrimary ?? onClose)(); };
  const secondary = () => { if (!busy) (onSecondary ?? onClose)(); };

  return <Modal visible={!!dialog} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={close}>
    <View style={[styles.overlay, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close dialog" disabled={busy} />
      {dialog ? <View accessibilityViewIsModal style={[styles.card, { maxHeight: height - topPadding - bottomPadding }]}>
        <ScrollView style={styles.scroller} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.iconWrap, dialog.tone === "confirm" || dialog.tone === "error" ? styles.coralIcon : dialog.tone === "success" ? styles.mintIcon : styles.lilacIcon]}>
            <FontAwesome name={icons[dialog.tone]} size={23} color={dialog.tone === "confirm" || dialog.tone === "error" ? "#B2433A" : colors.ink} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{dialog.title}</Text>
          <Text style={styles.message}>{dialog.message}</Text>
        </ScrollView>
        <View style={styles.actions}>
          {secondaryLabel ? <Pressable accessibilityRole="button" accessibilityLabel={secondaryLabel} accessibilityState={{ disabled: busy }} disabled={busy} onPress={secondary} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.secondaryText}>{secondaryLabel}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={busy ? "Cancelling order" : primaryLabel} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={primary} style={({ pressed }) => [styles.button, styles.primary, destructive && styles.destructive, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <View style={styles.busyContent}><ActivityIndicator color={colors.white} size="small" /><Text style={styles.primaryText}>Cancelling...</Text></View> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
          </Pressable>
        </View>
      </View> : null}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, backgroundColor: "rgba(14, 13, 39, 0.52)" },
  card: { width: "100%", maxWidth: 400, backgroundColor: colors.white, borderRadius: 22, padding: 20, borderColor: colors.line, borderWidth: 1 },
  scroller: { flexShrink: 1 },
  content: { alignItems: "center", paddingTop: 4, paddingBottom: 20 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  coralIcon: { backgroundColor: "#FFF0ED" },
  mintIcon: { backgroundColor: colors.mintSoft },
  lilacIcon: { backgroundColor: colors.lilac },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800", textAlign: "center" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9 },
  actions: { flexDirection: "row", gap: 10 },
  button: { flex: 1, minHeight: 52, borderRadius: 14, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  primary: { backgroundColor: colors.ink },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: "800", textAlign: "center" },
  busyContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  destructive: { backgroundColor: "#B2433A" },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.6 },
});
