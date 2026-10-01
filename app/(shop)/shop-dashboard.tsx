import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShopDashboard() {
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>MALABE EXPRESS</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Shop Dashboard</Text>
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>OPEN</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileInitials}>PG</Text>
          </View>
        </View>

        {/* ── Merchant Card ────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.merchantHeader}>
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>
                Pasan Groceries{" "}
                <FontAwesome color={colors.mint} name="check-circle" size={14} />
              </Text>
              <Text style={styles.merchantSub}>Malabe Bazaar</Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE ORDERS</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.shiftRow}>
            <View>
              <Text style={styles.shiftTitle}>Evening Rush Active</Text>
              <Text style={styles.shiftSub}>
                Auto +15m customer pickup window
              </Text>
            </View>
            <Text style={styles.shiftTime}>17:00 – 20:30</Text>
          </View>
        </View>

        {/* ── Primary Action: Scan QR ──────────────────────────── */}
        <Pressable
          onPress={() => router.push("/(shop)/qr-verification")}
          style={({ pressed }) => [
            styles.primaryActionCard,
            pressed && styles.pressedCard,
          ]}
        >
          <View style={styles.primaryActionIconWrap}>
            <FontAwesome color={colors.white} name="qrcode" size={24} />
          </View>
          <View style={styles.primaryActionCopy}>
            <Text style={styles.primaryActionTitle}>Scan Customer QR Pass</Text>
            <Text style={styles.primaryActionSub}>Verify instant QR Tap</Text>
          </View>
          <FontAwesome color="rgba(255,255,255,0.3)" name="chevron-right" size={16} />
        </Pressable>

        {/* ── Store Vitals ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Gross Sales Revenue</Text>
            <FontAwesome color={colors.muted} name="line-chart" size={16} />
          </View>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueAmount}>LKR 68,400</Text>
            <View style={styles.growthBadge}>
              <FontAwesome color={colors.mint} name="arrow-up" size={10} />
              <Text style={styles.growthText}>+14%</Text>
            </View>
          </View>

          {/* Progress bar visual */}
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: "79%" }]} />
            <View style={[styles.progressBarAlt, { width: "21%" }]} />
          </View>

          <View style={styles.revenueBreakdown}>
            <View style={styles.breakdownItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.ink }]} />
              <Text style={styles.breakdownLabel}>LankaQR: 54,200 (79%)</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.mint }]} />
              <Text style={styles.breakdownLabel}>Cash: 14,200</Text>
            </View>
          </View>
        </View>

        {/* ── Metrics Row ──────────────────────────────────────── */}
        <View style={styles.row}>
          <View style={[styles.card, styles.flexCard]}>
            <Text style={styles.metricTitle}>Active Queue</Text>
            <Text style={styles.metricBigVal}>6 Orders</Text>
            <View style={styles.queueBreakdown}>
              <Text style={styles.queueItem}>3 Ready</Text>
              <Text style={styles.queueItem}>2 Pack</Text>
              <Text style={styles.queueItem}>1 New</Text>
            </View>
          </View>

          <View style={[styles.card, styles.flexCard]}>
            <Text style={styles.metricTitle}>Handover</Text>
            <Text style={styles.metricBigVal}>32 sec</Text>
            <View style={styles.handoverSub}>
              <Text style={styles.handoverTarget}>Target &lt;45s</Text>
              <Text style={styles.handoverRate}>98.2% on-time release</Text>
            </View>
          </View>
        </View>

        {/* ── Low Stock Warning ────────────────────────────────── */}
        <View style={[styles.card, styles.warningCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.warningTitleWrap}>
              <FontAwesome color={colors.coral} name="warning" size={14} style={{ marginRight: 6 }} />
              <Text style={styles.warningTitle}>Low Stock Warning</Text>
            </View>
            <Text style={styles.reorderBtn}>Reorder</Text>
          </View>
          <Text style={styles.warningSub}>2 staple essentials near depletion</Text>
          
          <View style={styles.stockItemList}>
            <View style={styles.stockItem}>
              <Text style={styles.stockItemName}>Araliya Keeri Samba (5kg)</Text>
              <Text style={styles.stockItemQty}>3 left</Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={styles.stockItemName}>Highland Fresh Milk (1L)</Text>
              <Text style={styles.stockItemQty}>12 left</Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions Row ────────────────────────────────── */}
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push("/(shop)/new-orders")}
            style={({ pressed }) => [styles.actionCard, pressed && styles.pressedAction]}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: "rgba(246, 184, 75, 0.15)" }]}>
              <FontAwesome color={colors.amber} name="shopping-bag" size={18} />
            </View>
            <Text style={styles.actionTitle}>Order Queue</Text>
            <Text style={styles.actionSub}>3 New Pending</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(shop)/stock-update")}
            style={({ pressed }) => [styles.actionCard, pressed && styles.pressedAction]}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: "rgba(85, 229, 186, 0.15)" }]}>
              <FontAwesome color={colors.mint} name="tags" size={18} />
            </View>
            <Text style={styles.actionTitle}>Quick Price Edit</Text>
            <Text style={styles.actionSub}>Instant Product Sync</Text>
          </Pressable>
        </View>

        {/* ── Live Pickup Bays ─────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Live Pickup Bays</Text>
            <Text style={styles.bayLocation}>Main Corridor</Text>
          </View>
          
          <View style={styles.bayList}>
            {/* Bay 1 */}
            <View style={styles.bayItem}>
              <View style={styles.bayIdentifier}>
                <Text style={styles.bayCode}>B-01</Text>
              </View>
              <View style={styles.bayDetails}>
                <Text style={styles.bayOrderNo}>Order #9040</Text>
                <View style={styles.bayStatusRow}>
                  <View style={[styles.bayStatusDot, { backgroundColor: colors.muted }]} />
                  <Text style={styles.bayStatusText}>Collected</Text>
                </View>
              </View>
              <View style={styles.bayAction}>
                <Text style={styles.bayActionText}>Finish</Text>
              </View>
            </View>
            
            {/* Bay 2 */}
            <View style={styles.bayItem}>
              <View style={styles.bayIdentifier}>
                <Text style={styles.bayCode}>B-02</Text>
              </View>
              <View style={styles.bayDetails}>
                <Text style={styles.bayOrderNo}>Order #9042</Text>
                <View style={styles.bayStatusRow}>
                  <View style={[styles.bayStatusDot, { backgroundColor: colors.amber }]} />
                  <Text style={styles.bayStatusText}>Packing</Text>
                </View>
              </View>
              <View style={styles.bayActionLight}>
                <Text style={styles.bayActionLightText}>Assigned</Text>
              </View>
            </View>

            {/* Bay 3 */}
            <View style={[styles.bayItem, styles.bayItemLast]}>
              <View style={[styles.bayIdentifier, styles.bayIdentifierReady]}>
                <Text style={[styles.bayCode, styles.bayCodeReady]}>B-03</Text>
              </View>
              <View style={styles.bayDetails}>
                <Text style={styles.bayOrderNo}>Order #9045</Text>
                <View style={styles.bayStatusRow}>
                  <View style={[styles.bayStatusDot, { backgroundColor: colors.mint }]} />
                  <Text style={[styles.bayStatusText, { color: colors.ink, fontWeight: "700" }]}>
                    Ready for pickup
                  </Text>
                </View>
              </View>
              <View style={styles.bayPinWrap}>
                <Text style={styles.bayPinLabel}>PIN</Text>
                <Text style={styles.bayPinCode}>1842</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Settlement Card ──────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.settlementHeader}>
            <View style={styles.settlementBank}>
              <FontAwesome color={colors.ink} name="bank" size={16} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.settlementTitle}>Bank of Ceylon</Text>
                <Text style={styles.settlementSub}>Direct Settlement</Text>
              </View>
            </View>
            <View style={styles.syncedBadge}>
              <FontAwesome color={colors.mint} name="check" size={10} style={{ marginRight: 4 }} />
              <Text style={styles.syncedText}>LankaPay Synced</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.settlementFooter}>
            <View>
              <Text style={styles.batchRef}>Batch #BT-0922</Text>
              <Text style={styles.settlementAmount}>LKR 54,200</Text>
            </View>
            <Pressable style={styles.viewLedgerBtn}>
              <Text style={styles.viewLedgerText}>View Ledger</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.lilac, flex: 1 },
  scrollContent: {
    paddingBottom: 110, // Avoid overlap with ShopNavbar
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  // ── Header ──
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerLeft: { flex: 1 },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  titleRow: { alignItems: "center", flexDirection: "row" },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  openBadge: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 8,
    flexDirection: "row",
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  openDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 6,
    marginRight: 4,
    width: 6,
  },
  openText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  profileBadge: {
    alignItems: "center",
    backgroundColor: colors.nightSoft,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  profileInitials: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  // ── Card Basics ──
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 14,
  },

  // ── Merchant Card ──
  merchantHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  merchantInfo: { flex: 1 },
  merchantName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  merchantSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: "rgba(246, 184, 75, 0.15)", // amber light
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: colors.amber,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  shiftRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shiftTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  shiftSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  shiftTime: {
    color: colors.nightSoft,
    fontSize: 13,
    fontWeight: "800",
  },

  // ── Primary Action (Scan) ──
  primaryActionCard: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 16,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  pressedCard: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  primaryActionIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  primaryActionCopy: { flex: 1, marginLeft: 14 },
  primaryActionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  primaryActionSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },

  // ── Vitals ──
  revenueRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  revenueAmount: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  growthBadge: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 10,
    flexDirection: "row",
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  growthText: {
    color: colors.nightSoft,
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
  },
  progressBarWrap: {
    backgroundColor: colors.line,
    borderRadius: 4,
    flexDirection: "row",
    height: 8,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressBarFill: { backgroundColor: colors.ink },
  progressBarAlt: { backgroundColor: colors.mint },
  revenueBreakdown: { flexDirection: "row", gap: 16 },
  breakdownItem: { alignItems: "center", flexDirection: "row" },
  legendDot: { borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  breakdownLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },

  // ── Metrics Row ──
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  flexCard: { flex: 1, marginBottom: 0 },
  metricTitle: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  metricBigVal: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 8,
  },
  queueBreakdown: { gap: 2 },
  queueItem: { color: colors.nightSoft, fontSize: 11, fontWeight: "600" },
  handoverSub: { gap: 2 },
  handoverTarget: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  handoverRate: { color: colors.mint, fontSize: 11, fontWeight: "800" },

  // ── Warning ──
  warningCard: {
    backgroundColor: "rgba(239, 126, 105, 0.05)",
    borderColor: "rgba(239, 126, 105, 0.2)",
    borderWidth: 1,
  },
  warningTitleWrap: { alignItems: "center", flexDirection: "row" },
  warningTitle: { color: colors.coral, fontSize: 14, fontWeight: "800" },
  reorderBtn: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  warningSub: { color: colors.nightSoft, fontSize: 12, marginBottom: 12 },
  stockItemList: { gap: 8 },
  stockItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stockItemName: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  stockItemQty: { color: colors.coral, fontSize: 12, fontWeight: "800" },

  // ── Quick Actions ──
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    flex: 1,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pressedAction: { opacity: 0.7 },
  actionIconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    marginBottom: 12,
    width: 36,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  actionSub: { color: colors.muted, fontSize: 11 },

  // ── Live Bays ──
  bayLocation: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  bayList: { gap: 12 },
  bayItem: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 12,
  },
  bayItemLast: { borderBottomWidth: 0, paddingBottom: 0 },
  bayIdentifier: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 44,
  },
  bayIdentifierReady: { backgroundColor: colors.mintSoft },
  bayCode: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  bayCodeReady: { color: colors.ink },
  bayDetails: { flex: 1, marginLeft: 12 },
  bayOrderNo: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  bayStatusRow: { alignItems: "center", flexDirection: "row", marginTop: 2 },
  bayStatusDot: { borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  bayStatusText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  bayAction: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bayActionText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  bayActionLight: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bayActionLightText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  bayPinWrap: { alignItems: "flex-end" },
  bayPinLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  bayPinCode: { color: colors.ink, fontSize: 16, fontWeight: "900" },

  // ── Settlement ──
  settlementHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settlementBank: { alignItems: "center", flexDirection: "row" },
  settlementTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  settlementSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  syncedBadge: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 10,
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  syncedText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  settlementFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  batchRef: { color: colors.muted, fontSize: 11, marginBottom: 2 },
  settlementAmount: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  viewLedgerBtn: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewLedgerText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
});
