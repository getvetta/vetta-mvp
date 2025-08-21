import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

export async function POST(req: Request) {
  try {
    const { dealerId } = await req.json();

    // QR Scans
    const { count: scans } = await supabase
      .from('qr_scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealerId);

    // Assessments Started
    const { count: started } = await supabase
      .from('assessment_progress')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealerId);

    // Completed Assessments
    const { count: completed } = await supabase
      .from('assessment_progress')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealerId)
      .not('completed_at', 'is', null);

    const dropped = (started || 0) - (completed || 0);

    return NextResponse.json({
      scans: scans || 0,
      started: started || 0,
      completed: completed || 0,
      dropped: dropped < 0 ? 0 : dropped,
    });
  } catch (err) {
    console.error('Dealer stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch dealer stats' }, { status: 500 });
  }
}
