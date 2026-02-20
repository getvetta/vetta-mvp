import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function getDealerIdForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("dealer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { dealerId: null as string | null, error: error.message };
  const dealerId = (data?.dealer_id as string | null) ?? null;
  if (!dealerId) return { dealerId: null, error: "profiles.dealer_id missing for this user" };
  return { dealerId, error: null as string | null };
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealerId, error: dealerErr } = await getDealerIdForUser(user.id);
  if (!dealerId) return NextResponse.json({ error: dealerErr || "Dealer not linked" }, { status: 400 });

  // events
  const { data: events, error: eventsErr } = await supabaseAdmin
    .from("assessment_events")
    .select("event_type")
    .eq("dealer_id", dealerId);

  if (eventsErr) console.error("Dashboard events error:", eventsErr);

  const qr_scans = events?.filter((e) => e.event_type === "scanned").length ?? 0;
  const assessments_started = events?.filter((e) => e.event_type === "started").length ?? 0;
  const completed = events?.filter((e) => e.event_type === "completed").length ?? 0;
  const drop_offs = Math.max(assessments_started - completed, 0);

  // recents
  const { data: recents, error: recentsErr } = await supabaseAdmin
    .from("assessments")
    .select("id, created_at, customer_name, customer_phone, status, risk_score")
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (recentsErr) console.error("Dashboard recents error:", recentsErr);

  return NextResponse.json({
    qr_scans,
    assessments_started,
    completed,
    drop_offs,
    recent_assessments: recents ?? [],
  });
}
