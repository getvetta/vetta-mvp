// lib/vettaConfig.ts

// High-level pillars Vetta uses internally
export type VettaPillar =
  | "stability"
  | "accountability"
  | "financial_structure"
  | "resilience"
  | "intent";

export const PILLARS: { key: VettaPillar; label: string; description: string }[] = [
  {
    key: "stability",
    label: "Stability",
    description:
      "Job history, income consistency, time at current job, and time at current address.",
  },
  {
    key: "accountability",
    label: "Accountability",
    description:
      "How the customer explains past issues like repos or late payments and whether they take ownership.",
  },
  {
    key: "financial_structure",
    label: "Financial Structure",
    description:
      "Net monthly income, fixed expenses, debts, and how safely a payment fits into their budget.",
  },
  {
    key: "resilience",
    label: "Resilience",
    description:
      "How they handle unexpected expenses, bad months, and setbacks; backup plans and support.",
  },
  {
    key: "intent",
    label: "Intent & Use",
    description:
      "Why they need the vehicle and how essential it is to work, family, or daily responsibilities.",
  },
];

// Deeper traits (for internal scoring / dashboards)
export type VettaTrait =
  | "responsibility_habits"
  | "income_volatility"
  | "payment_attitude"
  | "planning_awareness"
  | "support_system";

export const TRAITS: { key: VettaTrait; label: string; description: string }[] = [
  {
    key: "responsibility_habits",
    label: "Responsibility Habits",
    description:
      "Patterns around honoring agreements, communicating issues, and learning from past problems.",
  },
  {
    key: "income_volatility",
    label: "Income Volatility",
    description:
      "How much their earnings move up and down month-to-month based on job type or gig work.",
  },
  {
    key: "payment_attitude",
    label: "Payment Attitude",
    description:
      "Whether they see the car payment as a top priority or something they hope to manage.",
  },
  {
    key: "planning_awareness",
    label: "Planning Awareness",
    description:
      "How much they think ahead about budgets, obligations, and potential setbacks.",
  },
  {
    key: "support_system",
    label: "Support System",
    description:
      "Whether they have people or resources to lean on in a tough month.",
  },
];

// Neutral personality profiles – used internally to shape tone.
// You can later let dealers pick one from the dashboard.
export type PersonalityKey = "neutral" | "supportive" | "direct" | "reassuring";

export interface PersonalityProfile {
  key: PersonalityKey;
  displayName: string;
  description: string;
  toneInstructions: string;
}

export const PERSONALITY_PROFILES: Record<PersonalityKey, PersonalityProfile> = {
  neutral: {
    key: "neutral",
    displayName: "Balanced",
    description: "Clear, professional, and neutral tone.",
    toneInstructions:
      "Use a professional, balanced tone. Be clear, concise, and neutral. Avoid sounding harsh or overly casual.",
  },
  supportive: {
    key: "supportive",
    displayName: "Supportive",
    description: "Encouraging and empathetic while staying honest.",
    toneInstructions:
      "Use a warm, encouraging tone. Acknowledge challenges, encourage honesty, and show that the goal is to set the customer up for success.",
  },
  direct: {
    key: "direct",
    displayName: "Direct",
    description: "Straightforward and efficient, but respectful.",
    toneInstructions:
      "Use a straightforward, efficient tone. Get to the point while staying respectful and professional.",
  },
  reassuring: {
    key: "reassuring",
    displayName: "Reassuring",
    description: "Calm, steady tone that builds confidence.",
    toneInstructions:
      "Use a calm, steady tone that reassures the customer. Emphasize clarity and confidence. Avoid sounding alarmist.",
  },
};
