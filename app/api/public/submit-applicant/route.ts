// app/api/public/submit-applicant/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const assessmentId = String(body?.assessmentId || "").trim();
    const token = String(body?.token || "").trim();

    if (!assessmentId || !token) {
      return NextResponse.json({ ok: false, error: "Missing assessmentId or token" }, { status: 400 });
    }

    const customerName = String(body?.customerName || "").trim();
    const customerPhone = String(body?.customerPhone || "").trim();
    const vehicle_type = body?.vehicle_type ? String(body.vehicle_type).trim() : null;
    const vehicle_specific = body?.vehicle_specific ? String(body.vehicle_specific).trim() : null;

    // Optional facts object
    const incomingFacts =
      body?.facts && typeof body.facts === "object" && !Array.isArray(body.facts) ? (body.facts as Record<string, any>) : {};

    // 1) Validate token belongs to this assessment
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("assessments")
      .select("id, public_token, facts")
      .eq("id", assessmentId)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 400 });
    }

    if (!existing?.id) {
      return NextResponse.json({ ok: false, error: "Assessment not found" }, { status: 404 });
    }

    if (String(existing.public_token) !== token) {
      return NextResponse.json({ ok: false, error: "Invalid or expired link token" }, { status: 403 });
    }

    const currentFacts =
      existing.facts && typeof existing.facts === "object" && !Array.isArray(existing.facts) ? (existing.facts as any) : {};

    // Merge facts (don’t wipe existing keys)
    const mergedFacts = {
      ...currentFacts,
      ...incomingFacts,
      customer_name: customerName || currentFacts.customer_name,
      customer_phone: customerPhone || currentFacts.customer_phone,
      vehicle_type: vehicle_type ?? currentFacts.vehicle_type ?? null,
      vehicle_specific: vehicle_specific ?? currentFacts.vehicle_specific ?? null,
    };

    // 2) Update the assessment row
    const { error: updErr } = await supabaseAdmin
      .from("assessments")
      .update({
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        vehicle_type: vehicle_type,
        vehicle_specific: vehicle_specific,
        facts: mergedFacts,
        applicant_submitted_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
