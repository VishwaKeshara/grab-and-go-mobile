import { CustomerNavbar } from "@/components/CustomerNavbar";
import { Header } from "@/components/Header";
import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function CustomerLayout() {
  return (
    <View style={styles.container}>
      <Header />
      <Slot />
      <CustomerNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
