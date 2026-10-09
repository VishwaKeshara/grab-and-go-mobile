import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const kinds = ["general", "order", "price", "pickup", "offer", "security"] as const;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const required = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
};

const validateNotification = (value: unknown) => {
  if (!value || typeof value !== "object") throw new Error("Notification data is required.");
  const input = value as Record<string, unknown>;
  const userId = required(input.userId, "Recipient");
  const kind = input.kind as string;
  if (!kinds.includes(kind as (typeof kinds)[number])) throw new Error("Invalid notification type.");
  return {
    user_id: userId,
    kind,
    title: required(input.title, "Title"),
    body: required(input.body, "Message"),
    action_label: typeof input.actionLabel === "string" ? input.actionLabel.trim() || null : null,
    action_route: typeof input.actionRoute === "string" ? input.actionRoute.trim() || null : null,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authorization.replace("Bearer ", "");
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Authentication required." }, 401);
    const adminClient = createClient(url, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles").select("role, status").eq("id", authData.user.id).single();
    if (profile?.role !== "admin" || profile.status !== "active") {
      return json({ error: "Administrator access is required." }, 403);
    }

    const body = await request.json();
    const action = body.action as string;
    if (action === "list") {
      const { data, error } = await adminClient.from("notifications")
        .select("id, user_id, campaign_id, kind, title, body, action_label, action_route, is_read, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data ?? []).map((item) => item.user_id))];
      const { data: profiles } = userIds.length
        ? await adminClient.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
      return json({
        notifications: (data ?? []).map((item) => ({
          ...item,
          recipient_name: profileMap.get(item.user_id)?.full_name ?? null,
          recipient_email: profileMap.get(item.user_id)?.email ?? null,
        })),
      });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (action === "delete") {
      if (!id) throw new Error("Notification id is required.");
      const { data: notification, error: findError } = await adminClient
        .from("notifications")
        .select("campaign_id")
        .eq("id", id)
        .single();
      if (findError) throw findError;
      const deleteQuery = adminClient.from("notifications").delete().select("id");
      const { data: deleted, error } = notification.campaign_id
        ? await deleteQuery.eq("campaign_id", notification.campaign_id)
        : await deleteQuery.eq("id", id);
      if (error) throw error;
      if (!deleted?.length) throw new Error("Notification was already deleted.");
      return json({ success: true, campaignId: notification.campaign_id ?? null });
    }
    if (action === "mark-read") {
      if (!id) throw new Error("Notification id is required.");
      const { data, error } = await adminClient.from("notifications")
        .update({ is_read: Boolean(body.isRead) }).eq("id", id)
        .select("id, user_id, campaign_id, kind, title, body, action_label, action_route, is_read, created_at").single();
      if (error) throw error;
      return json({ notification: data });
    }
    const input = validateNotification(body.notification);
    if (action === "create") {
      const audienceRoles: Record<string, string> = {
        "all-customers": "customer",
        "all-shop-owners": "shop",
        "all-staff": "staff",
        "all-admins": "admin",
      };
      const audienceRole = audienceRoles[input.user_id];
      const recipients = audienceRole
        ? (await adminClient.from("profiles").select("id").eq("role", audienceRole).eq("status", "active")).data ?? []
        : [{ id: input.user_id }];
      if (!recipients.length) throw new Error("No active customer recipients found.");
      const campaignId = crypto.randomUUID();
      const { data, error } = await adminClient.from("notifications")
        .insert(recipients.map((recipient) => ({
          ...input,
          user_id: recipient.id,
          campaign_id: campaignId,
        })))
        .select("id, user_id, campaign_id, kind, title, body, action_label, action_route, is_read, created_at");
      if (error) throw error;
      return json({ notifications: data ?? [] });
    }
    if (action === "update") {
      if (!id) throw new Error("Notification id is required.");
      if (input.user_id.startsWith("all-")) throw new Error("Choose one recipient when editing a notification.");
      const { data, error } = await adminClient.from("notifications").update(input).eq("id", id)
        .select("id, user_id, campaign_id, kind, title, body, action_label, action_route, is_read, created_at").single();
      if (error) throw error;
      return json({ notification: data });
    }
    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Notification management failed." }, 400);
  }
});
