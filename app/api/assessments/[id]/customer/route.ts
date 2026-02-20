import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

/**
 * Resolve dealer UUID from public dealer key (dealers.name) or UUID fallback.
 */
async function resolveDealerIdFromKey(dealerKey: string) {
  const key = String(dealerKey || "").trim();
  if (!key) return { dealerId: null as string | null, error: "Missing dealer key" };

  // If it already looks like a UUID, accept it
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
  if (isUuid) return { dealerId: key, error: null as string | null };

  // Otherwise treat as dealers.name
  const { data, error } = await supabaseAdmin
    .from("dealers")
    .select("id")
    .eq("name", key)
    .maybeSingle();

  if (error) return { dealerId: null, error: error.message };
  const dealerId = (data as any)?.id ? String((data as any).id) : null;

  if (!dealerId) return { dealerId: null, error: "Dealer not found for key" };
  return { dealerId, error: null };
}

function normalizePhone(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return null;
  // keep digits only; store as 10-15 digits string
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits : s; // fallback to original if weird
}

/**
 * PATCH /api/assessments/:id/customer?dealer=DEALERKEY
 * Public-safe update for chatbot: writes customer_name/customer_phone onto the correct dealer's assessment.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const assessmentId = String(id || "").trim();
    if (!assessmentId) return NextResponse.json({ ok: false, error: "Missing assessment id" }, { status: 400 });

    const url = new URL(req.url);
    const dealerKey = url.searchParams.get("dealer") || "";
    const { dealerId, error: dealerErr } = await resolveDealerIdFromKey(dealerKey);
    if (!dealerId) return NextResponse.json({ ok: false, error: dealerErr || "Dealer not resolved" }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    // Accept either customer_name OR first/last
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const customerNameRaw = String(body?.customer_name || body?.customerName || "").trim();

    const customer_name =
      customerNameRaw ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      null;

    const customer_phone =
      normalizePhone(body?.customer_phone || body?.customerPhone || body?.phone || "");

    if (!customer_name && !customer_phone) {
      return NextResponse.json(
        { ok: false, error: "Nothing to update (need name and/or phone)" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};
    if (customer_name) updatePayload.customer_name = customer_name;
    if (customer_phone) updatePayload.customer_phone = customer_phone;

    // Only update if this assessment belongs to this dealer
    const { data, error } = await supabaseAdmin
      .from("assessments")
      .update(updatePayload)
      .eq("id", assessmentId)
      .eq("dealer_id", dealerId)
      .select("id, customer_name, customer_phone")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "Assessment not found for dealer" }, { status: 404 });

    return NextResponse.json({ ok: true, assessment: data });
  } catch (e: any) {
    console.error("PATCH /api/assessments/[id]/customer error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
