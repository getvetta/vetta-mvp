// app/dashboard/assessment/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

type Msg = { role: "assistant" | "user"; content?: string; kind?: string };

type Assessment = {
  id: string;
  created_at: string;

  customer_name: string | null;
  customer_phone: string | null;

  status: string | null;
  mode: string | null;
  flow: string | null;

  risk_score: string | null;
  reasoning?: string | null;

  // ✅ NEW: clean UI fields
  result_summary?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;

  facts?: any | null;
  vehicle_type?: string | null;
  vehicle_specific?: string | null;

  answers?: any | null;
};

function prettyRisk(risk: string | null) {
  const r = String(risk || "").toLowerCase();
  if (!r || r === "pending") return "Pending";
  return r[0].toUpperCase() + r.slice(1);
}

function prettyStatus(status: string | null) {
  const s = String(status || "").toLowerCase();
  if (!s) return "n/a";
  if (s === "in_progress") return "In progress";
  return s[0].toUpperCase() + s.slice(1);
}

function riskBadge(risk: string | null) {
  const r = String(risk || "").toLowerCase();
  if (!r || r === "pending") return "bg-white/5 text-neutral-300 border border-white/10";
  if (r === "low") return "bg-emerald-500/15 text-emerald-200 border border-emerald-500/25";
  if (r === "high") return "bg-red-500/15 text-red-200 border border-red-500/25";
  return "bg-amber-500/15 text-amber-200 border border-amber-500/25";
}

function statusBadge(status: string | null) {
  const s = String(status || "").toLowerCase();
  if (!s) return "bg-white/5 text-neutral-300 border border-white/10";
  if (s === "completed") return "bg-emerald-500/15 text-emerald-200 border border-emerald-500/25";
  if (s === "started" || s === "in_progress") return "bg-brand-500/15 text-brand-200 border border-brand-500/25";
  if (s === "locked") return "bg-red-500/15 text-red-200 border border-brand-500/25";
  return "bg-white/5 text-neutral-300 border border-white/10";
}

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString()}`;
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function getTranscript(a: Assessment): Msg[] {
  const arr = safeArray<any>(a.answers);

  return arr
    .map((m): Msg => {
      const role: Msg["role"] = m?.role === "user" ? "user" : "assistant";
      return {
        role,
        content: String(m?.content ?? m?.text ?? "").trim(),
        kind: m?.kind ? String(m.kind) : undefined,
      };
    })
    .filter((m) => (m.content || "").length > 0);
}

function parseMoneyFromReasoning(reasoning: string, label: string): number | null {
  const r = reasoning || "";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*:\\s*[^$\\d]*\\$?([\\d,]+)`, "i");
  const m = r.match(re);
  if (!m?.[1]) return null;
  const num = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function calcBTI(income: number | null, bills: number | null) {
  if (!Number.isFinite(income as number) || !Number.isFinite(bills as number)) return null;
  if ((income as number) <= 0) return null;
  const ratio = (bills as number) / (income as number);
  if (!Number.isFinite(ratio)) return null;
  return ratio;
}

export default function AssessmentDetailPage() {
  const router = useRouter();
  const params = useParams();

  // ✅ Robust param parsing (handles array params too)
  const rawId = (params as any)?.id;
  const id = Array.isArray(rawId) ? rawId[0] : String(rawId || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Assessment | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      // ✅ Guard: never fetch without an id
      if (!id) {
        setError("Missing assessment id");
        setRow(null);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in to view this assessment.");
        setRow(null);
        return;
      }

      const res = await fetch(`/api/assessments/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to load assessment.");
        setRow(null);
        return;
      }

      setRow((json?.assessment as Assessment) || null);
    } catch (e: any) {
      setError(e?.message || "Unexpected error loading assessment.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  async function downloadJSON() {
    if (!row) return;
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment-${row.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteThisAssessment() {
    const ok = confirm("Delete this applicant/assessment? This cannot be undone.");
    if (!ok) return;

    try {
      setDeleting(true);
      setError(null);

      if (!id) {
        setError("Missing assessment id");
        return;
      }

      const { error: delErr } = await supabase.from("assessments").delete().eq("id", id);

      if (delErr) {
        setError(delErr.message);
        return;
      }

      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to delete assessment.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing assessment id");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const facts = row?.facts || {};
  const transcript = useMemo(() => (row ? getTranscript(row) : []), [row]);

  const vehicleSummary = useMemo(() => {
    const vt = String(row?.vehicle_type || facts?.vehicle_type || "").trim();
    const vs = String(row?.vehicle_specific || facts?.vehicle_specific || "").trim();
    if (!vt && !vs) return null;
    const type = vt ? vt.toUpperCase() : "";
    if (type && vs) return `${type} • ${vs}`;
    return type || vs;
  }, [row, facts]);

  const affordability = useMemo(() => {
    const reasoning = String(row?.reasoning || "");

    const incomeFacts = Number(facts?.income_monthly);
    const billsFacts = Number(facts?.bills_monthly);

    const income =
      Number.isFinite(incomeFacts) && incomeFacts > 0
        ? incomeFacts
        : parseMoneyFromReasoning(reasoning, "Income (estimated)");

    const billsParsed =
      parseMoneyFromReasoning(reasoning, "Bills (rent + phone + other)") ??
      parseMoneyFromReasoning(reasoning, "Bills");

    const bills = Number.isFinite(billsFacts) && billsFacts >= 0 ? billsFacts : billsParsed;

    const bti = calcBTI(income ?? null, bills ?? null);

    return { income, bills, bti };
  }, [facts, row?.reasoning, row]);

  const summaryBlock = useMemo(() => {
    const summary = String(row?.result_summary || "").trim();
    const pros = safeArray<string>(row?.pros).filter(Boolean);
    const cons = safeArray<string>(row?.cons).filter(Boolean);

    return {
      summary: summary || null,
      pros: pros.length ? pros.slice(0, 2) : null,
      cons: cons.length ? cons.slice(0, 2) : null,
    };
  }, [row]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <div className="h-8 w-56 bg-white/10 rounded animate-pulse" />
          <div className="mt-5 h-24 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          <div className="mt-4 h-48 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (error || !row) {
    return (
      <main className="min-h-screen px-4 py-10 bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <Link href="/dashboard" className="text-sm text-brand-200 hover:underline">
              ← Back to dashboard
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-sm">
            {error || "Assessment not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-brand-200 hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Applicant Details</h1>
            <p className="mt-1 text-sm text-neutral-300">
              Created:{" "}
              <span className="text-neutral-200">
                {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-soft overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-400">Applicant</div>
                <div className="text-2xl font-bold text-neutral-100">{row.customer_name || "Customer"}</div>
                {row.customer_phone ? <div className="text-sm text-neutral-300">{row.customer_phone}</div> : null}
                {vehicleSummary ? (
                  <div className="mt-2 text-sm text-neutral-300">
                    <span className="text-neutral-400">Vehicle:</span>{" "}
                    <span className="text-neutral-200">{vehicleSummary}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs ${riskBadge(row.risk_score)}`}>
                  {prettyRisk(row.risk_score)}
                </span>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs ${statusBadge(row.status)}`}>
                  {prettyStatus(row.status)}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-neutral-200">Affordability</div>

                <div className="mt-2 text-sm text-neutral-300 space-y-1">
                  <div>
                    Income (est):{" "}
                    <span className="text-neutral-100">
                      {Number.isFinite(affordability.income as number) ? money(affordability.income) : "—"}{" / mo"}
                    </span>
                  </div>
                  <div>
                    Bills (est):{" "}
                    <span className="text-neutral-100">
                      {Number.isFinite(affordability.bills as number) ? money(affordability.bills) : "—"}{" / mo"}
                    </span>
                  </div>
                  <div>
                    Bills-to-income:{" "}
                    <span className="text-neutral-100">
                      {affordability.bti != null ? `${Math.round(affordability.bti * 100)}%` : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-400">
                  Dealer note: anything near/over 60% means one unexpected expense can break the payment.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={downloadJSON} className="h-11 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium">
                  Download JSON
                </button>

                <button
                  onClick={deleteThisAssessment}
                  disabled={deleting}
                  className="h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white font-medium"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>

          {/* ✅ Result Summary — keep only Details */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-soft overflow-hidden">
            <div className="p-5 border-b border-white/10 font-semibold">Result Summary</div>

            <div className="p-5 space-y-5">
              {row.reasoning ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs text-neutral-400 mb-2">Details</div>
                  <pre className="text-sm text-neutral-200 whitespace-pre-wrap leading-6">{row.reasoning}</pre>
                </div>
              ) : (
                <div className="text-sm text-neutral-300">
                  No results saved yet. If the assessment is still in progress, this is normal.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-soft overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">Chat Replay</div>
            <div className="text-xs text-neutral-400">
              Messages: <span className="text-neutral-200">{transcript.length}</span>
            </div>
          </div>

          <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            {transcript.length === 0 ? (
              <div className="text-sm text-neutral-300">
                No transcript saved yet. This will populate when the assessment completes and answers are stored.
              </div>
            ) : (
              transcript.map((m, idx) => (
                <div key={idx} className={m.role === "assistant" ? "flex justify-start" : "flex justify-end"}>
                  <div
                    className={
                      m.role === "assistant"
                        ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm border border-white/10 text-neutral-200"
                        : "max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-b from-brand-600 to-brand-700 text-white px-3 py-2 text-sm shadow-sm border border-white/10"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-5 py-4 text-xs text-neutral-500 border-t border-white/10">
            Tip: If transcript is empty, the assessment likely didn’t hit the finalize step that saves{" "}
            <code className="mx-1 font-mono">answers</code>.
          </div>
        </div>
      </div>
    </main>
  );
}