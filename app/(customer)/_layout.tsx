import { CustomerNavbar } from "@/components/CustomerNavbar";
import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function CustomerLayout() {
  return (
    <View style={styles.container}>
      <Slot />
      <CustomerNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
