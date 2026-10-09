import { CustomerNavbar } from "@/components/CustomerNavbar";
import { CartSheet } from "@/components/CartSheet";
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
        <CartSheet />
      </View>
    </OrderingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
