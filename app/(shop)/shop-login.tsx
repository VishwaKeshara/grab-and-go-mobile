import { Redirect } from "expo-router";

export default function ShopLoginRedirect() {
  return <Redirect href="/(auth)/login?accountType=shop&shopMode=owner" />;
}
