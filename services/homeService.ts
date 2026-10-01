import { supabase } from "@/lib/supabase";

export type HomeContext = {
  firstName: string;
  pickupHub: string;
};

export async function getHomeContext(): Promise<HomeContext | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, preferred_pickup_hub_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  let pickupHub = "Malabe Bazaar Hub";
  if (profile?.preferred_pickup_hub_id) {
    const { data: hub, error: hubError } = await supabase
      .from("pickup_hubs")
      .select("name")
      .eq("id", profile.preferred_pickup_hub_id)
      .maybeSingle();

    if (hubError) throw hubError;
    pickupHub = hub?.name ?? pickupHub;
  }

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "Dilshan";
  return { firstName, pickupHub };
}
