import { supabase } from "@/lib/supabase";

export type ManagedUser = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: "customer" | "shop" | "staff" | "admin";
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
};

export type ManagedUserInput = {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  role: ManagedUser["role"];
  status: ManagedUser["status"];
};

async function invokeUserManagement<T>(
  action: "list" | "create" | "update" | "update-status" | "delete",
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke(
    "admin-user-management",
    { body: { action, ...payload } },
  );

  if (error) {
    let message = error.message;
    try {
      const response = await (error as { context?: Response }).context?.json();
      if (response?.error) message = response.error;
    } catch {
      // Keep the SDK error when the function response is not JSON.
    }
    throw new Error(message);
  }

  return data as T;
}

export async function listManagedUsers() {
  const data = await invokeUserManagement<{ users: ManagedUser[] }>("list");
  return data.users;
}

export async function createManagedUser(input: ManagedUserInput) {
  const data = await invokeUserManagement<{ user: ManagedUser }>("create", {
    user: input,
  });
  return data.user;
}

export async function updateManagedUser(
  id: string,
  input: ManagedUserInput,
) {
  const data = await invokeUserManagement<{ user: ManagedUser }>("update", {
    id,
    user: input,
  });
  return data.user;
}

export async function updateManagedUserStatus(
  id: string,
  status: ManagedUser["status"],
) {
  const data = await invokeUserManagement<{ user: ManagedUser }>("update-status", {
    id,
    status,
  });
  return data.user;
}

export async function deleteManagedUser(id: string) {
  await invokeUserManagement("delete", { id });
}
