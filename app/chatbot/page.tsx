// app/chatbot/page.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "assistant" | "user";
type MsgKind = "ack" | "q" | "sys" | "clarify";
type Msg = { role: Role; content: string; kind?: MsgKind };

type Stage = "intro" | "chat" | "done";
type Risk = "low" | "medium" | "high";

type DealerQuestion = { id: string; question: string };

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

const DEMO = "demo";
const VEHICLE_TYPES = ["Sedan", "SUV", "Truck", "Van", "Coupe", "Hatchback", "Wagon", "Other"] as const;

/** Similarity / Dedup */
function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tooSimilar(a: string, b: string) {
  const A = new Set(normalize(a).split(" ").filter(Boolean));
  const B = new Set(normalize(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  const j = union ? inter / union : 0;
  return j >= 0.72;
}
function uniqPush(arr: string[], value: string) {
  const v = String(value || "").trim();
  if (!v) return arr;
  if (arr.some((x) => tooSimilar(x, v))) return arr;
  return [...arr, v];
}

/** Session Memory */
function memKey(assessmentId: string | null, dealerKey: string) {
  return `vetta_mem_v10:${dealerKey}:${assessmentId || "no_assessment"}`;
}

/**
 * ✅ IMPORTANT:
 * This Facts type MUST match /app/api/chat/turn/route.ts exactly
 */
export type Facts = {
  // Income
  pay_frequency?: "weekly" | "biweekly" | "monthly" | null;
  income_amount?: number | null;

  // Bills
  rent_amount?: number | null;
  cell_phone_bill?: number | null;
  other_bills?: number | null;

  // Employment
  job_title?: string | null;
  employer_name?: string | null;
  commute_minutes?: number | null;
  employment_months?: number | null;

  // Residence
  residence_type?: "rent" | "own" | "family" | null;
  residence_months?: number | null;

  // License
  has_driver_license?: boolean | null;
  license_state_match?: boolean | null;

  // Vehicle (from intro UI)
  vehicle_type?: string | null;
  vehicle_specific?: string | null;

  // Payments
  payment_frequency?: "weekly" | "biweekly" | "monthly" | null;
  down_payment?: number | null;

  // Credit + context (high weight)
  credit_importance?: number | null;
  credit_below_reason?: string | null;

  // Commitment & responsibility
  mechanical_failure_plan?: string | null;
  support_system?: boolean | null;

  // Household
  spouse_cosigner?: boolean | null;

  // Location tie-in
  born_in_state?: boolean | null;

  // Reference contact
  reference_available?: boolean | null;
  reference_relation?: string | null;

  // Flags
  warnings?: string[] | null;
  hard_stops?: string[] | null;
};

type SessionMemory = {
  asked: string[];
  facts: Facts;
  lastQuestionAsked: string;
  lastUpdated: number;
};

function safeParseJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * ✅ API ROUTES (STANDARDIZED)
 * You said your project is using plural: /api/assessments/...
 * So ALL assessment endpoints here are plural.
 */
const API = {
  intro: "/api/assessments/intro",
  progress: "/api/assessments/progress",
  // NOTE: /api/assessments/[id] is used elsewhere (dashboard details)
};

export default function ChatbotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");
  const dealerParam = searchParams.get("dealer") || DEMO;
  const dealerKey = dealerParam;

  const [stage, setStage] = useState<Stage>("intro");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [vehicleType, setVehicleType] = useState<string>("");
  const [vehicleSpecific, setVehicleSpecific] = useState<string>("");

  const [vehicleMenuOpen, setVehicleMenuOpen] = useState(false);
  const vehicleMenuRef = useRef<HTMLDivElement | null>(null);

  const [dealerQs, setDealerQs] = useState<DealerQuestion[]>([]);
  const [prefs, setPrefs] = useState<DealerPreferences>({
    min_down_payment: 0,
    min_employment_months: 0,
    min_residence_months: 0,
    max_pti_ratio: null,
    require_valid_driver_license: false,
    require_proof_of_income: false,
    require_references: false,
    notes: null,
  });

  const [dealerName, setDealerName] = useState<string>("");
  const [loadingDealerData, setLoadingDealerData] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [asked, setAsked] = useState<string[]>([]);
  const [facts, setFacts] = useState<Facts>({});

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [riskResult, setRiskResult] = useState<{ risk: Risk; reasoning: string } | null>(null);

  const lastQuestionAskedRef = useRef<string>("");
  const [awaitingFirstReply, setAwaitingFirstReply] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  /** close dropdown on outside click */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = vehicleMenuRef.current;
      if (!el) return;
      if (vehicleMenuOpen && !el.contains(e.target as any)) setVehicleMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [vehicleMenuOpen]);

  /** Memory Load/Save */
  useEffect(() => {
    const key = memKey(assessmentId, dealerKey);
    const saved = safeParseJSON<SessionMemory>(typeof window !== "undefined" ? localStorage.getItem(key) : null);

    if (saved && Array.isArray(saved.asked)) setAsked(saved.asked);
    if (saved && saved.facts && typeof saved.facts === "object") {
      setFacts(saved.facts);
      if (saved.facts.vehicle_type) setVehicleType(saved.facts.vehicle_type);
      if (saved.facts.vehicle_specific) setVehicleSpecific(saved.facts.vehicle_specific);
    }
    if (saved && typeof saved.lastQuestionAsked === "string") {
      lastQuestionAskedRef.current = saved.lastQuestionAsked;
    }
  }, [assessmentId, dealerKey]);

  useEffect(() => {
    const key = memKey(assessmentId, dealerKey);
    const payload: SessionMemory = {
      asked,
      facts,
      lastQuestionAsked: lastQuestionAskedRef.current,
      lastUpdated: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [asked, facts, assessmentId, dealerKey]);

  /** UI behaviors */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (stage === "chat" && !done) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [stage, done]);

  /** Load dealer custom questions + dealer settings */
  useEffect(() => {
    const load = async () => {
      setLoadingDealerData(true);
      try {
        const resQ = await fetch(`/api/custom-questions?dealer=${encodeURIComponent(dealerKey)}`);
        const jsonQ = await resQ.json().catch(() => null);
        const qs = Array.isArray(jsonQ?.questions) ? jsonQ.questions : [];

        setDealerQs(
          qs
            .map((q: any) => ({ id: String(q.id ?? crypto.randomUUID()), question: String(q.question ?? "") }))
            .filter((q: DealerQuestion) => q.question.trim().length > 0)
        );

        const resS = await fetch(`/api/dealer-settings?dealer=${encodeURIComponent(dealerKey)}`);
        const jsonS = await resS.json().catch(() => null);

        const p = jsonS && typeof jsonS === "object" ? jsonS : null;
        if (p) {
          const dn =
            (typeof (p as any).dealer_name === "string" && (p as any).dealer_name) ||
            (typeof (p as any).business_name === "string" && (p as any).business_name) ||
            (typeof (p as any).name === "string" && (p as any).name) ||
            "";
          setDealerName(String(dn || "").trim());

          setPrefs((prev) => ({
            ...prev,
            min_down_payment: Number((p as any).min_down_payment ?? prev.min_down_payment ?? 0),
            min_employment_months: Number((p as any).min_employment_months ?? prev.min_employment_months ?? 0),
            min_residence_months: Number((p as any).min_residence_months ?? prev.min_residence_months ?? 0),
            max_pti_ratio:
              (p as any).max_pti_ratio === null || (p as any).max_pti_ratio === undefined
                ? prev.max_pti_ratio ?? null
                : Number((p as any).max_pti_ratio),
            require_valid_driver_license:
              (p as any).require_valid_driver_license === undefined
                ? Boolean(prev.require_valid_driver_license)
                : Boolean((p as any).require_valid_driver_license),
            require_proof_of_income:
              (p as any).require_proof_of_income === undefined
                ? Boolean(prev.require_proof_of_income)
                : Boolean((p as any).require_proof_of_income),
            require_references:
              (p as any).require_references === undefined ? Boolean(prev.require_references) : Boolean((p as any).require_references),
            notes: typeof (p as any).notes === "string" ? (p as any).notes : prev.notes ?? null,
          }));
        }
      } catch {
        // keep defaults
      } finally {
        setLoadingDealerData(false);
      }
    };
    load();
  }, [dealerKey]);

  /** Restart */
  const restartAssessment = () => {
    const key = memKey(assessmentId, dealerKey);
    try {
      localStorage.removeItem(key);
    } catch {}

    setMessages([]);
    setAsked([]);
    setFacts({});
    setDone(false);
    setRiskResult(null);
    setErrorMsg(null);
    lastQuestionAskedRef.current = "";
    setAwaitingFirstReply(false);

    setCustomerName("");
    setCustomerPhone("");
    setVehicleType("");
    setVehicleSpecific("");

    setStage("intro");
  };

  /**
   * ✅ PROGRESS SAVE (plural route)
   * Before: /api/assessment/progress (404)
   * Now:    /api/assessments/progress (should be 200)
   */
  async function persistProgress(payload: { facts?: Facts; answers?: Msg[]; status?: string }) {
    if (!assessmentId) return;
    try {
      await fetch(API.progress, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          assessmentId,
          status: payload.status || "in_progress",
          facts: payload.facts,
          answers: payload.answers,
        }),
      });
    } catch {
      // ignore (progress save should never block UX)
    }
  }

  /** Start chat */
  const startChat = async () => {
    setErrorMsg(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg("Please enter your full name and phone number to continue.");
      return;
    }
    if (!vehicleType.trim()) {
      setErrorMsg("Please select a vehicle type to continue.");
      return;
    }

    // ✅ Save applicant info immediately so dashboard never shows "Customer"
    // ✅ FIXED: plural route
    if (assessmentId) {
      try {
        const res = await fetch(API.intro, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            assessmentId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            vehicleType: vehicleType.trim(),
            vehicleSpecific: vehicleSpecific.trim(),
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setErrorMsg(json?.error || "Could not save applicant info. (Intro save failed)");
          return;
        }
      } catch {
        setErrorMsg("Could not save applicant info. (Intro save failed)");
        return;
      }
    }

    const biz = dealerName?.trim() || "the dealership";
    const firstName = customerName.trim().split(" ")[0] || "there";

    const initialFacts: Facts = {
      ...facts,
      vehicle_type: vehicleType.trim(),
      vehicle_specific: vehicleSpecific.trim() || null,
    };
    setFacts(initialFacts);

    const intro: Msg[] = [
      {
        role: "assistant",
        kind: "sys",
        content: `Hey ${firstName} — I’m Vetta. I’ll ask a few quick questions so ${biz} can understand your situation before you drive off today. Reply “ok” when you’re ready.`,
      },
    ];

    setMessages(intro);
    setAwaitingFirstReply(true);
    setDone(false);
    setRiskResult(null);
    setStage("chat");

    // ✅ Save initial progress too (plural route)
    persistProgress({ facts: initialFacts, answers: intro, status: "started" });

    router.refresh();
  };

  /** Server turn */
  async function askAiForNext(args: { chat: Msg[]; askedSnapshot: string[]; factsSnapshot: Facts; lastQuestionAsked: string }) {
    const res = await fetch("/api/chat/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        dealer: dealerKey,
        dealerName: dealerName || "",
        assessmentId: assessmentId || null,
        customerName,
        customerPhone,
        preferences: prefs,
        messages: args.chat,
        lastQuestionAsked: args.lastQuestionAsked,
        memory: {
          asked: args.askedSnapshot,
          facts: args.factsSnapshot,
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    const action = String(json?.action || "none");

    const ack = String(json?.ack || "").trim();
    const explain = String(json?.explain || "").trim();
    const nextQuestion = String(json?.nextQuestion || "").trim();
    const serverFacts = json?.facts && typeof json.facts === "object" ? (json.facts as Facts) : null;

    return { action, ack, explain, nextQuestion, serverFacts };
  }

  async function finalize(chatAfterUser: Msg[], memorySnapshot: { asked: string[]; facts: Facts }) {
    const res = await fetch("/api/analyze-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        dealer: dealerKey,
        dealerId: dealerKey,
        assessmentId: assessmentId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        transcript: chatAfterUser,
        mode: assessmentId ? "normal" : "demo",
        flow: "flow1_locked_v2",
        preferences: prefs,
        memory: memorySnapshot,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Analyze failed");

    if (!assessmentId) {
      setRiskResult({
        risk: (json?.risk as Risk) || "medium",
        reasoning: String(json?.reasoning || "No reasoning provided."),
      });
    }

    setDone(true);
    setStage("done");
  }

  /** Send */
  const handleSend = async () => {
    if (busy || done) return;

    setErrorMsg(null);
    const userText = input.trim();
    if (!userText) return;

    setInput("");
    setBusy(true);

    try {
      const chatAfterUser: Msg[] = [...messages, { role: "user", content: userText }];
      setMessages(chatAfterUser);

      // ✅ Save progress immediately after user message (plural route)
      persistProgress({ facts, answers: chatAfterUser, status: "in_progress" });

      const askedSnapshot = asked.slice();
      const lastQ = awaitingFirstReply ? "" : lastQuestionAskedRef.current;

      const server = await askAiForNext({
        chat: chatAfterUser,
        askedSnapshot,
        factsSnapshot: facts,
        lastQuestionAsked: lastQ,
      });

      if (server.serverFacts) setFacts(server.serverFacts);
      if (awaitingFirstReply) setAwaitingFirstReply(false);

      if (server.action === "stop") {
        const updated = [...chatAfterUser, { role: "assistant", kind: "sys", content: server.nextQuestion || "Assessment ended." }];
        setMessages(updated);
        persistProgress({ facts: server.serverFacts ?? facts, answers: updated, status: "completed" });

        setDone(true);
        setStage("done");
        return;
      }

      if ((server.action === "clarify" || server.action === "warn" || server.action === "ask") && server.nextQuestion) {
        setMessages((m) => {
          const out = [...m];
          if (server.action === "clarify" && server.explain) out.push({ role: "assistant", kind: "clarify", content: server.explain });
          if (server.action !== "clarify" && server.ack && server.ack.length <= 40) out.push({ role: "assistant", kind: "ack", content: server.ack });
          out.push({ role: "assistant", kind: "q", content: server.nextQuestion });
          return out;
        });

        setAsked((prev) => uniqPush(prev, server.nextQuestion));
        lastQuestionAskedRef.current = server.nextQuestion;

        // ✅ Save progress after assistant question (plural route)
        const preview = [...chatAfterUser];
        if (server.action === "clarify" && server.explain) preview.push({ role: "assistant", kind: "clarify", content: server.explain });
        if (server.action !== "clarify" && server.ack && server.ack.length <= 40) preview.push({ role: "assistant", kind: "ack", content: server.ack });
        preview.push({ role: "assistant", kind: "q", content: server.nextQuestion });
        persistProgress({ facts: server.serverFacts ?? facts, answers: preview, status: "in_progress" });

        return;
      }

      await finalize(chatAfterUser, { asked: askedSnapshot, facts: server.serverFacts ?? facts });
    } catch (e: any) {
      setErrorMsg(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      if (!done) setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && !done && input.trim()) handleSend();
    }
  };

  /** Progress */
  const progressPct = useMemo(() => {
    const filled = [
      facts.job_title,
      facts.employer_name,
      facts.commute_minutes != null,
      facts.employment_months != null,

      facts.residence_type,
      facts.residence_months != null,

      facts.has_driver_license != null,
      facts.license_state_match != null,
      facts.born_in_state != null,

      facts.spouse_cosigner != null,

      facts.pay_frequency,
      facts.income_amount != null,

      facts.rent_amount != null,
      facts.cell_phone_bill != null,
      facts.other_bills != null,

      facts.payment_frequency,
      facts.down_payment != null,

      facts.credit_importance != null,
      facts.credit_below_reason,

      facts.mechanical_failure_plan,
      facts.support_system != null,

      facts.reference_available != null,
      facts.reference_available ? Boolean(String(facts.reference_relation ?? "").trim()) : true,
    ].filter(Boolean).length;

    const total = 23;
    return Math.max(0, Math.min(100, Math.round((filled / total) * 100)));
  }, [facts]);

  // =========================
  // INTRO (Applicant Info)
  // =========================
  if (stage === "intro") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-950 flex flex-col items-center px-4 py-10 text-neutral-100">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-brand-200">Applicant Info</h1>
          </div>

          {!assessmentId && <p className="mb-3 text-amber-300 text-xs sm:text-sm">⚠ Demo mode — a short sample conversation.</p>}

          <p className="mb-4 text-sm text-neutral-300">Enter your info so the dealership can match your assessment.</p>

          {errorMsg && (
            <div className="mb-3 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm">{errorMsg}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1 text-neutral-300">Full Name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-neutral-300">Phone Number</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="(555) 555-5555"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div ref={vehicleMenuRef} className="relative">
              <label className="block text-xs mb-1 text-neutral-300">Vehicle type</label>
              <button
                type="button"
                onClick={() => setVehicleMenuOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none hover:bg-white/10 focus:ring-2 focus:ring-brand-500/40"
              >
                <span className={vehicleType ? "text-neutral-100" : "text-neutral-400"}>{vehicleType || "Select…"}</span>
                <span className="text-neutral-400">▾</span>
              </button>

              {vehicleMenuOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur shadow-soft overflow-hidden">
                  {VEHICLE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setVehicleType(t);
                        setVehicleMenuOpen(false);
                        setErrorMsg(null);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${vehicleType === t ? "text-brand-200" : "text-neutral-100"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-neutral-400">Choose the closest category (sedan/SUV/truck/etc.).</p>
            </div>

            <div>
              <label className="block text-xs mb-1 text-neutral-300">Specific vehicle (optional)</label>
              <input
                value={vehicleSpecific}
                onChange={(e) => setVehicleSpecific(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="e.g., 2018 Toyota Camry (if known)"
              />
            </div>
          </div>

          <button
            onClick={startChat}
            disabled={loadingDealerData}
            className="mt-4 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white py-2 font-medium disabled:opacity-70"
          >
            {loadingDealerData ? "Preparing…" : "Start"}
          </button>

          <button
            onClick={restartAssessment}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/0 hover:bg-white/5 text-neutral-200 py-2 text-sm"
            type="button"
          >
            Restart
          </button>

          {prefs?.notes ? (
            <p className="mt-3 text-xs text-neutral-400">
              Dealer note: <span className="italic">{prefs.notes}</span>
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  // =========================
  // DONE
  // =========================
  if (stage === "done") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-950 flex flex-col items-center px-4 py-10 text-neutral-100">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          {assessmentId ? (
            <div className="text-sm text-neutral-300">
              <p className="font-semibold text-emerald-300 mb-2">Thank you!</p>
              <p>Your answers were submitted. The dealership will review the results with you.</p>
            </div>
          ) : (
            <div className="text-sm text-neutral-300">
              <p className="font-semibold text-emerald-300 mb-2">Demo Result</p>
              <p className="mb-2">
                <span className="font-semibold">Risk:</span>{" "}
                <span className="font-bold uppercase text-brand-200">{riskResult?.risk || "medium"}</span>
              </p>
              <p>{riskResult?.reasoning}</p>
            </div>
          )}

          {errorMsg ? (
            <div className="mt-4 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm">{errorMsg}</div>
          ) : null}
        </div>
      </main>
    );
  }

  // =========================
  // CHAT
  // =========================
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-950 flex flex-col items-center px-4 py-6 text-neutral-100">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-soft overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-semibold text-brand-200">Chat</div>
            <div className="text-xs text-neutral-300">
              Progress: {progressPct}% <span className="ml-2 text-[11px] text-neutral-400">• Asked: {asked.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={restartAssessment}
              className="text-xs px-3 py-1 rounded-full border border-white/15 hover:bg-white/5 text-neutral-200"
              type="button"
              title="Clear memory & restart"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="p-4 h-[60vh] overflow-y-auto space-y-3 chat-scroll">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === "assistant" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={
                  m.role === "assistant"
                    ? `max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm border border-white/10 ${
                        m.kind === "clarify" ? "text-neutral-200" : ""
                      }`
                    : "max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-b from-brand-600 to-brand-700 text-white px-3 py-2 text-sm shadow-sm border border-white/10"
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm flex items-center gap-2 border border-white/10">
                <span className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                Thinking…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {errorMsg && <div className="px-4 pb-2 text-sm text-red-200">{errorMsg}</div>}

        <div className="p-4 border-t border-white/10 flex gap-2 items-end">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && !done && input.trim()) handleSend();
                }
              }}
              placeholder="Type your response…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none resize-none min-h-[44px] max-h-28 leading-5 focus:ring-2 focus:ring-brand-500/40"
              disabled={busy || done}
            />
            <div className="mt-1 text-[11px] text-neutral-400">
              Press <span className="font-semibold">Enter</span> to send • <span className="font-semibold">Shift+Enter</span> for new line
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={busy || done || !input.trim()}
            className="h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 font-medium shadow-sm"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
