import React from "react";
import { Alert, Image, View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "@/constants/colors";
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
            <Text style={styles.brandText}>GRAB & GO</Text>
          </View>
          <Text style={styles.title}>Admin Dashboard</Text>
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
            <Text style={styles.iconText}>🔔</Text>
          </Pressable>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>👤</Text>
          </View>
          <Pressable
            accessibilityLabel="Log out"
            onPress={() => void handleLogout()}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressedState]}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* System Status Card */}
        <View style={styles.systemStatusCard}>
          <View>
            <Text style={styles.systemTitle}>Platform Operations</Text>
            <Text style={styles.systemContext}>Malabe / current hub context</Text>
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerLeft: {
    flex: 1,
  },
  brandText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
    marginLeft: 8,
  },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 4 },
  brandLogo: { backgroundColor: colors.white, borderRadius: 8, height: 34, width: 34 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.night,
    marginBottom: 6,
  },
  adminBadge: {
    backgroundColor: colors.nightSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  adminBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerIcons: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lilac,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: "#FFE8E4",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  logoutText: {
    color: colors.coral,
    fontSize: 10,
    fontWeight: "800",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  systemStatusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  systemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.night,
  },
  systemContext: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  liveBadge: {
    backgroundColor: colors.mintSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveBadgeText: {
    color: "#00A859", // custom dark green over mintSoft
    fontWeight: "800",
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
    padding: 16,
    borderRadius: 16,
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiCardWarning: {
    backgroundColor: "#FFF5F3", // light coral hint
    borderColor: colors.coral,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.night,
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 12,
    color: colors.muted,
  },
  kpiSubMint: {
    fontSize: 12,
    color: "#00A859",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
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
    fontWeight: "500",
  },
  opValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.night,
  },
  opValueMint: {
    fontSize: 15,
    fontWeight: "700",
    color: "#00A859",
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
    backgroundColor: colors.night,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.night,
    marginBottom: 4,
  },
  shopMetrics: {
    fontSize: 13,
    color: colors.muted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 12,
  },
  bgMintSoft: { backgroundColor: colors.mintSoft },
  bgAmberSoft: { backgroundColor: "#FFF4E5" },
  textMint: { color: "#00A859", fontWeight: "700", fontSize: 12 },
  textAmber: { color: "#E09000", fontWeight: "700", fontSize: 12 },
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
    fontWeight: "700",
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
  eventTime: {
    fontSize: 12,
    color: colors.muted,
  },
  pressedState: {
    opacity: 0.8,
  },
});
