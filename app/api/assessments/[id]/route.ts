// app/api/assessments/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

async function getUserIdFromAuth(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { userId: null, error: "Missing auth token”" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { userId: null, error: "Not authenticated" };

  return { userId: data.user.id, error: null };
}

async function getDealerIdForUser(userId: string) {
  const { data, error } = await supabaseAdmin.from("profiles").select("dealer_id").eq("id", userId).maybeSingle();
  if (error) return { dealerId: null, error: error.message };

  const dealerId = (data as any)?.dealer_id ? String((data as any).dealer_id) : null;
  if (!dealerId) return { dealerId: null, error: "profiles.dealer_id missing for this user" };
  return { dealerId, error: null };
}

function isMissingColumn(err: any, columnName: string) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("does not exist") && msg.includes("column") && msg.includes(columnName.toLowerCase());
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const assessmentId = String(id || "").trim();
    if (!assessmentId) return NextResponse.json({ error: "Missing assessment id" }, { status: 400 });

    const { userId, error: authErr } = await getUserIdFromAuth(req);
    if (!userId) return NextResponse.json({ error: authErr || "Unauthorized" }, { status: 401 });

    const { dealerId, error: dealerErr } = await getDealerIdForUser(userId);
    if (!dealerId) return NextResponse.json({ error: dealerErr || "Dealer mapping missing" }, { status: 400 });

    const selectNew =
      "id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning, facts, vehicle_type, vehicle_specific, answers";

    const selectOld =
      "id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning";

    // Try NEW select first using dealer_id
    let attempt = await supabaseAdmin
      .from("assessments")
      .select(selectNew)
      .eq("id", assessmentId)
      .eq("dealer_id", dealerId)
      .maybeSingle();

    // Only fallback to dealership_id if dealer_id column truly missing
    if (attempt.error && isMissingColumn(attempt.error, "dealer_id")) {
      attempt = await supabaseAdmin
        .from("assessments")
        .select(selectNew)
        .eq("id", assessmentId)
        .eq("dealership_id", dealerId)
        .maybeSingle();
    }

    // If selectNew fails due to missing facts/answers columns, retry old select
    if (attempt.error && String(attempt.error.message || "").toLowerCase().includes("column")) {
      let attemptOld = await supabaseAdmin
        .from("assessments")
        .select(selectOld)
        .eq("id", assessmentId)
        .eq("dealer_id", dealerId)
        .maybeSingle();

      if (attemptOld.error && isMissingColumn(attemptOld.error, "dealer_id")) {
        attemptOld = await supabaseAdmin
          .from("assessments")
          .select(selectOld)
          .eq("id", assessmentId)
          .eq("dealership_id", dealerId)
          .maybeSingle();
      }

      if (attemptOld.error) return NextResponse.json({ error: attemptOld.error.message }, { status: 500 });
      if (!attemptOld.data) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

      return NextResponse.json({ ok: true, assessment: attemptOld.data });
    }

    if (attempt.error) return NextResponse.json({ error: attempt.error.message }, { status: 500 });
    if (!attempt.data) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    return NextResponse.json({ ok: true, assessment: attempt.data });
  } catch (e: any) {
    console.error("GET /api/assessments/[id] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
