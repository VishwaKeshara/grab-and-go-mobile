import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Pressable, TextInput } from "react-native";
import { router } from "expo-router";
import { ShopOrder } from "@/types/shopOrder";

// --- Mock Data ---
interface VerifiedOrder extends ShopOrder {
  stagingBay?: string;
  crate?: string;
  bagType?: string;
  paymentState?: string;
  lankaQrRef?: string;
  tier?: string;
}

const MOCK_VERIFIED_ORDER: VerifiedOrder = {
  id: "GNG-MLB-9042",
  shopId: "shop-1",
  customerId: "cust-1",
  reference: "GG-2026-9042",
  pickupPin: "5182",
  customerName: "Dinithi Perera",
  customerPhone: "0771234567",
  status: "ready",
  packingStatus: "fully_packed",
  totalLkr: 3100,
  subtotalLkr: 3100,
  savingsLkr: 0,
  serviceFeeLkr: 0,
  paymentMethod: "card",
  paymentStatus: "paid",
  packingInstructions: "",
  travelMethod: "walking",
  pickupStartAt: "2026-10-02T17:30:00+05:30",
  pickupEndAt: "2026-10-02T18:00:00+05:30",
  createdAt: "2026-10-02T17:12:00+05:30",
  updatedAt: "2026-10-02T17:35:00+05:30",
  acceptedAt: "2026-10-02T17:15:00+05:30",
  packingStartedAt: "2026-10-02T17:15:30+05:30",
  readyAt: "2026-10-02T17:30:00+05:30",
  tier: "VIP Commuter",
  stagingBay: "BAY #B-02",
  crate: "CRATE 04",
  bagType: "Double Bag",
  paymentState: "PAID",
  lankaQrRef: "LQR-982-110",
};

export default function QrVerification() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [handoverCompleted, setHandoverCompleted] = useState(false);

  const handlePinChange = (text: string) => {
    // Only digits, max 4
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(cleaned);
    if (error) setError(null);
  };

  const handleVerify = () => {
    // Demo validation only
    if (pin === "5182") {
      setIsVerified(true);
      setError(null);
    } else {
      setError("Pickup PIN not recognized.");
    }
  };

  const handleHandover = () => {
    // Local mock state only
    setHandoverCompleted(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"< Back"}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerBrand}>MALABE EXPRESS OUTLET</Text>
          <Text style={styles.headerTitle}>QR Verification</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>OPEN</Text>
        </View>
        <View style={styles.profileBadge} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Counter Status */}
        <View style={styles.counterCard}>
          <View>
            <Text style={styles.counterTitle}>Counter 02</Text>
            <Text style={styles.counterSub}>Pasan Groceries Hub</Text>
          </View>
          <View style={styles.liveScannerBadge}>
            <Text style={styles.liveScannerText}>LIVE SCANNER READY</Text>
          </View>
        </View>

        {!isVerified ? (
          <>
            {/* Simulated Scanner Area */}
            <View style={styles.scannerPanel}>
              <View style={styles.scannerTarget}>
                {/* Visual corner brackets simulated via border */}
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                
                {/* Center scan line */}
                <View style={styles.scanLine} />
              </View>

              <Text style={styles.cameraLabel}>CAM 02 • 60 FPS</Text>

              <View style={styles.scannerActions}>
                <TouchableOpacity style={styles.scannerBtn}>
                  <Text style={styles.scannerBtnText}>🔦 Torch</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scannerBtn}>
                  <Text style={styles.scannerBtnText}>🔄 Flip</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scannerHelper}>
                Point counter camera at customer’s phone or slip
              </Text>
            </View>

            {/* PIN Fallback */}
            <View style={styles.pinSection}>
              <Text style={styles.pinTitle}>OR ENTER VERBAL 4-DIGIT PIN</Text>
              
              <TextInput
                style={styles.hiddenInput}
                keyboardType="numeric"
                maxLength={4}
                value={pin}
                onChangeText={handlePinChange}
                autoFocus={false}
              />

              <View style={styles.pinBoxes}>
                {[0, 1, 2, 3].map((index) => (
                  <View key={index} style={[styles.pinBox, pin.length > index && styles.pinBoxFilled]}>
                    <Text style={styles.pinBoxText}>{pin[index] || ""}</Text>
                  </View>
                ))}
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
              <Text style={styles.demoNote}>Demo PIN: 5182</Text>

              <Pressable 
                style={({ pressed }) => [
                  styles.btnVerify, 
                  pin.length < 4 && styles.btnVerifyDisabled,
                  pressed && pin.length === 4 && styles.btnPressed
                ]}
                disabled={pin.length < 4}
                onPress={handleVerify}
              >
                <Text style={styles.btnVerifyText}>Verify</Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* Verified State */
          <View style={styles.verifiedSection}>
            <View style={styles.verifiedHeader}>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>✓ MATCH</Text>
              </View>
              <Text style={styles.verifiedTitle}>VALID PICKUP PASS VERIFIED</Text>
              <Text style={styles.verifiedSub}>Ready for physical handover</Text>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.orderId}>{MOCK_VERIFIED_ORDER.id}</Text>
              <View style={styles.divider} />
              
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{MOCK_VERIFIED_ORDER.customerName}</Text>
              <Text style={styles.detailSub}>{MOCK_VERIFIED_ORDER.tier}</Text>

              <View style={styles.stagingRow}>
                <View style={styles.stagingBox}>
                  <Text style={styles.stagingLabel}>Staging:</Text>
                  <Text style={styles.stagingVal}>{MOCK_VERIFIED_ORDER.stagingBay}</Text>
                </View>
                <View style={styles.stagingBox}>
                  <Text style={styles.stagingLabel}>Crate:</Text>
                  <Text style={styles.stagingVal}>{MOCK_VERIFIED_ORDER.crate}</Text>
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.detailValRow}>• {MOCK_VERIFIED_ORDER.items?.length || 4} items</Text>
              <Text style={styles.detailValRow}>• {MOCK_VERIFIED_ORDER.bagType}</Text>
              <Text style={styles.detailValRow}>• LKR {MOCK_VERIFIED_ORDER.totalLkr.toLocaleString()} - {MOCK_VERIFIED_ORDER.paymentState}</Text>
              {MOCK_VERIFIED_ORDER.lankaQrRef && (
                <Text style={styles.detailValRow}>• Ref: {MOCK_VERIFIED_ORDER.lankaQrRef}</Text>
              )}
            </View>

            {handoverCompleted ? (
              <View style={styles.successState}>
                <Text style={styles.successStateText}>✓ Handover completed successfully.</Text>
              </View>
            ) : (
              <>
                <Pressable 
                  style={({ pressed }) => [styles.btnHandover, pressed && styles.btnPressed]}
                  onPress={handleHandover}
                >
                  <Text style={styles.btnHandoverText}>Confirm Handover & Clear Line</Text>
                </Pressable>
                
                <Pressable style={({ pressed }) => [styles.btnReport, pressed && styles.btnPressed]}>
                  <Text style={styles.btnReportText}>Report Issue / Missing Item</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Footer Metrics */}
        <View style={styles.metricsCard}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>18 Pickups Handed Over</Text>
            <Text style={styles.metricTarget}>+14% Target</Text>
          </View>
          <Text style={styles.metricSub}>Rush Hour Velocity: 29.4s avg</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: "#16A34A",
    fontWeight: "600",
  },
  headerTitleContainer: {
    alignItems: "center",
    flex: 1,
  },
  headerBrand: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  statusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusBadgeText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 12,
  },
  profileBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1D5DB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  counterCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  counterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  counterSub: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
  },
  liveScannerBadge: {
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  liveScannerText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "600",
  },
  scannerPanel: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  scannerTarget: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    position: "relative",
    justifyContent: "center",
    marginBottom: 16,
  },
  scanLine: {
    height: 2,
    backgroundColor: "#16A34A",
    width: "100%",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#16A34A",
  },
  tl: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: -1, left: -1, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: -1, right: -1, borderBottomWidth: 4, borderRightWidth: 4 },
  cameraLabel: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 20,
  },
  scannerActions: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  scannerBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scannerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  scannerHelper: {fontWeight: "400", color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  pinSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  pinTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 16,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
  },
  pinBoxes: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  pinBox: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  pinBoxFilled: {
    borderColor: "#111827",
    backgroundColor: "#FFFFFF",
  },
  pinBoxText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "400",
  },
  demoNote: {fontWeight: "400", color: "#4B5563",
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 16,
  },
  btnVerify: {
    backgroundColor: "#16A34A",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnVerifyDisabled: {
    backgroundColor: "#D1D5DB",
  },
  btnVerifyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  verifiedSection: {
    marginBottom: 24,
  },
  verifiedHeader: {
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#16A34A",
  },
  matchBadge: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  matchBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  verifiedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  verifiedSub: {
    fontSize: 14,
    color: "#16A34A",
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  orderId: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "700",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  detailSub: {fontWeight: "400", fontSize: 14,
    color: "#4B5563",
    marginBottom: 16,
  },
  stagingRow: {
    flexDirection: "row",
    gap: 16,
  },
  stagingBox: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  stagingLabel: {fontWeight: "400", fontSize: 12,
    color: "#4B5563",
    marginBottom: 2,
  },
  stagingVal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  detailValRow: {
    fontSize: 15,
    color: "#111827",
    marginBottom: 6,
    fontWeight: "500",
  },
  btnHandover: {
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnHandoverText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  btnReport: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnReportText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  btnPressed: {
    opacity: 0.8,
  },
  successState: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  successStateText: {
    color: "#16A34A",
    fontSize: 16,
    fontWeight: "700",
  },
  metricsCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  metricTarget: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  metricSub: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
  },
});
