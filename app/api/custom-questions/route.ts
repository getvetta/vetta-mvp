// app/api/custom-questions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

// GET: Fetch all custom questions for the current dealer
export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, questions: [] }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("custom_questions")
    .select("*")
    .eq("dealer_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, questions: data || [] });
}

// POST: Add a new custom question
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.question) {
    return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("custom_questions").insert([
    { dealer_id: userId, question: body.question },
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: Remove a question by ID
export async function DELETE(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("custom_questions")
    .delete()
    .eq("id", body.id)
    .eq("dealer_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
