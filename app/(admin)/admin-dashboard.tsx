import React from "react";
import { Alert, Image, View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, accentOnDark, accentText } from "@/constants/colors";
import { signOut } from "@/services/authService";

// --- Mock Data ---

const KPIS = {
  activeShops: 24,
  activeUsers: 1248,
  ordersToday: 186,
  securityAlerts: 3,
};

const OPERATIONS = {
  activePos: "24/24",
  completionRate: "98.2%",
  avgHandover: "32 sec",
  lankaQrStatus: "Synced",
};

const SHOP_ACTIVITY = [
  { id: "s1", name: "Pasan Groceries", status: "Live", queue: 2, orders: 45 },
  { id: "s2", name: "Sumanadasa Stores", status: "Live", queue: 0, orders: 38 },
  { id: "s3", name: "Siyana Super", status: "Attention", queue: 8, orders: 112 },
];

const SECURITY_SUMMARY = {
  failedLogins: 3,
  activePos: "24/24",
  encryptedTrans: "100%",
};

const RECENT_EVENTS = [
  { id: "e1", title: "POS terminal authenticated", time: "2 min ago", type: "success" },
  { id: "e2", title: "Order handover completed", time: "5 min ago", type: "success" },
  { id: "e3", title: "Failed PIN attempt", time: "12 min ago", type: "error" },
  { id: "e4", title: "Shop status updated: Siyana Super", time: "18 min ago", type: "warning" },
];

export default function AdminDashboard() {
  const handleLogout = async () => {
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch {
      Alert.alert("Logout failed", "We could not end your admin session. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Image
              accessibilityLabel="Grab And Go logo"
              source={require("../../assets/images/grab-and-go-logo.png")}
              style={styles.brandLogo}
            />
            <View>
              <Text style={styles.brandText}>GRAB &amp; GO</Text>
              <Text style={styles.brandCaption}>OPERATIONS CONSOLE</Text>
            </View>
          </View>
          <Text style={styles.title}>Good evening, Admin</Text>
          <Text style={styles.headerSubtitle}>
            Keep the Malabe network running smoothly.
          </Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Platform Superadmin</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <Pressable
            accessibilityLabel="Manage notifications"
            onPress={() => router.push("/(admin)/notification-management")}
            style={styles.iconPlaceholder}
          >
            <FontAwesome color={colors.mint} name="bell-o" size={16} />
          </Pressable>
          <View style={styles.adminAvatar}>
            <Text style={styles.adminAvatarText}>AD</Text>
          </View>
          <Pressable
            accessibilityLabel="Log out"
            onPress={() => void handleLogout()}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressedState]}
          >
            <FontAwesome color={colors.coral} name="sign-out" size={14} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* System Status Card */}
        <View style={styles.systemStatusCard}>
          <View style={styles.systemStatusCopy}>
            <View style={styles.statusIcon}>
              <FontAwesome color={colors.ink} name="heartbeat" size={15} />
            </View>
            <View>
            <Text style={styles.systemTitle}>Platform Operations</Text>
            <Text style={styles.systemContext}>Malabe / current hub context</Text>
            </View>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Top KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Shops</Text>
            <Text style={styles.kpiValue}>{KPIS.activeShops}</Text>
            <Text style={styles.kpiSubMint}>Online</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Users</Text>
            <Text style={styles.kpiValue}>{KPIS.activeUsers.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>Customers</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Orders Today</Text>
            <Text style={styles.kpiValue}>{KPIS.ordersToday}</Text>
            <Text style={styles.kpiSub}>Processed</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardWarning]}>
            <Text style={[styles.kpiLabel, { color: colors.coral }]}>Security Alerts</Text>
            <Text style={[styles.kpiValue, { color: colors.coral }]}>{KPIS.securityAlerts}</Text>
            <Text style={[styles.kpiSub, { color: colors.coral }]}>Action Required</Text>
          </View>
        </View>

        {/* Operations Section */}
        <Text style={styles.sectionTitle}>Operations</Text>
        <View style={styles.operationsCard}>
          <View style={styles.opRow}>
            <Text style={styles.opLabel}>Active POS terminals</Text>
            <Text style={styles.opValue}>{OPERATIONS.activePos}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.opRow}>
            <Text style={styles.opLabel}>Pickup completion rate</Text>
            <Text style={styles.opValue}>{OPERATIONS.completionRate}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.opRow}>
            <Text style={styles.opLabel}>Average handover time</Text>
            <Text style={styles.opValue}>{OPERATIONS.avgHandover}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.opRow}>
            <Text style={styles.opLabel}>LankaQR Sync</Text>
            <Text style={styles.opValueMint}>{OPERATIONS.lankaQrStatus}</Text>
          </View>
        </View>

        {/* Quick Admin Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Pressable 
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedState]}
            onPress={() => router.push("/(admin)/security-monitoring")}
          >
            <Text style={styles.actionBtnText}>Security Monitoring</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedState]}
            onPress={() => router.push("/(admin)/user-management")}
          >
            <Text style={styles.actionBtnText}>User Management</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedState]}>
            <Text style={styles.actionBtnText}>Shop Management</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedState]}>
            <Text style={styles.actionBtnText}>Reports</Text>
          </Pressable>
        </View>

        {/* Shop Activity */}
        <Text style={styles.sectionTitle}>Shop Activity</Text>
        <View style={styles.listCard}>
          {SHOP_ACTIVITY.map((shop, index) => (
            <View key={shop.id}>
              <View style={styles.shopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopName}>{shop.name}</Text>
                  <Text style={styles.shopMetrics}>Queue: {shop.queue} • Orders: {shop.orders}</Text>
                </View>
                <View style={[
                  styles.statusPill, 
                  shop.status === "Live" ? styles.bgMintSoft : styles.bgAmberSoft
                ]}>
                  <Text style={[
                    styles.statusPillText, 
                    shop.status === "Live" ? styles.textMint : styles.textAmber
                  ]}>{shop.status}</Text>
                </View>
              </View>
              {index < SHOP_ACTIVITY.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Security Summary */}
        <Text style={styles.sectionTitle}>Security Summary</Text>
        <View style={styles.securityCard}>
          <Text style={styles.secItem}>• Failed logins today: {SECURITY_SUMMARY.failedLogins}</Text>
          <Text style={styles.secItem}>• Active POS: {SECURITY_SUMMARY.activePos}</Text>
          <Text style={styles.secItem}>• Encrypted transactions: {SECURITY_SUMMARY.encryptedTrans}</Text>
          
          <Pressable 
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedState]}
            onPress={() => router.push("/(admin)/security-monitoring")}
          >
            <Text style={styles.btnPrimaryText}>View Security Monitoring</Text>
          </Pressable>
        </View>

        {/* Recent Platform Events */}
        <Text style={styles.sectionTitle}>Recent Events</Text>
        <View style={styles.eventsCard}>
          {RECENT_EVENTS.map((event, index) => {
            const isError = event.type === "error";
            const isWarning = event.type === "warning";
            const isSuccess = event.type === "success";

            return (
              <View key={event.id} style={styles.eventRow}>
                <View style={[
                  styles.eventIndicator,
                  isError && { backgroundColor: colors.coral },
                  isWarning && { backgroundColor: colors.amber },
                  isSuccess && { backgroundColor: colors.mint },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{event.time}</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    backgroundColor: colors.night,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 132,
  },
  brandText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
    letterSpacing: 1,
  },
  brandCaption: {
    color: accentOnDark,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 22 },
  brandLogo: { backgroundColor: colors.white, borderRadius: 10, height: 42, width: 42 },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  headerSubtitle: {fontWeight: "400", color: "#D1D5DB",
    fontSize: 12,
    marginBottom: 12,
  },
  adminBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(22, 163, 74, 0.16)",
    borderColor: "rgba(22, 163, 74, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: accentText,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  headerIcons: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    right: 18,
    top: 22,
  },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  adminAvatar: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  adminAvatarText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.25)",
    borderWidth: 1,
    borderRadius: 9,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  logoutText: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 60,
  },
  systemStatusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  systemStatusCopy: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  statusIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  systemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.night,
  },
  systemContext: {fontWeight: "400", fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  liveBadge: {
    backgroundColor: colors.mintSoft,
    flexShrink: 0,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveBadgeText: {
    color: "#16A34A", // custom dark green over mintSoft
    fontWeight: "600",
    fontSize: 12,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.white,
    borderColor: "#F3F4F6",
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiCardWarning: {
    backgroundColor: "#FEE2E2", // light coral hint
    borderColor: colors.coral,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 4,
  },
  kpiSub: {fontWeight: "400", fontSize: 12,
    color: colors.muted,
  },
  kpiSubMint: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 12,
  },
  operationsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  opRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  opLabel: {
    fontSize: 14,
    color: colors.muted,
    flex: 1,
    fontWeight: "500",
  },
  opValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.night,
    marginLeft: 16,
    textAlign: "right",
  },
  opValueMint: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16A34A",
    marginLeft: 16,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  actionBtnText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 4,
  },
  shopMetrics: {fontWeight: "400", fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  statusPill: {
    flexShrink: 0,
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {fontWeight: "400", fontSize: 12,
  },
  bgMintSoft: { backgroundColor: colors.mintSoft },
  bgAmberSoft: { backgroundColor: "#FEF3C2" },
  textMint: { color: "#16A34A", fontWeight: "700", fontSize: 12 },
  textAmber: { color: "#92400E", fontWeight: "700", fontSize: 12 },
  securityCard: {
    backgroundColor: colors.night,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  secItem: {
    color: colors.lilac,
    fontSize: 14,
    marginBottom: 10,
    fontWeight: "500",
  },
  btnPrimary: {
    backgroundColor: colors.mint,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnPrimaryText: {
    color: colors.night,
    fontSize: 15,
    fontWeight: "600",
  },
  eventsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: colors.line,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  eventIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 2,
  },
  eventTime: {fontWeight: "400", fontSize: 12,
    color: colors.muted,
  },
  pressedState: {
    opacity: 0.8,
  },
});
