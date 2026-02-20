// app/api/start-assessment/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

/** Bearer token helper */
function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function isMissingColumn(err: any, columnName: string) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("does not exist") && msg.includes("column") && msg.includes(columnName.toLowerCase());
}

/** Validate JWT -> user */
async function getAuthedUserId(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { userId: null as string | null, error: "Missing auth token" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return { userId: null as string | null, error: "Not authenticated" };

  return { userId: data.user.id, error: null as string | null };
}

/** Resolve dealer UUID for an authed user (SOURCE OF TRUTH: profiles.dealer_id) */
async function getDealerIdForUser(userId: string) {
  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("dealer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) return { dealerId: null as string | null, error: `profiles lookup failed: ${profErr.message}` };

  const dealerId = (prof as any)?.dealer_id ? String((prof as any).dealer_id) : null;
  if (dealerId) return { dealerId, error: null as string | null };

  const { data: dealer, error: dealerErr } = await supabaseAdmin
    .from("dealers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (dealerErr) return { dealerId: null as string | null, error: `dealers lookup failed: ${dealerErr.message}` };

  const fallbackId = (dealer as any)?.id ? String((dealer as any).id) : null;
  if (!fallbackId) return { dealerId: null as string | null, error: "Dealer not found for this user" };

  return { dealerId: fallbackId, error: null as string | null };
}

/** Public dealer key -> dealer UUID (supports name, and slug if it exists) */
async function getDealerIdFromPublicKey(dealerKey: string) {
  const key = String(dealerKey || "").trim();
  if (!key) return { dealerId: null as string | null, error: "Missing dealer key" };

  // name
  let attempt = await supabaseAdmin.from("dealers").select("id").eq("name", key).maybeSingle();
  if (!attempt.error && attempt.data?.id) {
    return { dealerId: String((attempt.data as any).id), error: null as string | null };
  }

  // slug (optional)
  attempt = await supabaseAdmin.from("dealers").select("id").eq("slug" as any, key).maybeSingle();
  if (attempt.error && isMissingColumn(attempt.error, "slug")) {
    return { dealerId: null as string | null, error: "Dealer not found (slug missing + name mismatch)" };
  }
  if (!attempt.error && attempt.data?.id) {
    return { dealerId: String((attempt.data as any).id), error: null as string | null };
  }

  return { dealerId: null as string | null, error: "Dealer not found for this link" };
}

/** dealerId -> preferred public key (dealers.name). If missing, return dealerId */
async function getDealerKeyFromDealerId(dealerId: string) {
  const { data, error } = await supabaseAdmin.from("dealers").select("name").eq("id", dealerId).maybeSingle();
  if (error) return dealerId;
  const key = String((data as any)?.name || "").trim();
  return key || dealerId;
}

/** Insert assessment with schema fallback dealer_id vs dealership_id (only if column truly missing) */
async function insertAssessmentRow(payload: Record<string, any>) {
  let ins = await supabaseAdmin
    .from("assessments")
    .insert(payload)
    .select("id, dealer_id, status, mode, flow, created_at, customer_name, customer_phone")
    .maybeSingle();

  if (ins.error && isMissingColumn(ins.error, "dealer_id")) {
    const fixed = { ...payload, dealership_id: payload.dealer_id };
    delete fixed.dealer_id;

    ins = await supabaseAdmin
      .from("assessments")
      .insert(fixed as any)
      .select("id, dealership_id, status, mode, flow, created_at, customer_name, customer_phone")
      .maybeSingle();
  }

  return ins;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const kindRaw = String(body?.kind || "device").toLowerCase().trim();
    const mode = kindRaw === "link" || kindRaw === "qr" ? "qr" : "device";

    const flow = "flow1_locked_v2";

    // Optional customer info
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const phone = String(body?.phone || "").trim();

    const customer_name =
      (firstName || lastName ? `${firstName} ${lastName}`.trim() : "") ||
      String(body?.customer_name || "").trim() ||
      null;

    const customer_phone = phone || String(body?.customer_phone || "").trim() || null;

    const token = getBearerToken(req);

    let dealerId: string | null = null;
    let dealerKey: string | null = null;

    if (token) {
      // Dealer-auth start
      const { userId, error: authErr } = await getAuthedUserId(req);
      if (!userId) return NextResponse.json({ ok: false, error: authErr || "Not authenticated" }, { status: 401 });

      const { dealerId: did, error: dealerErr } = await getDealerIdForUser(userId);
      if (!did) return NextResponse.json({ ok: false, error: dealerErr || "Dealer resolution failed" }, { status: 400 });

      dealerId = did;
      dealerKey = await getDealerKeyFromDealerId(dealerId);
    } else {
      // Public start (QR/link)
      const publicDealerKey = String(body?.dealer || "").trim();
      if (!publicDealerKey) return NextResponse.json({ ok: false, error: "Missing dealer (public link)" }, { status: 400 });

      const { dealerId: did, error: dealerErr } = await getDealerIdFromPublicKey(publicDealerKey);
      if (!did) return NextResponse.json({ ok: false, error: dealerErr || "Dealer not found" }, { status: 404 });

      dealerId = did;
      dealerKey = publicDealerKey;
    }

    const payload: Record<string, any> = {
      dealer_id: dealerId,
      status: "started",
      mode,
      flow,
      risk_score: "pending",
      created_at: new Date().toISOString(),
    };

    // Save name/phone if provided
    if (customer_name) payload.customer_name = customer_name;
    if (customer_phone) payload.customer_phone = customer_phone;

    const { data: row, error: insErr } = await insertAssessmentRow(payload);

    if (insErr || !row?.id) {
      return NextResponse.json({ ok: false, error: insErr?.message || "Insert failed" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,

      // compatibility
      id: row.id,
      mode,

      dealerId,
      dealerKey: dealerKey || dealerId,
      assessmentId: row.id,
      status: row.status,
      flow: row.flow,
      created_at: row.created_at,

      customer_name: (row as any)?.customer_name ?? customer_name ?? null,
      customer_phone: (row as any)?.customer_phone ?? customer_phone ?? null,
    });
  } catch (e: any) {
    console.error("start-assessment error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
