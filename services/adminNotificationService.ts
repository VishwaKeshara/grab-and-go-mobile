import { supabase } from "@/lib/supabase";

export type AdminNotification = {
  id: string;
  user_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  kind: "general" | "order" | "price" | "pickup" | "offer" | "security";
  title: string;
  body: string;
  action_label: string | null;
  action_route: string | null;
  is_read: boolean;
  created_at: string;
};

export type AdminNotificationInput = {
  userId: string;
  kind: AdminNotification["kind"];
  title: string;
  body: string;
  actionLabel: string;
  actionRoute: string;
};

type Action = "list" | "create" | "update" | "delete" | "mark-read";

async function invokeNotificationManagement<T>(
  action: Action,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke(
    "admin-notification-management",
    { body: { action, ...payload } },
  );
  if (error) {
    let message = error.message;
    try {
      const response = await (error as { context?: Response }).context?.json();
      if (response?.error) message = response.error;
    } catch {
      // Keep the SDK message when the response is not JSON.
    }
    if (message.toLowerCase().includes("failed to send a request")) {
      message =
        "Notification service is not deployed. Run `supabase functions deploy admin-notification-management`.";
    }
    throw new Error(message);
  }
  return data as T;
}

export async function listAdminNotifications() {
  const data = await invokeNotificationManagement<{
    notifications: AdminNotification[];
  }>("list");
  return data.notifications;
}

export async function createAdminNotification(input: AdminNotificationInput) {
  const data = await invokeNotificationManagement<{
    notifications: AdminNotification[];
  }>("create", { notification: input });
  return data.notifications;
}

export async function updateAdminNotification(
  id: string,
  input: AdminNotificationInput,
) {
  const data = await invokeNotificationManagement<{
    notification: AdminNotification;
  }>("update", { id, notification: input });
  return data.notification;
}

export async function deleteAdminNotification(id: string) {
  await invokeNotificationManagement("delete", { id });
}

export async function markAdminNotificationRead(id: string, isRead: boolean) {
  const data = await invokeNotificationManagement<{
    notification: AdminNotification;
  }>("mark-read", { id, isRead });
  return data.notification;
}
