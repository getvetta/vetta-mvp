// supabase/functions/create-dealer/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import QRCode from "https://esm.sh/qrcode@1.5.1";
import PDFDocument from "https://esm.sh/pdfkit@0.13.0";
import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";

serve(async (req) => {
  try {
    const { id, email_addresses } = await req.json();
    const email = email_addresses?.[0]?.email_address || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // STEP 1: Insert dealer row
    const { data: dealerData, error: dealerError } = await supabase
      .from("dealers")
      .insert([{ user_id: id, contact_email: email }])
      .select()
      .single();

    if (dealerError) throw dealerError;

    const dealerId = dealerData.id;
    const chatbotUrl = `${Deno.env.get("APP_URL")}/chatbot?dealer=${dealerId}`;

    // STEP 2: Generate QR Code
    const qrBuffer = await QRCode.toBuffer(chatbotUrl, { type: "png" });

    // STEP 3: Generate PDF Card
    const pdfDoc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.fontSize(24).text("Scan to Start Assessment", { align: "center" });
    pdfDoc.moveDown();
    const qrImage = qrBuffer;
    pdfDoc.image(qrImage, pdfDoc.page.width / 2 - 100, 150, { width: 200 });
    pdfDoc.moveDown(2);
    pdfDoc.fontSize(14).text(`Or visit: ${chatbotUrl}`, { align: "center" });
    pdfDoc.end();
    const pdfBuffer = Buffer.concat(chunks);

    // STEP 4: Upload PDF to Supabase Storage
    const fileName = `dealer-cards/${dealerId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("dealer-assets")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("dealer-assets")
      .getPublicUrl(fileName);
    const pdfUrl = publicUrlData.publicUrl;

    // STEP 5: Save PDF URL + QR link to dealer record
    const { error: updateError } = await supabase
      .from("dealers")
      .update({ logo_url: pdfUrl, theme_color: "#1E3A8A" })
      .eq("id", dealerId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ message: "Dealer fully onboarded", pdfUrl }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
});
