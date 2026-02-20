// app/api/analyze-risk/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

type Risk = "low" | "medium" | "high";

/**
 * ======================================================
 * NEW WEIGHTS — BHPH OPTIMIZED
 * ======================================================
 */
const WEIGHTS = {
  credit_context: 30,
  ability_to_pay: 25,
  stability: 20,
  compliance: 5,
  commitment: 20,
} as const;

type Facts = {
  customer_name?: string | null;
  customer_phone?: string | null;

  vehicle_type?: string | null;
  vehicle_specific?: string | null;

  job_title?: string | null;
  employer_name?: string | null;
  commute_minutes?: number | null;
  employment_months?: number | null;

  residence_type?: "rent" | "own" | "family" | null;
  residence_months?: number | null;

  has_driver_license?: boolean | null;
  license_state_match?: boolean | null;

  pay_frequency?: "weekly" | "biweekly" | "monthly" | null;
  income_amount?: number | null;
  income_monthly?: number | null;

  housing_payment_monthly?: number | null;
  cell_phone_bill?: number | null;
  subscriptions_bill?: number | null;
  water_bill?: number | null;
  electric_bill?: number | null;
  wifi_bill?: number | null;
  bills_monthly?: number | null;

  down_payment?: number | null;

  credit_importance?: number | null;
  credit_below_reason?: string | null;

  // NEW STRONG QUESTIONS
  auto_financing_history?: string | null;
  vehicle_priority?: string | null;
  bad_deal_definition?: string | null;
  vehicle_approved_help?: string | null;

  mechanical_failure_plan?: string | null;
  support_system?: boolean | null;
  spouse_cosigner?: boolean | null;

  vehicle_reference_available?: boolean | null;
  vehicle_reference_relation?: string | null;
};

/* =======================================================
   Utility
======================================================= */

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeLower(s: any) {
  return String(s ?? "").toLowerCase();
}

function freqToMonthly(freq: Facts["pay_frequency"]) {
  if (freq === "weekly") return 4.33;
  if (freq === "biweekly") return 2.165;
  return 1;
}

function deriveIncomeMonthly(f: Facts) {
  if (!f.income_amount) return null;
  return f.income_amount * freqToMonthly(f.pay_frequency ?? "monthly");
}

function deriveBillsMonthly(f: Facts) {
  const sum =
    (num(f.housing_payment_monthly) ?? 0) +
    (num(f.cell_phone_bill) ?? 0) +
    (num(f.subscriptions_bill) ?? 0) +
    (num(f.water_bill) ?? 0) +
    (num(f.electric_bill) ?? 0) +
    (num(f.wifi_bill) ?? 0);

  return sum > 0 ? sum : null;
}

function bti(f: Facts) {
  const income = deriveIncomeMonthly(f);
  const bills = deriveBillsMonthly(f);
  if (!income || !bills) return null;
  return bills / income;
}

/* =======================================================
   CREDIT CONTEXT (30%)
======================================================= */

function scoreCreditContext(f: Facts) {
  let s = 50;

  const hist = safeLower(f.auto_financing_history);

  if (hist.includes("a -")) s += 10;
  else if (hist.includes("b -")) s -= 8;
  else if (hist.includes("c -")) s -= 18;
  else if (hist.includes("d -")) s += 2;

  const reason = safeLower(f.credit_below_reason);
  if (reason.includes("repo")) s -= 8;
  if (reason.includes("late")) s -= 5;

  const ci = num(f.credit_importance);
  if (ci != null) {
    if (ci >= 8) s += 3;
    if (ci <= 3) s -= 3;
  }

  return clamp(s, 0, 100);
}

/* =======================================================
   ABILITY TO PAY (25%)
======================================================= */

function scoreAbility(f: Facts) {
  let s = 60;

  const ratio = bti(f);
  if (ratio != null) {
    if (ratio <= 0.35) s += 20;
    else if (ratio <= 0.5) s += 8;
    else if (ratio < 0.6) s -= 8;
    else s -= 25;
  }

  const down = num(f.down_payment);
  if (down != null) {
    if (down >= 2000) s += 15;
    else if (down >= 1000) s += 6;
    else if (down < 800) s -= 10;
  }

  return clamp(s, 0, 100);
}

/* =======================================================
   STABILITY (20%)
======================================================= */

function scoreStability(f: Facts) {
  let s = 55;

  if ((num(f.employment_months) ?? 0) >= 12) s += 10;
  if ((num(f.residence_months) ?? 0) >= 12) s += 8;
  if (f.residence_type === "own") s += 5;

  if ((num(f.employment_months) ?? 0) < 6) s -= 12;
  if ((num(f.residence_months) ?? 0) < 6) s -= 10;

  return clamp(s, 0, 100);
}

/* =======================================================
   COMPLIANCE (5%)
======================================================= */

function scoreCompliance(f: Facts) {
  if (f.has_driver_license !== true) return 0;
  if (f.license_state_match === false) return 40;
  return 100;
}

/* =======================================================
   COMMITMENT (20%)  ← YOUR STRONG BEHAVIOR ENGINE
======================================================= */

function scoreCommitment(f: Facts) {
  let s = 55;

  /* --- Question 3: Bad Deal Definition (RANKED EXACTLY AS YOU REQUESTED) --- */
  const badDeal = safeLower(f.bad_deal_definition);

  if (badDeal.includes("c -")) s += 15; // RESPONSIBILITY (BEST)
  else if (badDeal.includes("a -")) s += 8; // payment realism
  else if (badDeal.includes("d -")) s += 2; // rate sensitive
  else if (badDeal.includes("b -")) s -= 12; // unreliable vehicle (worst)

  /* --- Vehicle Priority --- */
  const priority = safeLower(f.vehicle_priority);
  if (priority.includes("a -")) s += 8;
  else if (priority.includes("b -")) s += 6;
  else if (priority.includes("e -")) s += 4;
  else if (priority.includes("c -")) s -= 4;
  else if (priority.includes("d -")) s -= 6;

  /* --- Vehicle Approved Help --- */
  const help = safeLower(f.vehicle_approved_help);
  if (help.includes("a -")) s += 6;
  if (help.includes("d -")) s += 6;
  if (help.includes("b -")) s += 4;
  if (help.includes("c -")) s += 3;

  /* --- Mechanical Scenario --- */
  const mech = safeLower(f.mechanical_failure_plan);
  if (mech.includes("a -")) s += 12;
  if (mech.includes("d -")) s -= 18;

  if (f.support_system === true) s += 6;
  if (f.support_system === false) s -= 6;

  return clamp(s, 0, 100);
}

/* =======================================================
   FINAL
======================================================= */

function weightedScore(parts: any) {
  return clamp(
    Math.round(
      parts.cc * (WEIGHTS.credit_context / 100) +
        parts.pay * (WEIGHTS.ability_to_pay / 100) +
        parts.stab * (WEIGHTS.stability / 100) +
        parts.comp * (WEIGHTS.compliance / 100) +
        parts.commit * (WEIGHTS.commitment / 100)
    ),
    0,
    100
  );
}

function riskFromScore(score: number): Risk {
  if (score >= 72) return "low";
  if (score <= 44) return "high";
  return "medium";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const facts: Facts = body.memory?.facts ?? {};

    const parts = {
      cc: scoreCreditContext(facts),
      pay: scoreAbility(facts),
      stab: scoreStability(facts),
      comp: scoreCompliance(facts),
      commit: scoreCommitment(facts),
    };

    const score = weightedScore(parts);
    const risk = riskFromScore(score);

    return NextResponse.json({
      ok: true,
      risk,
      score,
      parts,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
