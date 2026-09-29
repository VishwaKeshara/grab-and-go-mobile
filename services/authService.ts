import { supabase } from "@/lib/supabase";

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
