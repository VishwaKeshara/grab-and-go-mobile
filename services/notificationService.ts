import { supabase } from "@/lib/supabase";

export type Notification = {
  id: string;
  kind: "general" | "order" | "price" | "pickup" | "offer" | "security";
  title: string;
  body: string;
  action_label: string | null;
  action_route: string | null;
  is_read: boolean;
  created_at: string;
};

export async function listNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, action_label, action_route, is_read, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return;

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userData.user.id).eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}