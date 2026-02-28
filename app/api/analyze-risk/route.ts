// app/api/analyze-risk/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

type Risk = "low" | "medium" | "high";

type AnalyzeBody = {
  assessmentId?: string | null;
  dealer?: string;
  dealerName?: string;
  customerName?: string | null;
  customerPhone?: string | null;

  // facts coming from chat/turn + progress endpoints
  facts?: any;

  // transcript (optional)
  answers?: any; // jsonb array of msgs
};

type ModelOut = {
  risk_score: Risk;
  risk_score_numeric: number; // 0-100 (higher = safer)
  result_summary: string;
  pros: [string, string];
  cons: [string, string];
  reasoning: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function json(res: any, status = 200) {
  return NextResponse.json(res, { status });
}

function safeObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function coerceRisk(v: any): Risk {
  const t = String(v || "").toLowerCase().trim();
  if (t === "low" || t === "medium" || t === "high") return t;
  return "medium";
}

function coerceTwoStrings(v: any, fallbackA = "Not provided", fallbackB = "Not provided"): [string, string] {
  const arr = Array.isArray(v) ? v : [];
  const a = String(arr?.[0] ?? fallbackA).trim() || fallbackA;
  const b = String(arr?.[1] ?? fallbackB).trim() || fallbackB;
  return [a, b];
}

function hardLimit(s: string, max = 140) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

// --- PROS must be NON-FINANCIAL (server-enforced) ---
function isFinancialText(s: string) {
  const t = String(s || "").toLowerCase();
  const bad = [
    "income",
    "paycheck",
    "salary",
    "wages",
    "bills",
    "expenses",
    "afford",
    "affordability",
    "pti",
    "bti",
    "ratio",
    "budget",
    "payment",
    "down payment",
    "cash down",
    "rent",
    "utilities",
    "electric",
    "water",
    "wifi",
    "phone bill",
    "subscription",
    "groceries",
    "eat out",
  ];
  return bad.some((w) => t.includes(w));
}

function enforceNonFinancialPros(pros: [string, string]): [string, string] {
  const cleaned = pros.map((p) => hardLimit(String(p || "").trim(), 140)).filter(Boolean);

  const nonFinancial = cleaned.filter((p) => !isFinancialText(p));
  if (nonFinancial.length >= 2) return [nonFinancial[0], nonFinancial[1]];

  if (nonFinancial.length === 1) return [nonFinancial[0], "Not provided"];
  return ["Not provided", "Not provided"];
}

function buildSystemPrompt() {
  return `
You are Vetta's risk analyst for Buy Here Pay Here dealerships.
Return ONLY valid JSON (no markdown).

Goal: give a clear result summary + exactly 2 pros + exactly 2 cons based on the applicant facts and transcript.

JSON schema:
{
  "risk_score": "low" | "medium" | "high",
  "risk_score_numeric": number,        // 0-100 (higher = safer)
  "result_summary": string,            // 2-4 sentences, plain English
  "pros": [string, string],            // exactly 2, concise
  "cons": [string, string],            // exactly 2, concise
  "reasoning": string                  // 4-10 bullet lines or short paragraphs
}

CRITICAL RULES:
1) Pros must be NON-FINANCIAL ONLY.
   - Do NOT mention: income, paycheck, salary, wages, bills, affordability, PTI/BTI, debt, rent amount, utilities amounts,
     down payment, cash down, "can afford", "budget", "payment amount".
   - Pros should be about stability + responsibility + intent + communication + verification + trust signals.
   Examples of valid Pros:
   - "Consistent job tenure and clear employer details"
   - "Strong responsibility mindset in the repair scenario"
   - "Has a support system to stay on track"
   - "License in-state and commute is reasonable"
   - "Vehicle purpose aligns with work/responsibilities"
   - "Provides a reachable reference contact"

2) Cons CAN be financial or non-financial.

3) If you do not have enough non-financial positives, write "Not provided" but still return exactly 2 pros.

STYLE:
- Pros/Cons must be grounded in facts/transcript.
- Pros/Cons must be <= 140 characters each.
- Keep language dealership-friendly.
`.trim();
}

function buildUserPayload(input: { facts: any; answers: any; customerName?: string | null; customerPhone?: string | null }) {
  const facts = safeObject(input.facts);
  const answers = Array.isArray(input.answers) ? input.answers : [];

  return {
    customer: {
      name: input.customerName ?? null,
      phone: input.customerPhone ?? null,
    },
    facts,
    transcript: answers,
  };
}

function parseModelJson(raw: string): any {
  // try direct JSON first
  try {
    return JSON.parse(raw);
  } catch {}

  // fallback: extract first {...} block
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as AnalyzeBody;

    const assessmentId = String(body.assessmentId || "").trim();
    if (!assessmentId) return json({ ok: false, error: "Missing assessmentId" }, 400);

    // Load assessment (so we can merge facts/answers if caller didn't send them)
    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("assessments")
      .select("id, customer_name, customer_phone, facts, answers, risk_score, reasoning, status")
      .eq("id", assessmentId)
      .maybeSingle();

    if (loadErr) return json({ ok: false, error: loadErr.message }, 500);
    if (!existing) return json({ ok: false, error: "Assessment not found" }, 404);

    const facts = Object.keys(safeObject(body.facts)).length ? safeObject(body.facts) : safeObject((existing as any).facts);
    const answers = Array.isArray(body.answers) && body.answers.length ? body.answers : (existing as any).answers;

    const customerName = body.customerName ?? (existing as any).customer_name ?? null;
    const customerPhone = body.customerPhone ?? (existing as any).customer_phone ?? null;

    const system = buildSystemPrompt();
    const user = JSON.stringify(buildUserPayload({ facts, answers, customerName, customerPhone }), null, 2);

    const completion = await openai.chat.completions.create({
      model: process.env.VETTA_RISK_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = parseModelJson(raw);

    if (!parsed) {
      return json(
        {
          ok: false,
          error: "Model returned invalid JSON",
          raw,
        },
        500
      );
    }

    const out: ModelOut = {
      risk_score: coerceRisk(parsed.risk_score),
      risk_score_numeric: clamp(Number(parsed.risk_score_numeric ?? 50) || 50, 0, 100),
      result_summary: String(parsed.result_summary || "").trim() || "Not provided",
      pros: coerceTwoStrings(parsed.pros, "Not provided", "Not provided"),
      cons: coerceTwoStrings(parsed.cons, "Not provided", "Not provided"),
      reasoning: String(parsed.reasoning || "").trim() || "Not provided",
    };

    // enforce your rule (Pros cannot be financial)
    out.pros = enforceNonFinancialPros(out.pros);

    // clean length limits
    out.result_summary = String(out.result_summary).trim();
    out.pros = [hardLimit(out.pros[0], 140), hardLimit(out.pros[1], 140)];
    out.cons = [hardLimit(out.cons[0], 140), hardLimit(out.cons[1], 140)];

    // Put structured summary into facts.analysis so the UI can render cleanly
    const existingFacts = safeObject((existing as any).facts);
    const nextFacts = {
      ...existingFacts,
      ...safeObject(facts),
      analysis: {
        result_summary: out.result_summary,
        pros: out.pros,
        cons: out.cons,
        risk_score_numeric: out.risk_score_numeric,
      },
    };

    // Also write a readable "reasoning" string (so your current UI still works even before you update it)
    const reasoningText = [
      `Summary: ${out.result_summary}`,
      ``,
      `Pros:`,
      `- ${out.pros[0]}`,
      `- ${out.pros[1]}`,
      ``,
      `Cons:`,
      `- ${out.cons[0]}`,
      `- ${out.cons[1]}`,
      ``,
      `Details:`,
      `${out.reasoning}`,
    ].join("\n");

    // IMPORTANT: We DO NOT reference updated_at anywhere (your table doesn't have it).
    const { error: updErr } = await supabaseAdmin
      .from("assessments")
      .update({
        risk_score: out.risk_score,
        reasoning: reasoningText,
        facts: nextFacts,
        status: "completed",
      })
      .eq("id", assessmentId);

    if (updErr) {
      return json({ ok: false, error: updErr.message }, 500);
    }

    return json({
      ok: true,
      assessmentId,
      risk_score: out.risk_score,
      risk_score_numeric: out.risk_score_numeric,
      result_summary: out.result_summary,
      pros: out.pros,
      cons: out.cons,
      reasoning: reasoningText,
    });
  } catch (e: any) {
    console.error("analyze-risk error:", e);
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
}