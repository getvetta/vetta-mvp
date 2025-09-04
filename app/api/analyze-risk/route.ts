import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are an AI assistant helping a Buy Here Pay Here (BHPH) dealer evaluate a customer's likelihood of making car payments.

Consider:
- Financial stability (job, income consistency, payment history, housing stability)
- Behavior & accountability (do they acknowledge past mistakes and take responsibility?)
- Context (recent setbacks vs. ongoing patterns)
- Classic BHPH risk flags (frequent job changes, unstable contact info, avoidance of direct answers)

Output STRICT JSON ONLY:
{
  "risk": "low" | "medium" | "high",
  "reasoning": "Short, 1-3 sentence justification focused on accountability + stability."
}
`.trim();

type QA = { question: string; answer: string };
type Risk = 'low' | 'medium' | 'high';

function normalizeRisk(v: unknown): Risk {
  const s = String(v || '').toLowerCase();
  if (s === 'low') return 'low';
  if (s === 'high') return 'high';
  return 'medium';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.answers)) {
      return NextResponse.json({ error: 'Invalid input: "answers" must be an array.' }, { status: 400 });
    }

    const answers: QA[] = body.answers.filter((x: any) => x?.question && x?.answer).slice(0, 50);
    if (answers.length === 0) return NextResponse.json({ error: 'No valid Q&A provided.' }, { status: 400 });

    const convo = answers
      .map((qa: QA, i: number) => `${i + 1}. Q: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n')
      .slice(0, 8000);

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: convo }
      ],
      temperature: 0.4,
      max_tokens: 220,
      response_format: { type: 'json_object' }
    });

    const text = res.choices[0]?.message?.content ?? '{}';
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    return NextResponse.json({
      risk: normalizeRisk(parsed.risk),
      reasoning: (parsed.reasoning || 'AI fallback: no reasoning.').toString().slice(0, 600)
    });
  } catch (err) {
    console.error('Analyze risk error:', err);
    return NextResponse.json(
      { error: 'Request failed, please try again.', risk: 'medium', reasoning: 'Server error fallback.' },
      { status: 500 }
    );
  }
}
