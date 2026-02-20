// app/api/custom-questions/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.replace("Bearer ", "");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function getDealerIdForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("dealer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return (data?.dealer_id as string | null) ?? null;
}

async function getQuestions(dealerId: string) {
  const { data } = await supabaseAdmin
    .from("custom_questions")
    .select("id, question")
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: true });

  return data || [];
}

async function getPreferences(dealerId: string) {
  const { data } = await supabaseAdmin
    .from("dealer_preferences")
    .select(
      "min_down_payment, min_employment_months, min_residence_months, require_proof_of_income, require_references, notes"
    )
    .eq("dealer_id", dealerId)
    .maybeSingle();

  // If no row exists yet, return sensible defaults
  return (
    data || {
      min_down_payment: 0,
      min_employment_months: 0,
      min_residence_months: 0,
      require_proof_of_income: false,
      require_references: false,
      notes: null,
    }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dealerParam = url.searchParams.get("dealer"); // expects dealers.id

  const user = await getUser(req);

  // ✅ Public customer GET (no auth)
  if (!user) {
    if (!dealerParam || dealerParam === "demo") {
      return NextResponse.json({
        ok: true,
        mode: "demo",
        questions: [],
        preferences: {
          min_down_payment: 0,
          min_employment_months: 0,
          min_residence_months: 0,
          require_proof_of_income: false,
          require_references: false,
          notes: null,
        },
      });
    }

    const [questions, preferences] = await Promise.all([
      getQuestions(dealerParam),
      getPreferences(dealerParam),
    ]);

    return NextResponse.json({ ok: true, mode: "normal", questions, preferences });
  }

  // ✅ Dealer GET (auth) uses mapping
  const dealerId = await getDealerIdForUser(user.id);
  if (!dealerId) {
    return NextResponse.json({
      ok: true,
      mode: "normal",
      questions: [],
      preferences: {
        min_down_payment: 0,
        min_employment_months: 0,
        min_residence_months: 0,
        require_proof_of_income: false,
        require_references: false,
        notes: null,
      },
    });
  }

  const [questions, preferences] = await Promise.all([
    getQuestions(dealerId),
    getPreferences(dealerId),
  ]);

  return NextResponse.json({ ok: true, mode: "normal", questions, preferences });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealerId = await getDealerIdForUser(user.id);
  if (!dealerId) return NextResponse.json({ error: "Missing profiles.dealer_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  if (!body?.question) return NextResponse.json({ error: "Missing question" }, { status: 400 });

  await supabaseAdmin.from("custom_questions").insert({
    dealer_id: dealerId,
    question: String(body.question),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealerId = await getDealerIdForUser(user.id);
  if (!dealerId) return NextResponse.json({ error: "Missing profiles.dealer_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await supabaseAdmin
    .from("custom_questions")
    .delete()
    .eq("id", body.id)
    .eq("dealer_id", dealerId);

  return NextResponse.json({ ok: true });
}
