import { createClient } from '@supabase/supabase-js'; // Supabase Node.js client
import { NextApiRequest, NextApiResponse } from 'next'; // For typing in Node.js (Next.js)

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// The handler function for the API route
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { dealer_id, scan_time } = req.body;

    if (!dealer_id) {
      return res.status(400).json({ error: 'Missing dealer_id' });
    }

    // Insert scan event into Supabase
    const { data, error } = await supabase.from('dealer_analytics').insert({
      dealer_id,
      event: 'qr_scan',
      timestamp: scan_time ? new Date(scan_time).toISOString() : new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.status(200).json({ message: 'Scan logged', data });
  } catch (error) {
    console.error('Error in log-scan function:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
