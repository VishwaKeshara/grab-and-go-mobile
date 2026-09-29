import { supabase } from "@/lib/supabase";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { makeRedirectUri } from "expo-auth-session";
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

export async function verifySignupOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "signup",
  });

  if (error) throw error;
  return data;
}

export async function resendSignupOtp(email: string) {
  const { error } = await supabase.auth.resend({
    email: email.trim().toLowerCase(),
    type: "signup",
  });

  if (error) throw error;
}

export async function sendPhoneOtp(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phone.trim(),
    token: token.trim(),
    type: "sms",
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
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({
    path: "auth/callback",
    scheme: "grabandgomobile",
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
    provider: "google",
  });

  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in did not return an authorization URL.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error("Google sign-in was cancelled.");

  const { errorCode, params } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
  if (!params.access_token || !params.refresh_token) {
    throw new Error("Google sign-in did not return a valid session.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sessionError) throw sessionError;
  return sessionData;
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
