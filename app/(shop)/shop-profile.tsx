import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { getShopByProfileId, getLocalStaffSession, clearLocalStaffSession, getStaffProfile } from "@/services/shopService";
export default function ShopProfileScreen() {
  const [shop, setShop] = useState<any>(null);
  const [email, setEmail] = useState<string>("");
  const [ownerName, setOwnerName] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [staffData, setStaffData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const staffToken = await getLocalStaffSession();
        if (staffToken) {
          setIsStaff(true);
          const profile = await getStaffProfile(staffToken);
          if (profile) {
            setStaffData({ staff_code: profile.staffCode });
            setShop({ name: profile.shopName, prepMinutes: 25 });
          } else {
            setStaffData({ staff_code: "STAFF" });
            setShop({ name: "Shop", prepMinutes: 25 });
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) setEmail(session.user.email);
        if (session?.user?.user_metadata?.full_name) setOwnerName(session.user.user_metadata.full_name);

        if (session?.user?.id) {
          const profile = await getShopByProfileId(session.user.id);
          setShop(profile);
        }
      } catch (err) {
        console.error("[ShopProfile] load error", err);
      }
    }
    load();
  }, []);

  const handleLogout = async () => {
    try {
      if (isStaff) {
        await clearLocalStaffSession();
      } else {
        await supabase.auth.signOut();
      }
      router.replace("/");
    } catch (err) {
      console.error("[ShopProfile] logout error", err);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <FontAwesome name="user" size={32} color={colors.paper} />
          </View>
          <Text style={styles.shopName}>{isStaff ? staffData?.full_name || staffData?.staff_code : shop?.name || "Loading..."}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{isStaff ? "STAFF" : "SHOP OWNER"}</Text>
          </View>
        </View>

        {!isStaff && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Owner Information</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{ownerName || "Not set"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{email || "Loading..."}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Shop Code</Text>
              <Text style={styles.infoValue}>{shop?.shopCode || "Not generated yet"}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Shop Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={shop?.isOpen ? styles.openBadge : styles.closedBadge}>
               <Text style={shop?.isOpen ? styles.openText : styles.closedText}>
                 {shop?.isOpen ? "OPEN" : "CLOSED"}
               </Text>
            </View>
          </View>

          {!isStaff && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{shop?.address || "Not set"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{shop?.phone || "Not set"}</Text>
              </View>
            </>
          )}
        </View>

        {!isStaff && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pickup Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pickup Counter</Text>
              <Text style={styles.infoValue}>{shop?.pickupCounter || "N/A"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Prep Time</Text>
              <Text style={styles.infoValue}>{shop?.prepMinutes ? `${shop.prepMinutes} mins` : "N/A"}</Text>
            </View>
          </View>
        )}

        {isStaff && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Staff Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Staff ID</Text>
              <Text style={styles.infoValue}>{staffData?.staff_code}</Text>
            </View>
          </View>
        )}

        <Pressable 
          style={({pressed}) => [styles.logoutButton, pressed && styles.logoutButtonPressed]} 
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>{isStaff ? "End Shift" : "Log Out"}</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.lilac, flex: 1 },
  scrollContent: {
    paddingBottom: 110,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  placeholder: {
    width: 36,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.nightSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  shopName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "rgba(14, 128, 103, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: colors.mint,
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  infoValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 12,
  },
  openBadge: {
    backgroundColor: "rgba(14, 128, 103, 0.1)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openText: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: "800",
  },
  closedBadge: {
    backgroundColor: "rgba(224, 69, 75, 0.1)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closedText: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: "800",
  },
  logoutButton: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(224, 69, 75, 0.2)",
  },
  logoutButtonPressed: {
    backgroundColor: "rgba(224, 69, 75, 0.05)",
  },
  logoutButtonText: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: "700",
  },
});
