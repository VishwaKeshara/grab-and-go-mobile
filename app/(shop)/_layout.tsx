import { ShopNavbar } from "@/components/ShopNavbar";
import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function ShopLayout() {
  return (
    <View style={styles.container}>
      <Slot />
      <ShopNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});