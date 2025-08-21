import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function uploadPdf(dealerId: string, pdfBuffer: Uint8Array): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('dealer-pdfs')
    .upload(`dealers/${dealerId}/qr.pdf`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }

  const { data: publicUrl } = supabase.storage
    .from('dealer-pdfs')
    .getPublicUrl(`dealers/${dealerId}/qr.pdf`);

  return publicUrl?.publicUrl || null;
}
