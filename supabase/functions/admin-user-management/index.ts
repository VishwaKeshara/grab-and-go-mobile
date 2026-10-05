import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Role = "customer" | "shop" | "admin";
type Status = "active" | "suspended";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getRequiredString = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
};

const validateUser = (value: unknown, requiresPassword: boolean) => {
  if (!value || typeof value !== "object") throw new Error("User data is required.");
  const user = value as Record<string, unknown>;
  const email = getRequiredString(user.email, "Email").toLowerCase();
  const fullName = getRequiredString(user.fullName, "Full name");
  const phone = typeof user.phone === "string" ? user.phone.trim() : "";
  const role = user.role as Role;
  const status = user.status as Status;
  if (!["customer", "shop", "admin"].includes(role)) throw new Error("Invalid role.");
  if (!["active", "suspended"].includes(status)) throw new Error("Invalid status.");
  const password = typeof user.password === "string" ? user.password : "";
  if (requiresPassword && password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return { email, fullName, phone, role, status, password };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authorization.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Authentication required." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, status")
      .eq("id", authData.user.id)
      .single();
    if (profileError || adminProfile?.role !== "admin" || adminProfile.status !== "active") {
      return json({ error: "Administrator access is required." }, 403);
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await adminClient
        .from("profiles")
        .select("id, email, full_name, phone, role, status, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ users: data ?? [] });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (action === "delete") {
      if (!id) throw new Error("User id is required.");
      if (id === authData.user.id) throw new Error("You cannot delete your own account.");
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "update-status") {
      if (!id) throw new Error("User id is required.");
      const status = body.status as Status;
      if (!["active", "suspended"].includes(status)) throw new Error("Invalid status.");
      const { data, error } = await adminClient
        .from("profiles")
        .update({ status })
        .eq("id", id)
        .select("id, email, full_name, phone, role, status, created_at, updated_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    if (action === "create") {
      const input = validateUser(body.user, true);
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName, phone: input.phone },
      });
      if (createError || !created.user) throw createError ?? new Error("Could not create user.");
      const { data, error } = await adminClient
        .from("profiles")
        .upsert({
          id: created.user.id,
          email: input.email,
          full_name: input.fullName,
          phone: input.phone || null,
          role: input.role,
          status: input.status,
        })
        .eq("id", created.user.id)
        .select("id, email, full_name, phone, role, status, created_at, updated_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    if (action === "update") {
      if (!id) throw new Error("User id is required.");
      const input = validateUser(body.user, false);
      const authUpdate: { email?: string; password?: string; user_metadata: Record<string, string> } = {
        user_metadata: { full_name: input.fullName, phone: input.phone },
      };
      if (input.email) authUpdate.email = input.email;
      if (input.password) authUpdate.password = input.password;
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authUpdate);
      if (authUpdateError) throw authUpdateError;
      const { data, error } = await adminClient
        .from("profiles")
        .update({
          email: input.email,
          full_name: input.fullName,
          phone: input.phone || null,
          role: input.role,
          status: input.status,
        })
        .eq("id", id)
        .select("id, email, full_name, phone, role, status, created_at, updated_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "User management failed." }, 400);
  }
});
