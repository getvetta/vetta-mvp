// lib/resolveDealerId.ts
import { supabaseAdmin } from "@/utils/supabaseAdmin";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export type DealerResolution =
  | { ok: true; dealerId: string; dealerKey: string | null }
  | { ok: false; error: string };

export async function resolveDealerIdFromParam(dealerParamRaw: string): Promise<DealerResolution> {
  const dealerParam = String(dealerParamRaw || "").trim();
  if (!dealerParam) return { ok: false, error: "Missing dealer param" };

  // If param is UUID, optionally fetch the public key (dealers.name)
  if (isUuid(dealerParam)) {
    const { data, error } = await supabaseAdmin
      .from("dealers")
      .select("name")
      .eq("id", dealerParam)
      .maybeSingle();

    if (error) {
      // Still return the UUID even if we can't fetch name
      return { ok: true, dealerId: dealerParam, dealerKey: null };
    }

    const dealerKey = data?.name ? String(data.name).trim() : null;
    return { ok: true, dealerId: dealerParam, dealerKey };
  }

  // Otherwise treat it like the public key (dealers.name)
  const { data, error } = await supabaseAdmin
    .from("dealers")
    .select("id, name")
    .eq("name", dealerParam)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: `Dealer not found for key: ${dealerParam}` };

  return { ok: true, dealerId: String(data.id), dealerKey: data?.name ? String(data.name).trim() : dealerParam };
}

export async function resolveDealerIdForUser(userId: string): Promise<DealerResolution> {
  // 1) profiles.dealer_id (preferred)
  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("dealer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) return { ok: false, error: `profiles lookup failed: ${profErr.message}` };

  const profDealerId = prof?.dealer_id ? String(prof.dealer_id) : null;
  if (profDealerId) {
    const { data: d, error: dErr } = await supabaseAdmin
      .from("dealers")
      .select("name")
      .eq("id", profDealerId)
      .maybeSingle();

    const dealerKey = !dErr && d?.name ? String(d.name).trim() : null;
    return { ok: true, dealerId: profDealerId, dealerKey };
  }

  // 2) fallback: dealers.user_id_uuid OR dealers.user_id
  const { data: dealer, error: dealerErr } = await supabaseAdmin
    .from("dealers")
    .select("id, name, user_id_uuid, user_id")
    .or(`user_id_uuid.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (dealerErr) return { ok: false, error: `dealers lookup failed: ${dealerErr.message}` };
  if (!dealer?.id) return { ok: false, error: "Dealer not found for this user" };

  return {
    ok: true,
    dealerId: String(dealer.id),
    dealerKey: dealer?.name ? String(dealer.name).trim() : null,
  };
}

