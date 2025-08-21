import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';
import { auth } from '@clerk/nextjs';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('dealers')
    .select('logo_url, theme_color, contact_email')
    .eq('id', userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { logo_url, theme_color, contact_email } = await req.json();

  const { data, error } = await supabase
    .from('dealers')
    .update({ logo_url, theme_color, contact_email })
    .eq('id', userId)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}
