import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  currentShopName: string;
  newShopName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * True when this platform can actually show an Alert.
 *
 * react-native-web ships `Alert.alert` as an empty function, so any code path
 * that relies on it to explain a failure does nothing at all -- silently. Callers
 * check this and fall back to an on-screen banner on web, so a blocked cart
 * change never just leaves the button inert.
 */
export function canShowAlert(): boolean {
  return Platform.OS !== "web";
}

export function ShopSwitchModal({ visible, currentShopName, newShopName, onConfirm, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const topPadding = Math.max(insets.top, 16) + 16;
  const bottomPadding = Math.max(insets.bottom, 16) + 16;

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onCancel}>
      <View style={[styles.overlay, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        {/* Backdrop tap explicitly disabled to prevent accidental dismiss, but onRequestClose handles back button */}
        <View style={StyleSheet.absoluteFill} />
        
        <View accessibilityViewIsModal style={[styles.card, { maxHeight: height - topPadding - bottomPadding }]}>
          <ScrollView style={styles.scroller} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={[styles.iconWrap, styles.coralIcon]}>
              <FontAwesome name="question-circle" size={23} color="#B2433A" />
            </View>
            <Text accessibilityRole="header" style={styles.title}>Switch shop?</Text>
            <Text style={styles.message}>
              Your cart currently contains items from {currentShopName}.
            </Text>
            <Text style={styles.message}>
              To add this item from {newShopName}, clear your current cart first.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [styles.button, styles.primary, styles.destructive, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Clear & Switch</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, backgroundColor: "rgba(14, 13, 39, 0.52)" },
  card: { width: "100%", maxWidth: 400, backgroundColor: colors.white, borderRadius: 22, padding: 20, borderColor: colors.line, borderWidth: 1 },
  scroller: { flexShrink: 1 },
  content: { alignItems: "center", paddingTop: 4, paddingBottom: 20 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  coralIcon: { backgroundColor: "#FFF0ED" },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800", textAlign: "center" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9 },
  actions: { flexDirection: "row", gap: 10 },
  button: { flex: 1, minHeight: 52, borderRadius: 14, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  primary: { backgroundColor: colors.ink },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: "800", textAlign: "center" },
  destructive: { backgroundColor: "#B2433A" },
  pressed: { opacity: 0.76 },
});
