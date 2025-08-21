import { createClient } from '@supabase/supabase-js'; // Supabase Node.js client
import OpenAI from 'openai'; // OpenAI Node.js SDK
import { NextApiRequest, NextApiResponse } from 'next'; // For typing in Node.js (Next.js)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// The handler function for the API route
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { dealer_id, customer_answers } = req.body;

    if (!dealer_id || !customer_answers) {
      return res.status(400).json({ error: "Missing dealer_id or customer_answers" });
    }

    // Compose the prompt for OpenAI
    const prompt = `
You are an AI risk assessment assistant for Buy Here Pay Here dealerships.
Given the following customer answers, provide a risk score (Low, Medium, High) and a short explanation.

Customer answers:
${JSON.stringify(customer_answers, null, 2)}

Respond with JSON:
{
  "risk_score": "Low" | "Medium" | "High",
  "explanation": "..."
}
`;

    // Update the model to GPT-5
    const completion = await openai.chat.completions.create({
      model: "gpt-5", // Updated model to GPT-5
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const textResponse = completion.choices[0]?.message?.content;
    if (!textResponse) {
      throw new Error("No response from OpenAI");
    }

    let riskData;
    try {
      riskData = JSON.parse(textResponse);
    } catch {
      // If parsing fails, return raw text as fallback
      riskData = {
        risk_score: "Unknown",
        explanation: textResponse,
      };
    }

    // Store assessment result in Supabase (optional)
    await supabase.from("assessments").insert({
      dealer_id,
      answers: customer_answers,
      risk_score: riskData.risk_score,
      explanation: riskData.explanation,
      created_at: new Date().toISOString(),
    });

    return res.status(200).json(riskData);
  } catch (error) {
    console.error("Error in analyze-risk function:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
