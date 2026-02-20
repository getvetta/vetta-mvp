// app/api/assessments/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function isMissingColumn(err: any, columnName: string) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("does not exist") && msg.includes("column") && msg.includes(columnName.toLowerCase());
}

async function getAuthedUserId(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { userId: null as string | null, error: "Missing Authorization token" };

  // Service role client can validate a user JWT
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return { userId: null as string | null, error: "Invalid or expired session token" };

  return { userId: data.user.id, error: null as string | null };
}

async function getDealerIdForUser(userId: string) {
  const { data, error } = await supabaseAdmin.from("profiles").select("dealer_id").eq("id", userId).maybeSingle();
  if (error) return { dealerId: null as string | null, error: error.message };

  const dealerId = (data as any)?.dealer_id ? String((data as any).dealer_id) : null;
  if (!dealerId) return { dealerId: null as string | null, error: "profiles.dealer_id missing for this user" };

  return { dealerId, error: null as string | null };
}

/**
 * GET /api/assessments
 * Returns the authenticated dealer's assessments.
 */
export async function GET(req: Request) {
  try {
    const { userId, error: authErr } = await getAuthedUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: authErr || "Not authenticated" }, { status: 401 });

    const { dealerId, error: dealerErr } = await getDealerIdForUser(userId);
    if (!dealerId) return NextResponse.json({ ok: false, error: dealerErr || "Dealer not found" }, { status: 400 });

    // Prefer “new schema”
    const selectNew =
      "id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning, facts, vehicle_type, vehicle_specific, answers";

    // Old schema fallback (minimal, won’t crash if columns missing)
    const selectOld = "id, created_at, status, mode, flow, risk_score, reasoning";

    // 1) Try assessments.dealer_id
    let attempt = await supabaseAdmin
      .from("assessments")
      .select(selectNew)
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });

    // If dealer_id column doesn't exist, try dealership_id
    if (attempt.error && isMissingColumn(attempt.error, "dealer_id")) {
      attempt = await supabaseAdmin
        .from("assessments")
        .select(selectNew)
        .eq("dealership_id", dealerId)
        .order("created_at", { ascending: false });
    }

    // If other columns don't exist (facts/vehicle/etc), fallback to old select
    if (attempt.error && String(attempt.error.message || "").toLowerCase().includes("column")) {
      let attemptOld = await supabaseAdmin
        .from("assessments")
        .select(selectOld)
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false });

      if (attemptOld.error && isMissingColumn(attemptOld.error, "dealer_id")) {
        attemptOld = await supabaseAdmin
          .from("assessments")
          .select(selectOld)
          .eq("dealership_id", dealerId)
          .order("created_at", { ascending: false });
      }

      if (attemptOld.error) {
        return NextResponse.json({ ok: false, error: attemptOld.error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, dealerId, assessments: attemptOld.data || [] });
    }

    if (attempt.error) {
      return NextResponse.json({ ok: false, error: attempt.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, dealerId, assessments: attempt.data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/assessments
 * Creates a new assessment tied to the authenticated dealer.
 */
export async function POST(req: Request) {
  try {
    const { userId, error: authErr } = await getAuthedUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: authErr || "Not authenticated" }, { status: 401 });

    const { dealerId, error: dealerErr } = await getDealerIdForUser(userId);
    if (!dealerId) return NextResponse.json({ ok: false, error: dealerErr || "Dealer not found" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "device").toLowerCase();
    const flow = String(body.flow || "flow1_locked_v2");
    const mode = String(body.mode || (kind === "link" ? "qr" : "device"));

    const insertPayload: Record<string, any> = {
      dealer_id: dealerId, // will fallback below if schema differs
      status: "started",
      flow,
      mode,
      risk_score: "pending",
      created_at: new Date().toISOString(),
    };

    // Try dealer_id insert
    let ins = await supabaseAdmin.from("assessments").insert(insertPayload).select("id").maybeSingle();

    // If dealer_id column doesn't exist, fallback to dealership_id
    if (ins.error && isMissingColumn(ins.error, "dealer_id")) {
      const fixed = { ...insertPayload };
      fixed.dealership_id = fixed.dealer_id;
      delete fixed.dealer_id;

      ins = await supabaseAdmin.from("assessments").insert(fixed as any).select("id").maybeSingle();
    }

    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400 });

    const assessmentId = (ins.data as any)?.id ? String((ins.data as any).id) : null;
    if (!assessmentId) return NextResponse.json({ ok: false, error: "Failed to create assessment" }, { status: 500 });

    return NextResponse.json({ ok: true, dealerId, assessmentId, id: assessmentId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
