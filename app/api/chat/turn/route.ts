// app/api/chat/turn/route.ts
import { NextResponse } from "next/server";

type Role = "assistant" | "user";
type MsgKind = "ack" | "q" | "sys" | "clarify";
type Msg = { role: Role; content: string; kind?: MsgKind };

type DealerPreferences = {
  min_down_payment: number;
  min_employment_months: number;
  min_residence_months: number;

  max_pti_ratio?: number | null;
  require_valid_driver_license?: boolean;

  require_proof_of_income?: boolean;
  require_references?: boolean;

  notes?: string | null;
};

/**
 * ✅ MUST match:
 * - app/chatbot/page.tsx Facts
 * - app/api/analyze-risk/route.ts Facts
 */
type Facts = {
  // Income
  pay_frequency?: "weekly" | "biweekly" | "monthly" | null;
  income_amount?: number | null;

  // Residence
  residence_type?: "rent" | "own" | "family" | null;
  residence_months?: number | null;

  // Employment
  job_title?: string | null;
  employer_name?: string | null;
  commute_minutes?: number | null;
  employment_months?: number | null;

  // License
  has_driver_license?: boolean | null;
  license_state_match?: boolean | null; // in-state true, out-of-state false

  // Vehicle (from intro UI)
  vehicle_type?: string | null;
  vehicle_specific?: string | null;

  // Bills (monthly)
  rent_amount?: number | null; // rent/mortgage OR family contribution
  cell_phone_bill?: number | null;
  subscriptions_bill?: number | null;

  // If rent/own (ask these)
  water_bill?: number | null;
  electric_bill?: number | null;
  wifi_bill?: number | null;

  // Food behavior (weekly)
  eat_out_frequency?: "never" | "1-2" | "3-5" | "6+" | null;
  eat_out_spend_weekly?: number | null;
  groceries_spend_weekly?: number | null;

  // Down payment
  down_payment?: number | null;

  // Credit + context (high weight)
  credit_importance?: number | null; // 1-10
  credit_below_reason?: string | null;

  // ✅ NEW: Deal / intention questions (multiple choice)
  prior_auto_financing?: string | null; // e.g. "A - ..."
  vehicle_priority?: string | null; // e.g. "B - ..."
  bad_deal_definition?: string | null; // e.g. "C - ..."
  vehicle_benefit?: string | null; // e.g. "D - ..."

  // Commitment & responsibility
  mechanical_failure_plan?: string | null; // normalized: "A - ..."

  support_system?: boolean | null;

  // Reference question (no contact info collected now)
  vehicle_reference_available?: boolean | null;
  vehicle_reference_relation?: string | null;

  // Household
  spouse_cosigner?: boolean | null;

  // Location tie-in
  born_in_state?: boolean | null;

  // Flags
  warnings?: string[] | null;
  hard_stops?: string[] | null;
};

type Memory = {
  asked: string[];
  facts: Facts;
};

type TurnRequest = {
  dealer?: string;
  dealerName?: string;
  assessmentId?: string | null;
  customerName?: string;
  customerPhone?: string;
  preferences?: DealerPreferences;
  messages?: Msg[];
  lastQuestionAsked?: string;
  memory?: Memory;
};

type Action = "ask" | "warn" | "clarify" | "stop";

/**
 * ✅ Flow 1 (Stability-First) locked baseline — with your modification:
 * payment preference comes before payment comfort
 *
 * ✅ Updates in this file:
 * - Added 4 new multiple-choice questions (A/B/C/D/E)
 * - Kept scenario split into 2 messages (ack + nextQuestion)
 * - Kept food logic + conditional utilities
 */
const FLOW = [
  // Employment deep
  "job_title",
  "employer_name",
  "commute_minutes",
  "employment_months",

  // Residence
  "residence_type",
  "residence_months",

  // License
  "has_driver_license",
  "license_state_match",

  // Born in state
  "born_in_state",

  // Spouse / co-signer
  "spouse_cosigner",

  // Pay frequency then amount
  "pay_frequency",
  "income_amount",

  // Bills (conditional sequence handled by nextMissingTopic)
  "rent_amount",
  "cell_phone_bill",
  "subscriptions_bill",
  "water_bill",
  "electric_bill",
  "wifi_bill",

  // Food behavior
  "eat_out_frequency",
  "eat_out_spend_weekly",
  "groceries_spend_weekly",

  // Down payment
  "down_payment",

  // Credit & context
  "credit_importance",
  "credit_below_reason",

  // ✅ NEW: Intent / deal alignment
  "prior_auto_financing",
  "vehicle_priority",
  "bad_deal_definition",
  "vehicle_benefit",

  // Scenario + support
  "mechanical_failure_plan",
  "support_system",

  // Reference
  "vehicle_reference_available",
  "vehicle_reference_relation",
] as const;

type Topic = (typeof FLOW)[number];

function lastUserMessage(messages: Msg[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content || "";
  }
  return "";
}

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s$+\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Only treat as confused if truly confusion / refusal / empty.
 * ✅ allow single-letter answers like A/B/C/D/E or Y/N, and digits 1-9/10.
 */
function looksConfused(textRaw: string) {
  const raw = String(textRaw || "").trim();
  const t = normalize(textRaw);

  if (!t) return true;

  // allow single letter / digit replies
  if (raw.length === 1) {
    const c = raw.toLowerCase();
    if (["a", "b", "c", "d", "e", "y", "n"].includes(c)) return false;
    if (/[1-9]/.test(c)) return false;
  }
  if (/^10$/.test(raw)) return false;

  const hardConfusion = [
    "idk",
    "i dont know",
    "dont know",
    "not sure",
    "confused",
    "can you repeat",
    "repeat that",
    "what do you mean",
    "wdym",
    "wym",
    "huh",
    "skip",
    "prefer not to say",
    "n a",
    "na",
  ];

  if (hardConfusion.some((p) => t.includes(p))) return true;
  if (/^\?+$/.test(raw)) return true;

  return false;
}

function parseMoney(textRaw: string): number | null {
  const t = String(textRaw || "").replace(/,/g, "");
  const m = t.match(/(\$?\s*\d{1,7})(\.\d{1,2})?/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/\$/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseMinutes(textRaw: string): number | null {
  const t = normalize(textRaw);
  const hour = t.match(/(\d{1,2})\s*(hour|hr|hrs)/);
  if (hour) {
    const h = Number(hour[1]);
    if (Number.isFinite(h)) return h * 60;
  }
  const min = t.match(/(\d{1,3})\s*(min|mins|minute|minutes)/);
  if (min) {
    const m = Number(min[1]);
    if (Number.isFinite(m)) return m;
  }
  const bare = t.match(/\b(\d{1,3})\b/);
  if (bare) {
    const m = Number(bare[1]);
    if (Number.isFinite(m)) return m;
  }
  return null;
}

function parseMonths(textRaw: string): number | null {
  const t = normalize(textRaw);
  const yrs = t.match(/(\d{1,2})\s*(year|years|yr|yrs)/);
  if (yrs) {
    const y = Number(yrs[1]);
    if (Number.isFinite(y)) return y * 12;
  }
  const mos = t.match(/(\d{1,3})\s*(month|months|mo|mos)/);
  if (mos) {
    const m = Number(mos[1]);
    if (Number.isFinite(m)) return m;
  }
  const bare = t.match(/\b(\d{1,3})\b/);
  if (bare) {
    const m = Number(bare[1]);
    if (Number.isFinite(m)) return m;
  }
  return null;
}

function parseYesNo(textRaw: string): boolean | null {
  const raw = String(textRaw || "").trim().toLowerCase();
  const t = normalize(textRaw);
  if (!t) return null;

  if (raw === "y") return true;
  if (raw === "n") return false;

  if (/\b(yes|yep|yeah|sure|correct|i do|i have)\b/.test(t)) return true;
  if (/\b(no|nope|nah|dont|do not|i dont|i do not|not)\b/.test(t)) return false;
  return null;
}

function parsePayFrequency(textRaw: string): Facts["pay_frequency"] | null {
  const t = normalize(textRaw);
  if (t.includes("weekly") || /\bweek\b/.test(t)) return "weekly";
  if (t.includes("biweekly") || t.includes("bi weekly") || t.includes("every two weeks") || t.includes("2 weeks"))
    return "biweekly";
  if (t.includes("monthly") || /\bmonth\b/.test(t)) return "monthly";
  return null;
}

/**
 * Scenario parser:
 * Accepts A/B/C/D or phrases.
 */
function parseScenarioChoice(textRaw: string): "A" | "B" | "C" | "D" | null {
  const raw = String(textRaw || "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase().trim();

  const m = upper.match(/^\s*([ABCD])\b/);
  if (m) return m[1] as any;

  const t = normalize(textRaw);

  if (t.includes("take responsibility") || t.includes("get it fixed") || t.includes("fix it") || t.includes("repair it"))
    return "A";
  if (
    t.includes("call") &&
    (t.includes("dealership") || t.includes("you") || t.includes("us") || t.includes("shop") || t.includes("see if"))
  )
    return "B";
  if (t.includes("drive until") || t.includes("tow") || t.includes("keep driving") || t.includes("until it dies"))
    return "C";
  if (t.includes("give the car back") || t.includes("return it") || t.includes("bring it back") || t.includes("give it back"))
    return "D";

  return null;
}

/**
 * Generic multiple-choice parser for A/B/C/D/E (also accepts 1-5).
 */
function parseChoiceLetter(
  textRaw: string,
  allowed: Array<"A" | "B" | "C" | "D" | "E">
): ("A" | "B" | "C" | "D" | "E") | null {
  const raw = String(textRaw || "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase().trim();

  const m = upper.match(/^\s*([ABCDE])\b/);
  if (m) {
    const c = m[1] as any;
    return allowed.includes(c) ? c : null;
  }

  // allow 1-5 mapping
  const d = upper.match(/^\s*([1-5])\b/);
  if (d) {
    const map: Record<string, "A" | "B" | "C" | "D" | "E"> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };
    const c = map[d[1]];
    return allowed.includes(c) ? c : null;
  }

  return null;
}

function addJobSignalsToWarnings(facts: Facts) {
  const title = normalize(facts.job_title || "");
  const employer = normalize(facts.employer_name || "");
  const warnings = new Set<string>(Array.isArray(facts.warnings) ? facts.warnings : []);

  const managementWords = ["manager", "supervisor", "lead", "foreman", "director", "owner", "gm", "general manager"];
  const skilledWords = [
    "nurse",
    "rn",
    "lpn",
    "engineer",
    "technician",
    "mechanic",
    "electrician",
    "plumber",
    "hvac",
    "welder",
    "driver",
    "cdl",
  ];
  const gigWords = ["uber", "lyft", "doordash", "instacart", "gig", "freelance", "self employed", "self-employed", "contractor"];
  const tempWords = ["temp", "seasonal", "season", "part time", "part-time", "agency"];
  const lowWageEmployers = ["chipotle", "mcdonald", "walmart", "dollar tree", "dollar general", "burger king", "taco bell", "wendy", "subway"];
  const lowWageTitles = ["cashier", "crew", "server", "host", "dishwasher", "stock", "associate"];

  if (managementWords.some((w) => title.includes(w))) warnings.add("job_management_signal");
  if (skilledWords.some((w) => title.includes(w))) warnings.add("job_skilled_trade_signal");

  if (gigWords.some((w) => title.includes(w) || employer.includes(w))) warnings.add("job_gig_signal");
  if (tempWords.some((w) => title.includes(w))) warnings.add("job_temp_or_parttime_signal");

  if (lowWageEmployers.some((w) => employer.includes(w))) warnings.add("job_low_wage_employer_signal");
  if (lowWageTitles.some((w) => title.includes(w))) warnings.add("job_low_wage_title_signal");

  facts.warnings = Array.from(warnings);
}

function questionFor(topic: Topic, facts: Facts) {
  switch (topic) {
    case "job_title":
      return "What’s your current job title?";
    case "employer_name":
      return "What’s the name of your employer (company name)?";
    case "commute_minutes":
      return "About how long is your commute from home to work (in minutes)?";
    case "employment_months":
      return "How long have you been at this job?";

    case "residence_type":
      return "Do you rent, own, or live with family?";
    case "residence_months":
      return "How long have you lived at your current place?";

    case "has_driver_license":
      return "Do you have a valid driver’s license right now?";
    case "license_state_match":
      return "Is your driver’s license in-state or out-of-state?";

    case "born_in_state":
      return "Were you born in the same state as this dealership is located?";

    case "spouse_cosigner":
      return "If needed, do you have a spouse that can go on the loan with you?";

    case "pay_frequency":
      return "Do you get paid weekly, bi-weekly, or monthly?";
    case "income_amount":
      return "About how much do you bring home each paycheck after taxes?";

    // Bills (no tips in parentheses)
    case "rent_amount":
      return "How much is your rent or mortgage each month?";
    case "cell_phone_bill":
      return "About how much is your cell phone bill each month?";
    case "subscriptions_bill":
      return "About how much do you spend on subscriptions each month?";

    // Rent/Own utilities
    case "water_bill":
      return "About how much is your water bill each month?";
    case "electric_bill":
      return "About how much is your electric bill each month?";
    case "wifi_bill":
      return "About how much is your Wi-Fi bill each month?";

    // Food behavior
    case "eat_out_frequency":
      return "How often do you eat out each week?";
    case "eat_out_spend_weekly":
      return "About how much do you spend eating out per week?";
    case "groceries_spend_weekly":
      return "About how much do you spend on groceries per week?";

    case "down_payment":
      return "How much can you put down today if everything looks good?";

    case "credit_importance":
      return "How important is building credit to you on a scale of 1–10?";
    case "credit_below_reason":
      return "What would you say is the main reason your credit is below standard?";

    // ✅ NEW: Multiple choice blocks (A/B/C/D/E)
    case "prior_auto_financing":
      return [
        "Have you ever financed a vehicle through a dealership or auto loan before?",
        "",
        "A) Yes — and I paid it off successfully",
        "B) Yes — but I had some late payments",
        "C) Yes — but I was unable to finish paying it off and the vehicle was eventually repossessed",
        "D) No — this would be my first time financing a vehicle",
        "",
        "Reply with A, B, C, or D.",
      ].join("\n");

    case "vehicle_priority":
      return [
        "When getting a vehicle, what matters most to you?",
        "",
        "A) Having reliable transportation so I can work and handle my responsibilities",
        "B) Being able to keep the vehicle long term",
        "C) Getting the lowest possible monthly payment",
        "D) Getting the lowest interest rate possible",
        "E) Getting approved today so I can move forward with my responsibilities",
        "",
        "Reply with A, B, C, D, or E.",
      ].join("\n");

    case "bad_deal_definition":
      return [
        "What would make a vehicle a bad deal for you personally?",
        "",
        "A) Payments I know I cannot realistically keep up with",
        "B) A vehicle that is unreliable",
        "C) Something that prevents me from handling my daily responsibilities",
        "D) A vehicle with a high payment and high interest that I cannot manage",
        "",
        "Reply with A, B, C, or D.",
      ].join("\n");

    case "vehicle_benefit":
      return [
        "If you were approved today, how would having this vehicle help you most?",
        "",
        "A) Help me get to work consistently",
        "B) Help me support my family",
        "C) Help me improve my financial stability",
        "D) Help me handle important daily responsibilities",
        "",
        "Reply with A, B, C, or D.",
      ].join("\n");

    case "mechanical_failure_plan":
      // second message only (first message is handled via ack)
      return [
        "Let’s say your car needs a repair and your payment is due next week. What would you do?",
        "",
        "A) Take responsibility to get the car fixed",
        "B) Call us to see if we can fix it",
        "C) Drive until a tow is needed",
        "D) Give the car back",
        "",
        "Reply with A, B, C, or D.",
      ].join("\n");

    case "support_system":
      return "Do you have a support system (family/friends) that could help you stay on track if something unexpected happened?";

    case "vehicle_reference_available":
      return "Do you have at least one reference contact the dealership could call if needed?";
    case "vehicle_reference_relation":
      return "Okay — what is their relationship to you?";

    default:
      return "";
  }
}

function isFactFilled(topic: Topic, facts: Facts) {
  const f: any = facts;

  // Conditional skip rules:
  // - If residence is FAMILY, skip utilities (water/electric/wifi)
  if (facts.residence_type === "family") {
    if (topic === "water_bill" || topic === "electric_bill" || topic === "wifi_bill") return true;
  }

  // Eat out logic:
  // If they say never, skip eat_out_spend_weekly and ask groceries instead.
  if (topic === "eat_out_spend_weekly") {
    if (facts.eat_out_frequency === "never") return true;
  }
  if (topic === "groceries_spend_weekly") {
    // Only required if they don't eat out
    if (facts.eat_out_frequency && facts.eat_out_frequency !== "never") return true;
  }

  switch (topic) {
    case "job_title":
    case "employer_name":
    case "credit_below_reason":
      return Boolean(String(f[topic] ?? "").trim().length >= 2);

    case "mechanical_failure_plan":
    case "prior_auto_financing":
    case "vehicle_priority":
    case "bad_deal_definition":
    case "vehicle_benefit":
      return Boolean(String(f[topic] ?? "").trim().length >= 1);

    case "commute_minutes":
    case "employment_months":
    case "residence_months":
      return Number.isFinite(Number(f[topic])) && Number(f[topic]) >= 0;

    case "pay_frequency":
      return f.pay_frequency === "weekly" || f.pay_frequency === "biweekly" || f.pay_frequency === "monthly";

    case "income_amount":
    case "rent_amount":
    case "cell_phone_bill":
    case "subscriptions_bill":
    case "water_bill":
    case "electric_bill":
    case "wifi_bill":
    case "down_payment":
    case "credit_importance":
    case "eat_out_spend_weekly":
    case "groceries_spend_weekly":
      return Number.isFinite(Number(f[topic]));

    case "eat_out_frequency":
      return f.eat_out_frequency === "never" || f.eat_out_frequency === "1-2" || f.eat_out_frequency === "3-5" || f.eat_out_frequency === "6+";

    case "residence_type":
      return f.residence_type === "rent" || f.residence_type === "own" || f.residence_type === "family";

    case "has_driver_license":
    case "license_state_match":
    case "born_in_state":
    case "spouse_cosigner":
    case "support_system":
      return typeof f[topic] === "boolean";

    case "vehicle_reference_available":
      return typeof f.vehicle_reference_available === "boolean";

    case "vehicle_reference_relation":
      if (facts.vehicle_reference_available === false) return true;
      return Boolean(String(facts.vehicle_reference_relation ?? "").trim().length >= 2);

    default:
      return false;
  }
}

function applyParse(topic: Topic, userText: string, facts: Facts): { nextFacts: Facts; ok: boolean } {
  const next: Facts = { ...facts };

  switch (topic) {
    case "job_title": {
      const v = userText.trim();
      if (v.length < 2) return { nextFacts: next, ok: false };
      next.job_title = v;
      return { nextFacts: next, ok: true };
    }

    case "employer_name": {
      const v = userText.trim();
      if (v.length < 2) return { nextFacts: next, ok: false };
      next.employer_name = v;
      return { nextFacts: next, ok: true };
    }

    case "commute_minutes": {
      const m = parseMinutes(userText);
      if (m == null || m < 0) return { nextFacts: next, ok: false };
      next.commute_minutes = m;
      return { nextFacts: next, ok: true };
    }

    case "employment_months": {
      const m = parseMonths(userText);
      if (m == null || m < 0) return { nextFacts: next, ok: false };
      next.employment_months = m;
      return { nextFacts: next, ok: true };
    }

    case "residence_type": {
      const t = normalize(userText);
      if (t.includes("rent")) next.residence_type = "rent";
      else if (t.includes("own") || t.includes("mortgage")) next.residence_type = "own";
      else if (t.includes("family") || t.includes("parents") || t.includes("mom") || t.includes("dad")) next.residence_type = "family";
      else return { nextFacts: next, ok: false };
      return { nextFacts: next, ok: true };
    }

    case "residence_months": {
      const m = parseMonths(userText);
      if (m == null || m < 0) return { nextFacts: next, ok: false };
      next.residence_months = m;
      return { nextFacts: next, ok: true };
    }

    case "has_driver_license": {
      const yn = parseYesNo(userText);
      if (yn == null) return { nextFacts: next, ok: false };
      next.has_driver_license = yn;
      return { nextFacts: next, ok: true };
    }

    case "license_state_match": {
      const t = normalize(userText);
      if (t.includes("in state") || t.includes("in-state") || t.includes("same state")) {
        next.license_state_match = true;
        return { nextFacts: next, ok: true };
      }
      if (t.includes("out of state") || t.includes("out-of-state") || t.includes("different state")) {
        next.license_state_match = false;
        return { nextFacts: next, ok: true };
      }
      const yn = parseYesNo(userText);
      if (yn != null) {
        next.license_state_match = yn;
        return { nextFacts: next, ok: true };
      }
      return { nextFacts: next, ok: false };
    }

    case "born_in_state": {
      const yn = parseYesNo(userText);
      if (yn == null) return { nextFacts: next, ok: false };
      next.born_in_state = yn;
      return { nextFacts: next, ok: true };
    }

    case "spouse_cosigner": {
      const yn = parseYesNo(userText);
      if (yn == null) return { nextFacts: next, ok: false };
      next.spouse_cosigner = yn;
      return { nextFacts: next, ok: true };
    }

    case "pay_frequency": {
      const f = parsePayFrequency(userText);
      if (!f) return { nextFacts: next, ok: false };
      next.pay_frequency = f;
      return { nextFacts: next, ok: true };
    }

    case "income_amount": {
      const n = parseMoney(userText);
      if (n == null || n <= 0) return { nextFacts: next, ok: false };
      next.income_amount = n;
      return { nextFacts: next, ok: true };
    }

    // ✅ Bills: allow all answer types (store 0 + warning if non-numeric)
    case "rent_amount":
    case "cell_phone_bill":
    case "subscriptions_bill":
    case "water_bill":
    case "electric_bill":
    case "wifi_bill": {
      const n = parseMoney(userText);
      if (n == null) {
        const w = new Set<string>(Array.isArray(next.warnings) ? next.warnings : []);
        w.add(`bill_non_numeric_${topic}`);
        next.warnings = Array.from(w);
        (next as any)[topic] = 0;
        return { nextFacts: next, ok: true };
      }
      if (n < 0) {
        const w = new Set<string>(Array.isArray(next.warnings) ? next.warnings : []);
        w.add(`bill_negative_${topic}`);
        next.warnings = Array.from(w);
        (next as any)[topic] = 0;
        return { nextFacts: next, ok: true };
      }
      (next as any)[topic] = n;
      return { nextFacts: next, ok: true };
    }

    case "eat_out_frequency": {
      const t = normalize(userText);

      if (/\b(never|none|no|0)\b/.test(t)) {
        next.eat_out_frequency = "never";
        return { nextFacts: next, ok: true };
      }

      const numMatch = t.match(/\b(\d{1,2})\b/);
      if (numMatch) {
        const n = Number(numMatch[1]);
        if (Number.isFinite(n)) {
          if (n <= 0) next.eat_out_frequency = "never";
          else if (n <= 2) next.eat_out_frequency = "1-2";
          else if (n <= 5) next.eat_out_frequency = "3-5";
          else next.eat_out_frequency = "6+";
          return { nextFacts: next, ok: true };
        }
      }

      if (t.includes("once") || t.includes("twice")) {
        next.eat_out_frequency = "1-2";
        return { nextFacts: next, ok: true };
      }
      if (t.includes("few") || t.includes("some") || t.includes("couple")) {
        next.eat_out_frequency = "1-2";
        return { nextFacts: next, ok: true };
      }
      if (t.includes("often") || t.includes("a lot") || t.includes("daily") || t.includes("every day")) {
        next.eat_out_frequency = "6+";
        return { nextFacts: next, ok: true };
      }

      if (t.includes("grocer")) {
        next.eat_out_frequency = "never";
        return { nextFacts: next, ok: true };
      }

      return { nextFacts: next, ok: false };
    }

    case "eat_out_spend_weekly": {
      const n = parseMoney(userText);
      if (n == null) {
        const w = new Set<string>(Array.isArray(next.warnings) ? next.warnings : []);
        w.add("eat_out_non_numeric");
        next.warnings = Array.from(w);
        next.eat_out_spend_weekly = 0;
        return { nextFacts: next, ok: true };
      }
      next.eat_out_spend_weekly = Math.max(0, n);
      return { nextFacts: next, ok: true };
    }

    case "groceries_spend_weekly": {
      const n = parseMoney(userText);
      if (n == null) {
        const w = new Set<string>(Array.isArray(next.warnings) ? next.warnings : []);
        w.add("groceries_non_numeric");
        next.warnings = Array.from(w);
        next.groceries_spend_weekly = 0;
        return { nextFacts: next, ok: true };
      }
      next.groceries_spend_weekly = Math.max(0, n);
      return { nextFacts: next, ok: true };
    }

    case "down_payment": {
      const n = parseMoney(userText);
      if (n == null || n < 0) return { nextFacts: next, ok: false };
      next.down_payment = n;
      return { nextFacts: next, ok: true };
    }

    case "credit_importance": {
      const raw = String(userText || "").trim();
      const t = normalize(userText);
      const m = raw.match(/\b(10|[1-9])\b/) || t.match(/\b(10|[1-9])\b/);
      if (!m) return { nextFacts: next, ok: false };
      next.credit_importance = Number(m[1]);
      return { nextFacts: next, ok: true };
    }

    case "credit_below_reason": {
      const v = userText.trim();
      if (v.length < 3) return { nextFacts: next, ok: false };
      next.credit_below_reason = v;
      return { nextFacts: next, ok: true };
    }

    // ✅ NEW multiple-choice parses
    case "prior_auto_financing": {
      const c = parseChoiceLetter(userText, ["A", "B", "C", "D"]);
      if (!c) return { nextFacts: next, ok: false };
      const label =
        c === "A"
          ? "Yes — and I paid it off successfully"
          : c === "B"
          ? "Yes — but I had some late payments"
          : c === "C"
          ? "Yes — but I was unable to finish paying it off and the vehicle was eventually repossessed"
          : "No — this would be my first time financing a vehicle";
      next.prior_auto_financing = `${c} - ${label}`;
      return { nextFacts: next, ok: true };
    }

    case "vehicle_priority": {
      const c = parseChoiceLetter(userText, ["A", "B", "C", "D", "E"]);
      if (!c) return { nextFacts: next, ok: false };
      const label =
        c === "A"
          ? "Having reliable transportation so I can work and handle my responsibilities"
          : c === "B"
          ? "Being able to keep the vehicle long term"
          : c === "C"
          ? "Getting the lowest possible monthly payment"
          : c === "D"
          ? "Getting the lowest interest rate possible"
          : "Getting approved today so I can move forward with my responsibilities";
      next.vehicle_priority = `${c} - ${label}`;
      return { nextFacts: next, ok: true };
    }

    case "bad_deal_definition": {
      const c = parseChoiceLetter(userText, ["A", "B", "C", "D"]);
      if (!c) return { nextFacts: next, ok: false };
      const label =
        c === "A"
          ? "Payments I know I cannot realistically keep up with"
          : c === "B"
          ? "A vehicle that is unreliable"
          : c === "C"
          ? "Something that prevents me from handling my daily responsibilities"
          : "A vehicle with a high payment and high interest that I cannot manage";
      next.bad_deal_definition = `${c} - ${label}`;
      return { nextFacts: next, ok: true };
    }

    case "vehicle_benefit": {
      const c = parseChoiceLetter(userText, ["A", "B", "C", "D"]);
      if (!c) return { nextFacts: next, ok: false };
      const label =
        c === "A"
          ? "Help me get to work consistently"
          : c === "B"
          ? "Help me support my family"
          : c === "C"
          ? "Help me improve my financial stability"
          : "Help me handle important daily responsibilities";
      next.vehicle_benefit = `${c} - ${label}`;
      return { nextFacts: next, ok: true };
    }

    case "mechanical_failure_plan": {
      const choice = parseScenarioChoice(userText);
      if (!choice) return { nextFacts: next, ok: false };

      const label =
        choice === "A"
          ? "Take responsibility to get the car fixed"
          : choice === "B"
          ? "Call us to see if we can fix it"
          : choice === "C"
          ? "Drive until a tow is needed"
          : "Give the car back";

      next.mechanical_failure_plan = `${choice} - ${label}`;
      return { nextFacts: next, ok: true };
    }

    case "support_system": {
      const yn = parseYesNo(userText);
      if (yn == null) return { nextFacts: next, ok: false };
      next.support_system = yn;
      return { nextFacts: next, ok: true };
    }

    case "vehicle_reference_available": {
      const yn = parseYesNo(userText);
      if (yn == null) return { nextFacts: next, ok: false };
      next.vehicle_reference_available = yn;
      if (yn === false) next.vehicle_reference_relation = null;
      return { nextFacts: next, ok: true };
    }

    case "vehicle_reference_relation": {
      if (next.vehicle_reference_available === false) {
        next.vehicle_reference_relation = null;
        return { nextFacts: next, ok: true };
      }
      const v = userText.trim();
      if (v.length < 2) return { nextFacts: next, ok: false };
      next.vehicle_reference_relation = v;
      return { nextFacts: next, ok: true };
    }

    default:
      return { nextFacts: next, ok: false };
  }
}

function nextMissingTopic(facts: Facts): Topic | null {
  for (const t of FLOW) {
    if (t === "water_bill" || t === "electric_bill" || t === "wifi_bill") {
      if (facts.residence_type === "family") continue;
    }
    if (!isFactFilled(t, facts)) return t;
  }
  return null;
}

function ackFor(topic: Topic) {
  switch (topic) {
    case "credit_below_reason":
      return "Thanks for sharing.";
    default:
      return "Got it.";
  }
}

function clarifyExplain(topic: Topic) {
  switch (topic) {
    case "job_title":
      return "Just a quick title is fine — for example: manager, cashier, driver, warehouse, etc.";
    case "employer_name":
      return "Just the company name is fine.";
    case "commute_minutes":
      return "Just an estimate like “15 minutes” or “1 hour.”";
    case "employment_months":
      return "Quick estimate is fine — like “6 months” or “2 years.”";
    case "residence_months":
      return "Quick estimate is fine — like “8 months” or “3 years.”";
    case "license_state_match":
      return "Just tell me in-state or out-of-state.";
    case "pay_frequency":
      return "Just pick one: weekly, bi-weekly, or monthly.";
    case "income_amount":
      return "Just an estimate of your take-home per paycheck.";
    case "credit_importance":
      return "Just give me a number from 1 to 10.";
    case "mechanical_failure_plan":
    case "prior_auto_financing":
    case "bad_deal_definition":
    case "vehicle_benefit":
      return "Just reply with A, B, C, or D (or type the option).";
    case "vehicle_priority":
      return "Just reply with A, B, C, D, or E (or type the option).";
    case "vehicle_reference_available":
      return "Just reply Yes or No.";
    case "vehicle_reference_relation":
      return "Just tell me how they’re connected to you — parent, spouse, sibling, friend, etc.";
    case "eat_out_frequency":
      return "You can answer like: never, 1, 2, 3, 5, daily, etc.";
    default:
      return "No worries — quick answer is fine.";
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as TurnRequest;

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const memFacts = body.memory?.facts && typeof body.memory.facts === "object" ? body.memory.facts : {};
    const facts: Facts = { ...(memFacts as Facts) };

    const userText = lastUserMessage(messages);

    if (!messages.length) {
      return NextResponse.json({ action: "ask" satisfies Action, ack: "", explain: "", nextQuestion: "", facts });
    }

    const lastQ = String(body.lastQuestionAsked || "").trim();

    let lastTopic: Topic | null = null;
    if (lastQ) {
      for (const t of FLOW) {
        if (questionFor(t, facts) === lastQ) {
          lastTopic = t;
          break;
        }
      }
    }

    if (lastTopic && looksConfused(userText)) {
      return NextResponse.json({
        action: "clarify" satisfies Action,
        ack: "",
        explain: clarifyExplain(lastTopic),
        nextQuestion: questionFor(lastTopic, facts),
        facts,
      });
    }

    if (lastTopic) {
      const parsed = applyParse(lastTopic, userText, facts);
      if (!parsed.ok) {
        return NextResponse.json({
          action: "clarify" satisfies Action,
          ack: "",
          explain: clarifyExplain(lastTopic),
          nextQuestion: questionFor(lastTopic, facts),
          facts,
        });
      }
      Object.assign(facts, parsed.nextFacts);

      if (lastTopic === "job_title" || lastTopic === "employer_name") {
        addJobSignalsToWarnings(facts);
      }
    }

    const nextTopic = nextMissingTopic(facts);

    if (!nextTopic) {
      return NextResponse.json({
        action: "stop" satisfies Action,
        ack: "Got it.",
        explain: "",
        nextQuestion: "Thanks — that’s everything I needed.",
        facts,
      });
    }

    // Soft warnings used later
    const warnings: string[] = Array.isArray(facts.warnings) ? [...facts.warnings] : [];
    if (facts.license_state_match === false && !warnings.includes("license_out_of_state")) warnings.push("license_out_of_state");
    if ((facts.employment_months ?? 999) < 6 && !warnings.includes("short_job_time")) warnings.push("short_job_time");
    if ((facts.residence_months ?? 999) < 6 && !warnings.includes("short_residence_time")) warnings.push("short_residence_time");
    if ((facts.down_payment ?? 999999) < 800 && facts.down_payment != null && !warnings.includes("low_down_payment")) warnings.push("low_down_payment");
    facts.warnings = warnings;

    // ✅ Split scenario into 2 messages:
    if (nextTopic === "mechanical_failure_plan") {
      return NextResponse.json({
        action: "ask" satisfies Action,
        ack: "We all know vehicles don’t run forever and they have a funny way of surprising us when we least expect it.",
        explain: "",
        nextQuestion: questionFor(nextTopic, facts),
        facts,
      });
    }

    return NextResponse.json({
      action: "ask" satisfies Action,
      ack: ackFor(nextTopic),
      explain: "",
      nextQuestion: questionFor(nextTopic, facts),
      facts,
    });
  } catch (e: any) {
    console.error("chat/turn error:", e);
    return NextResponse.json(
      {
        action: "ask" satisfies Action,
        ack: "",
        explain: "",
        nextQuestion: "Something went wrong — please try again.",
        facts: {},
      },
      { status: 500 }
    );
  }
}
