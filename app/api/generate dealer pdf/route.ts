import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { supabase } from "@/utils/supabaseClient";

export async function POST(req: Request) {
  try {
    const { dealerId, url } = await req.json();
    if (!dealerId || !url) {
      return NextResponse.json({ error: "Missing dealerId or url" }, { status: 400 });
    }

    // Generate QR code as base64
    const qrCodeData = await QRCode.toDataURL(url);

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);

      // Upload to Supabase Storage
      const fileName = `dealers/${dealerId}/qr_card.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dealer-pdfs")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("dealer-pdfs")
        .getPublicUrl(fileName);

      // Update dealer record with PDF URL
      await supabase.from("dealers").update({ pdf_url: publicUrlData.publicUrl }).eq("id", dealerId);
    });

    // PDF content
    doc.fontSize(20).text("Scan this QR Code to Start Your Car Financing Assessment", { align: "center" });
    doc.moveDown(2);
    doc.image(qrCodeData, { fit: [250, 250], align: "center", valign: "center" });
    doc.moveDown(1);
    doc.fontSize(14).text(`Or visit: ${url}`, { align: "center", link: url, underline: true });
    doc.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

