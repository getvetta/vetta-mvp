import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { openai } from '@/utils/openaiClient';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ coaching: null });

  const dealer_id = userId;

  const { data: events } = await supabaseAdmin
    .from('assessment_events')
    .select('event_type')
    .eq('dealer_id', dealer_id);

  const { data: recent } = await supabaseAdmin
    .from('assessments')
    .select('risk')
    .eq('dealer_id', dealer_id)
    .order('created_at', { ascending: false })
    .limit(50);

  const stats = {
    scans: events?.filter(e => e.event_type === 'scanned').length ?? 0,
    started: events?.filter(e => e.event_type === 'started').length ?? 0,
    completed: events?.filter(e => e.event_type === 'completed').length ?? 0,
    risk_low: recent?.filter(r => r.risk === 'low').length ?? 0,
    risk_med: recent?.filter(r => r.risk === 'medium').length ?? 0,
    risk_high: recent?.filter(r => r.risk === 'high').length ?? 0
  };

  const prompt = `
Dealer funnel stats: ${JSON.stringify(stats)}

Give 2-4 short, practical coaching tips to improve completion and lower high-risk outcomes for a BHPH dealer. Keep it concise.
`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a concise dealership operations coach.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 220
    });

    const coaching = res.choices[0]?.message?.content ?? null;
    return NextResponse.json({ coaching });
  } catch {
    return NextResponse.json({ coaching: null });
  }
}
