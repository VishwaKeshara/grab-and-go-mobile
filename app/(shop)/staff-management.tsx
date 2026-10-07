import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { getLocalStaffSession } from "@/services/shopService";
import { ShopStaff } from "@/types/shop";

export default function StaffManagementScreen() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newPin, setNewPin] = useState("");

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetStaffId, setResetStaffId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        router.replace("/(shop)/shop-dashboard");
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: shop } = await supabase.from("customer_shops").select("id").eq("profile_id", user.user.id).single();
      if (shop) {
        setShopId(shop.id);
        fetchStaff(shop.id);
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function fetchStaff(id: string) {
    const { data, error } = await supabase.rpc("list_shop_staff", { p_shop_id: id });
    if (!error && data) {
      setStaff(data);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newCode || !newPin) return Alert.alert("Error", "Code and PIN required");
    if (newPin.length !== 4) return Alert.alert("Error", "PIN must be exactly 4 digits");
    
    const { data, error } = await supabase.rpc("add_shop_staff", {
      p_shop_id: shopId,
      p_staff_code: newCode,
      p_pin_plain: newPin
    });
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setNewCode("");
      setNewPin("");
      fetchStaff(shopId!);
    }
  }

  async function handleResetPinSubmit() {
    if (!resetPin || resetPin.length !== 4) return Alert.alert("Error", "PIN must be exactly 4 digits");
    if (!resetStaffId) return;
    const { error } = await supabase.rpc("reset_staff_pin", {
      p_staff_id: resetStaffId,
      p_new_pin: resetPin
    });
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "PIN reset successfully");
      setResetModalVisible(false);
      setResetPin("");
      setResetStaffId(null);
    }
  }

  async function handleToggle(staffId: string, currentStatus: boolean) {
    const { error } = await supabase.rpc("toggle_staff_status", {
      p_staff_id: staffId,
      p_is_active: !currentStatus
    });
    if (error) Alert.alert("Error", error.message);
    else fetchStaff(shopId!);
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Staff Management</Text>
      <View style={styles.addCard}>
        <Text style={styles.cardTitle}>Add Staff</Text>
        <TextInput style={styles.input} placeholder="Staff Code (e.g. KW-01)" value={newCode} onChangeText={setNewCode} />
        <TextInput style={styles.input} placeholder="4-digit PIN" keyboardType="numeric" value={newPin} onChangeText={setNewPin} maxLength={4} />
        <Pressable onPress={handleAdd} style={styles.btn}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>
      
      <FlatList
        data={staff}
        keyExtractor={s => s.id}
        renderItem={({ item }) => {
          const sCode = item.staff_code;
          const isActive = item.is_active;
          return (
            <View style={styles.staffRow}>
              <View>
                <Text style={styles.staffCode}>{sCode}</Text>
                <Text>Status: {isActive ? "Active" : "Inactive"}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => { setResetStaffId(item.id); setResetModalVisible(true); }} style={[styles.actionBtn, {backgroundColor: '#f39c12'}]}>
                  <Text style={styles.btnText}>Reset PIN</Text>
                </Pressable>
                <Pressable onPress={() => handleToggle(item.id, isActive)} style={[styles.actionBtn, {backgroundColor: isActive ? '#e74c3c' : '#2ecc71'}]}>
                  <Text style={styles.btnText}>{isActive ? "Disable" : "Enable"}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.btnText}>Back</Text>
      </Pressable>
      
      <Modal visible={resetModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>Reset PIN</Text>
            <TextInput style={styles.input} placeholder="New 4-digit PIN" keyboardType="numeric" value={resetPin} onChangeText={setResetPin} maxLength={4} />
            <View style={{flexDirection: 'row', justifyContent: 'space-around'}}>
               <Pressable onPress={() => setResetModalVisible(false)} style={[styles.btn, {backgroundColor: '#7f8c8d', marginRight: 8, flex: 1}]}><Text style={styles.btnText}>Cancel</Text></Pressable>
               <Pressable onPress={handleResetPinSubmit} style={[styles.btn, {marginLeft: 8, flex: 1}]}><Text style={styles.btnText}>Submit</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  addCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 12 },
  btn: { backgroundColor: '#3498db', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  staffRow: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  staffCode: { fontSize: 16, fontWeight: 'bold' },
  actions: { gap: 8 },
  actionBtn: { padding: 8, borderRadius: 4, alignItems: 'center' },
  backBtn: { backgroundColor: '#7f8c8d', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  modalBg: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 8 }
});
