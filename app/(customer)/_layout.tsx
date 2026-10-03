import { CustomerNavbar } from "@/components/CustomerNavbar";
import { Header } from "@/components/Header";
import { OrderingProvider } from "@/hooks/useCart";
import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function CustomerLayout() {
  return (
    <OrderingProvider>
      <View style={styles.container}>
        <Header />
        <Slot />
        <CustomerNavbar />
      </View>
    </OrderingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
