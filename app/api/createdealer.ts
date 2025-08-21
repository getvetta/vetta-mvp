iimport { createClient } from '@supabase/supabase-js'; // Supabase Node.js client
import QRCode from 'qrcode'; // QRCode library for Node.js
import PDFDocument from 'pdfkit'; // PDFKit library for Node.js
import { Buffer } from 'buffer'; // Buffer from Node.js
import OpenAI from 'openai'; // OpenAI Node.js SDK

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!, // Use environment variable for API key
});

// The function to handle the dealer onboarding
export default async function handler(req: any, res: any) {
  try {
    const { id, email_addresses } = req.body;
    const email = email_addresses?.[0]?.email_address || null;

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,  
      process.env.SUPABASE_SERVICE_ROLE_KEY!  
    );

    // STEP 1: Insert dealer row into Supabase
    const { data: dealerData, error: dealerError } = await supabase
      .from("dealers")
      .insert([{ user_id: id, contact_email: email }])
      .select()
      .single();

    if (dealerError) throw dealerError;

    const dealerId = dealerData.id;
    const chatbotUrl = `${process.env.APP_URL}/chatbot?dealer=${dealerId}`;

    // STEP 2: Generate QR Code
    const qrBuffer = await QRCode.toBuffer(chatbotUrl, { type: "png" });

    // STEP 3: Generate GPT-5 Personalized Onboarding Message
    const onboardingPrompt = `
You are a helpful AI assistant for a Buy Here Pay Here dealership.
Create a personalized onboarding message for a new dealer.

Dealer ID: ${dealerId}
Email: ${email}

Please provide a friendly and welcoming message for the dealer to encourage them to start using the platform.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: onboardingPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const onboardingMessage = completion.choices[0]?.message?.content;
    if (!onboardingMessage) {
      throw new Error("Failed to generate onboarding message using GPT-5");
    }

    // STEP 4: Generate PDF Card
    const pdfDoc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.fontSize(24).text("Scan to Start Assessment", { align: "center" });
    pdfDoc.moveDown();
    pdfDoc.image(qrBuffer, pdfDoc.page.width / 2 - 100, 150, { width: 200 });
    pdfDoc.moveDown(2);
    pdfDoc.fontSize(14).text(`Or visit: ${chatbotUrl}`, { align: "center" });
    pdfDoc.moveDown(2);
    pdfDoc.fontSize(18).text(onboardingMessage, { align: "center" });
    pdfDoc.end();
    const pdfBuffer = Buffer.concat(chunks);

    // STEP 5: Upload PDF to Supabase Storage
    const fileName = `dealer-cards/${dealerId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("dealer-assets")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("dealer-assets")
      .getPublicUrl(fileName);
    const pdfUrl = publicUrlData.publicUrl;

    // STEP 6: Save PDF URL + QR link to dealer record
    const { error: updateError } = await supabase
      .from("dealers")
      .update({ logo_url: pdfUrl, theme_color: "#1E3A8A" })
      .eq("id", dealerId);

    if (updateError) throw updateError;

    // Send the response back to the client
    res.status(200).json({ message: "Dealer fully onboarded", pdfUrl, onboardingMessage });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

