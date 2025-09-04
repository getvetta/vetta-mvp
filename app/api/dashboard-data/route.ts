import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dealer_id = userId;

  const { data: scans } = await supabaseAdmin
    .from('assessment_events')
    .select('event_type')
    .eq('dealer_id', dealer_id);

  const qr_scans = scans?.filter(e => e.event_type === 'scanned').length ?? 0;
  const assessments_started = scans?.filter(e => e.event_type === 'started').length ?? 0;
  const completed = scans?.filter(e => e.event_type === 'completed').length ?? 0;
  const drop_offs = Math.max(assessments_started - completed, 0);

  const { data: recents } = await supabaseAdmin
    .from('assessments')
    .select('id, risk, answers')
    .eq('dealer_id', dealer_id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    qr_scans, assessments_started, completed, drop_offs,
    recent_assessments: recents ?? []
  });
}

// Optional POST for public assessment save
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  if (body.action === 'save_assessment') {
    const { dealer_id, answers, risk, reasoning } = body;
    if (!dealer_id || !answers || !risk) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const { error } = await supabaseAdmin.from('assessments').insert([{ dealer_id, answers, risk, reasoning }]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
