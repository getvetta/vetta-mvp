// app/api/assessments/intro/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Intro save:
 * - Ensures assessment exists
 * - Writes both top-level columns AND facts JSON
 * - Uses consistent keys across app (dashboard + chatbot + analyze)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const assessmentId = String(body?.assessmentId || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const customerPhone = String(body?.customerPhone || "").trim();
    const vehicleType = String(body?.vehicleType || "").trim();
    const vehicleSpecific = String(body?.vehicleSpecific || "").trim();

    if (!assessmentId) return NextResponse.json({ error: "Missing assessmentId" }, { status: 400 });
    if (!customerName || !customerPhone) return NextResponse.json({ error: "Missing customer name or phone" }, { status: 400 });
    if (!vehicleType) return NextResponse.json({ error: "Missing vehicle type" }, { status: 400 });

    const supabase = admin();

    // Ensure assessment exists
    const existing = await supabase.from("assessments").select("id, facts, status").eq("id", assessmentId).maybeSingle();
    if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
    if (!existing.data?.id) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    const prevFacts =
      (existing.data as any)?.facts && typeof (existing.data as any).facts === "object" ? (existing.data as any).facts : {};

    const nextFacts = {
      ...prevFacts,
      // ✅ keep these inside facts too for dashboard + analysis consistency
      customer_name: customerName,
      customer_phone: customerPhone,
      vehicle_type: vehicleType,
      vehicle_specific: vehicleSpecific || null,
    };

    const nextStatus = String((existing.data as any)?.status || "").trim() || "started";

    // Update the main columns + facts for dashboard compatibility
    const upd = await supabase
      .from("assessments")
      .update({
        customer_name: customerName,
        customer_phone: customerPhone,
        vehicle_type: vehicleType,
        vehicle_specific: vehicleSpecific || null,
        status: nextStatus,
        facts: nextFacts,
      })
      .eq("id", assessmentId)
      .select("id")
      .maybeSingle();

    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
