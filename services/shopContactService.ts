import { Linking, Platform } from "react-native";
import { openShopPhone } from "@/utils/shopPhone";

export async function callShop(phone: string | null): Promise<string> {
  const number = await openShopPhone(phone, url => Linking.openURL(url));
  return Platform.OS === "web"
    ? `If your browser did not open a phone app, call ${number} from a phone instead.`
    : "";
}
