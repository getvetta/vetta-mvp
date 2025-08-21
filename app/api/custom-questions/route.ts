import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';
import { auth } from '@clerk/nextjs';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('custom_questions')
    .select('id, question')
    .eq('dealer_id', userId);

  return NextResponse.json({ questions: data || [] });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 });

  const { data, error } = await supabase
    .from('custom_questions')
    .insert([{ dealer_id: userId, question }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ question: data[0] });
}

export async function DELETE(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Question ID required' }, { status: 400 });

  const { error } = await supabase
    .from('custom_questions')
    .delete()
    .eq('id', id)
    .eq('dealer_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
