// app/api/create-dealer/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id || !body?.email) {
      return NextResponse.json(
        { error: 'Missing "id" and "email"' },
        { status: 400 }
      );
    }

    const { id, email } = body;

    // Check existing dealer
    const { data: existing } = await supabaseAdmin
      .from("dealers")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, dealer: existing });
    }

    const { data, error } = await supabaseAdmin
      .from("dealers")
      .insert([
        {
          user_id: id,
          contact_email: email,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, dealer: data });
  } catch (err: any) {
    console.error("create-dealer error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
