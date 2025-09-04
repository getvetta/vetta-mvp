import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ logo_url: null, theme_color: '#1E3A8A', contact_email: null });
  const { data } = await supabaseAdmin.from('dealer_settings').select('*').eq('dealer_id', userId).maybeSingle();
  return NextResponse.json({
    logo_url: data?.logo_url || null,
    theme_color: data?.theme_color || '#1E3A8A',
    contact_email: data?.contact_email || null
  });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const upsert = {
    dealer_id: userId,
    logo_url: body.logo_url ?? null,
    theme_color: body.theme_color ?? '#1E3A8A',
    contact_email: body.contact_email ?? null
  };

  const { error } = await supabaseAdmin.from('dealer_settings').upsert(upsert).eq('dealer_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
