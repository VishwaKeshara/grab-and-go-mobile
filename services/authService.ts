import { supabase } from "@/lib/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export type SignUpInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  preferredPickupHubId?: string;
};

export async function signUp(input: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        preferred_pickup_hub_id: input.preferredPickupHubId,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function listPickupHubs() {
  const { data, error } = await supabase
    .from("pickup_hubs")
    .select("id, name, address")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: password.trim(),
  });

  if (error) throw error;
  return data;
}

async function signInWithOAuthProvider(provider: "apple" | "google") {
  const redirectTo = makeRedirectUri({
    path: "auth/callback",
    scheme: "grabandgomobile",
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
    provider,
  });

  if (error) throw error;
  if (!data.url)
    throw new Error("Google sign-in did not return an authorization URL.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success")
    throw new Error("Google sign-in was cancelled.");

  const { errorCode, params } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
  if (!params.access_token || !params.refresh_token) {
    throw new Error("Google sign-in did not return a valid session.");
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  if (sessionError) throw sessionError;
  return sessionData;
}

export async function signInWithGoogle() {
  return signInWithOAuthProvider("google");
}

export async function signInWithApple() {
  return signInWithOAuthProvider("apple");
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
  );

  if (error) throw error;
}

export async function getProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(input: {
  fullName: string;
  phone: string;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Please sign in to update your profile.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), phone: input.phone.trim() })
    .eq("id", userData.user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// New function for shop owner registration with intent metadata
export async function signUpShopOwner(input: {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  pickupCounter: string;
  prepMinutes: number;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        registration_intent: "shop",
        pending_shop_registration: {
          shopName: input.shopName.trim(),
          shopAddress: input.shopAddress.trim(),
          shopPhone: input.shopPhone.trim(),
          pickupCounter: input.pickupCounter.trim(),
          prepMinutes: input.prepMinutes,
        },
      },
    },
  });
  if (error) throw error;
  return data;
}
