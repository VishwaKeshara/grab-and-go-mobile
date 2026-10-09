import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "@/constants/colors";

type SecurityEventStatus = "info" | "verified" | "warning";

interface SecurityEvent {
  id: string;
  title: string;
  subtitle: string;
  status: SecurityEventStatus;
  description: string;
  time: string;
  footer: string;
}

const KPIS = {
  failedLogins: 3,
  activePos: "24/24",
  encryptedTx: "100%",
};

const MOCK_EVENTS: SecurityEvent[] = [
  {
    id: "evt-1",
    title: "Terminal POS-MLB-02 Key Rotation",
    subtitle: "Pasan Groceries Counter #02",
    status: "info",
    description: "Cryptographic hardware token re-signed for evening shift operation. Zero downtime handshake.",
    time: "2 mins ago",
    footer: "SHA-256 Verified",
  },
  {
    id: "evt-2",
    title: "Rapid Geofence Proximity",
    subtitle: "User #4912 at SLIIT Bus Stop",
    status: "verified",
    description: "Proximity ping authenticated via Bluetooth beacon; customer express basket staged to Counter Bay B-02.",
    time: "8 mins ago",
    footer: "Node #SLIIT-04",
  },
  {
    id: "evt-3",
    title: "Multiple Failed PIN Attempts",
    subtitle: "POS-MLB-09 (Siyana Super)",
    status: "warning",
    description: "3 failed staff PIN attempts detected within a short period. Session access temporarily restricted pending verification.",
    time: "12 mins ago",
    footer: "Security Review Required",
  },
  {
    id: "evt-4",
    title: "Admin Login Authenticated",
    subtitle: "Trusted Device #MBP-14",
    status: "verified",
    description: "Superadmin role authenticated securely with multi-factor biometric passkey.",
    time: "28 mins ago",
    footer: "Biometric Passkey",
  },
  {
    id: "evt-5",
    title: "Automated Bot Traffic Blocked",
    subtitle: "External Public API Gateway",
    status: "warning",
    description: "Unusual request pattern blocked by rate limiter. Blacklisted 4 suspicious IP addresses automatically.",
    time: "42 mins ago",
    footer: "Rate Limit Enforced",
  },
];

type FilterType = "All" | SecurityEventStatus;

export default function SecurityMonitoring() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");

  const filteredEvents = MOCK_EVENTS.filter((evt) => {
    if (activeFilter === "All") return true;
    return evt.status === activeFilter;
  });

  const renderStatusBadge = (status: SecurityEventStatus) => {
    switch (status) {
      case "verified":
        return (
          <View style={[styles.statusBadge, styles.badgeMint]}>
            <Text style={[styles.statusBadgeText, styles.textMint]}>Verified</Text>
          </View>
        );
      case "warning":
        return (
          <View style={[styles.statusBadge, styles.badgeAmber]}>
            <Text style={[styles.statusBadgeText, styles.textAmber]}>Warning</Text>
          </View>
        );
      case "info":
      default:
        return (
          <View style={[styles.statusBadge, styles.badgeLilac]}>
            <Text style={[styles.statusBadgeText, styles.textNight]}>Info</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"< Back"}</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Security Monitoring</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badgeLevel}>
              <Text style={styles.badgeLevelText}>SEC-L4</Text>
            </View>
            <View style={styles.badgeRole}>
              <Text style={styles.badgeRoleText}>Platform Superadmin</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🔔</Text>
            <View style={styles.alertDot} />
          </View>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>👤</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* System / Platform Card */}
        <View style={styles.systemCard}>
          <View style={styles.systemCardLeft}>
            <Text style={styles.systemTitle}>Fintech</Text>
            <Text style={styles.systemLocation}>Malabe</Text>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Security KPIs */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconBoxAmber}>
              <Text style={styles.kpiIcon}>⚠️</Text>
            </View>
            <Text style={styles.kpiLabel}>Failed Logins</Text>
            <Text style={[styles.kpiValue, { color: colors.warning }]}>{KPIS.failedLogins}</Text>
            <Text style={styles.kpiSub}>Low Risk</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiIconBoxMint}>
              <Text style={styles.kpiIcon}>✅</Text>
            </View>
            <Text style={styles.kpiLabel}>Active POS</Text>
            <Text style={[styles.kpiValue, { color: colors.mint }]}>{KPIS.activePos}</Text>
            <Text style={styles.kpiSub}>Authenticated</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiIconBoxMint}>
              <Text style={styles.kpiIcon}>🛡️</Text>
            </View>
            <Text style={styles.kpiLabel}>Encrypted TX</Text>
            <Text style={[styles.kpiValue, { color: colors.mint }]}>{KPIS.encryptedTx}</Text>
            <Text style={styles.kpiSub}>CBSL Valid</Text>
          </View>
        </View>

        {/* Incident & Access Log Header */}
        <View style={styles.logSectionHeader}>
          <Text style={styles.sectionTitle}>Incident & Access Log</Text>
          <View style={styles.liveAuditBadge}>
            <Text style={styles.liveAuditText}>Live Audit</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersContainer}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {(["All", "info", "verified", "warning"] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            const label = filter === "All" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1);
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Log Cards */}
        {filteredEvents.map((evt) => (
          <View key={evt.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.logTitle}>{evt.title}</Text>
                <Text style={styles.logSubtitle}>{evt.subtitle}</Text>
              </View>
              {renderStatusBadge(evt.status)}
            </View>
            
            <Text style={styles.logDescription}>{evt.description}</Text>
            
            <View style={styles.logFooter}>
              <Text style={styles.logTime}>{evt.time}</Text>
              <Text style={styles.logFooterText}>{evt.footer}</Text>
            </View>
          </View>
        ))}

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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 15,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  badgeLevel: {
    backgroundColor: colors.night,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeLevelText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  badgeRole: {
    backgroundColor: colors.nightSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRoleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    gap: 12,
  },
  iconBox: {
    position: "relative",
  },
  iconText: {fontWeight: "400", fontSize: 20,
  },
  alertDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
    borderWidth: 1,
    borderColor: colors.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  systemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.night,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  systemCardLeft: {},
  systemTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.white,
    marginBottom: 4,
  },
  systemLocation: {
    fontSize: 14,
    color: colors.lilac,
    fontWeight: "500",
  },
  liveBadge: {
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveBadgeText: {
    color: colors.night,
    fontWeight: "600",
    fontSize: 12,
  },
  kpiGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIconBoxAmber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF3C2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiIconBoxMint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mintSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiIcon: {fontWeight: "400", fontSize: 14,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 4,
    textAlign: "center",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  logSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.night,
  },
  liveAuditBadge: {
    backgroundColor: colors.nightSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveAuditText: {
    color: colors.lilac,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  filtersContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  logCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.nightSoft,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.night,
    marginBottom: 4,
  },
  logSubtitle: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeMint: { backgroundColor: colors.mintSoft },
  badgeAmber: { backgroundColor: "#FEF3C2" },
  badgeLilac: { backgroundColor: colors.lilac },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  textMint: { color: "#16A34A" },
  textAmber: { color: colors.warning },
  textNight: { color: colors.night },
  logDescription: {fontWeight: "400", fontSize: 14,
    color: colors.night,
    lineHeight: 20,
    marginBottom: 16,
  },
  logFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  logTime: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  logFooterText: {
    fontSize: 12,
    color: colors.nightSoft,
    fontWeight: "700",
  },
});
