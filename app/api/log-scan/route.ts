import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { dealer_id, event_type } = await req.json();
    if (!dealer_id || !event_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const { error } = await supabaseAdmin.from('assessment_events').insert([{ dealer_id, event_type }]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
