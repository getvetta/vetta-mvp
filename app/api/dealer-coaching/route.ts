// app/api/dealer-coaching/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/utils/supabaseAdmin";
import { openai } from "@/utils/openaiClient";

/**
 * Extract authenticated Supabase user (JWT from Authorization header)
 */
async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
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

/**
 * GET — Dealer coaching tips based on funnel stats + recent risks
 */
export async function GET(req: Request) {
  const user = await getUser(req);

  // If not logged in, just return null coaching (front-end can handle this)
  if (!user) {
    return NextResponse.json({ coaching: null }, { status: 401 });
  }

  // In this setup we treat the Supabase auth user.id as the dealer_id
  const dealer_id = user.id;

  // Pull funnel events
  const { data: events, error: eventsError } = await supabaseAdmin
    .from("assessment_events")
    .select("event_type")
    .eq("dealer_id", dealer_id);

  if (eventsError) {
    console.error("dealer-coaching events error →", eventsError);
  }

  // Pull recent assessments (up to 50) for risk distribution
  const { data: recent, error: recentError } = await supabaseAdmin
    .from("assessments")
    .select("risk")
    .eq("dealer_id", dealer_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (recentError) {
    console.error("dealer-coaching recent error →", recentError);
  }

  const stats = {
    scans: events?.filter((e) => e.event_type === "scanned").length ?? 0,
    started: events?.filter((e) => e.event_type === "started").length ?? 0,
    completed: events?.filter((e) => e.event_type === "completed").length ?? 0,
    risk_low: recent?.filter((r) => r.risk === "low").length ?? 0,
    risk_med: recent?.filter((r) => r.risk === "medium").length ?? 0,
    risk_high: recent?.filter((r) => r.risk === "high").length ?? 0,
  };

  const prompt = `
Dealer funnel stats: ${JSON.stringify(stats)}

Give 2–4 short, practical coaching tips to improve completion and lower high-risk outcomes for a BHPH dealer. 
Be specific and tactical. Keep it concise.
`.trim();

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a concise, practical dealership operations coach.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 220,
    });

    const coaching = res.choices[0]?.message?.content ?? null;
    return NextResponse.json({ coaching });
  } catch (err) {
    console.error("dealer-coaching OpenAI error →", err);
    return NextResponse.json({ coaching: null }, { status: 200 });
  }
}
