// app/api/assessments/progress/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Progress save:
 * - Merges incoming facts into existing facts JSON
 * - Optionally writes answers transcript
 * - Updates status
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const assessmentId = String(body?.assessmentId || "").trim();
    const facts = body?.facts && typeof body.facts === "object" ? body.facts : null;
    const answers = Array.isArray(body?.answers) ? body.answers : null;
    const status = String(body?.status || "in_progress").trim() || "in_progress";

    if (!assessmentId) return NextResponse.json({ error: "Missing assessmentId" }, { status: 400 });

    const supabase = admin();

    const existing = await supabase.from("assessments").select("id, facts").eq("id", assessmentId).maybeSingle();
    if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
    if (!existing.data?.id) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    const prevFacts =
      (existing.data as any)?.facts && typeof (existing.data as any).facts === "object" ? (existing.data as any).facts : {};

    const mergedFacts = facts ? { ...prevFacts, ...facts } : prevFacts;

    const updatePayload: Record<string, any> = {
      status,
      facts: mergedFacts,
    };

    if (answers) updatePayload.answers = answers;

    const upd = await supabase.from("assessments").update(updatePayload).eq("id", assessmentId);
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
