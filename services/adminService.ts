import { supabase } from "@/lib/supabase";

export type ManagedUser = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: "customer" | "shop" | "admin";
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
};

export async function listManagedUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ManagedUser[];
}

export async function updateManagedUserStatus(id: string, status: ManagedUser["status"]) {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
}