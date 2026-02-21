// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { QRCodeCanvas } from "qrcode.react";

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

  facts?: any | null;
  vehicle_type?: string | null;
  vehicle_specific?: string | null;
};

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
  if (s === "locked") return "bg-red-500/15 text-red-200 border border-red-500/25";
  return "bg-white/5 text-neutral-300 border border-white/10";
}

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

function shortLine(s: string, max = 120) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function parseDealerFitFromReasoning(reasoning?: string | null) {
  const text = String(reasoning || "");
  const idx = text.toLowerCase().lastIndexOf("dealer profile fit:");
  if (idx === -1) return null;
  return text.slice(idx + "dealer profile fit:".length).trim() || null;
}

function getVehicleSummary(a: Assessment) {
  const vt = (a.vehicle_type || a.facts?.vehicle_type || "").toString().trim();
  const vs = (a.vehicle_specific || a.facts?.vehicle_specific || "").toString().trim();
  if (!vt && !vs) return null;

  const labelType = vt ? vt.toUpperCase() : "";
  if (labelType && vs) return `${labelType} • ${vs}`;
  if (labelType) return labelType;
  return vs;
}

function formatPhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function getBestName(a: Assessment) {
  const n1 = (a.customer_name || "").trim();
  const n2 = (a.facts?.customer_name || "").toString().trim();
  const n3 = (a.facts?.name || "").toString().trim();
  const n4 = (a.facts?.applicant_name || "").toString().trim();
  return n1 || n2 || n3 || n4 || "Customer";
}

function getBestPhone(a: Assessment) {
  const p1 = (a.customer_phone || "").trim();
  const p2 = (a.facts?.customer_phone || "").toString().trim();
  const p3 = (a.facts?.phone || "").toString().trim();
  const p4 = (a.facts?.applicant_phone || "").toString().trim();
  return p1 || p2 || p3 || p4 || "";
}

function isMissingColumnError(msg: string) {
  const m = msg.toLowerCase();
  return m.includes("does not exist") || m.includes("column") || m.includes("schema cache");
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerLoading, setDealerLoading] = useState(false);
  const [dealerName, setDealerName] = useState<string>("");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // QR modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrAssessmentId, setQrAssessmentId] = useState<string>("");
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>("");

  const printRef = useRef<HTMLDivElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  async function fetchDealerIdForUser(userId: string) {
    setDealerLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase.from("profiles").select("dealer_id").eq("id", userId).limit(1);

    setDealerLoading(false);

    if (error) {
      setDealerId(null);
      setErrorMsg(`Could not load dealer mapping from profiles. (${error.message})`);
      return;
    }

    const firstRow = Array.isArray(data) ? data[0] : null;
    const dId = (firstRow?.dealer_id as string | null) ?? null;

    setDealerId(dId);

    if (!dId) {
      setErrorMsg("Dealer mapping missing. Your account does not have profiles.dealer_id set, so Vetta can’t create assessments yet.");
    }
  }

  async function fetchDealerNameById(dId: string) {
    try {
      const { data, error } = await supabase
        .from("dealers")
        .select("name, dealer_name, dealership_name, slug")
        .eq("id", dId)
        .maybeSingle();

      if (error) {
        setDealerName("");
        return;
      }

      const name =
        String((data as any)?.dealership_name || "").trim() ||
        String((data as any)?.dealer_name || "").trim() ||
        String((data as any)?.name || "").trim();

      setDealerName(name || "");
    } catch {
      setDealerName("");
    }
  }

  async function getPublicDealerKey(dId: string) {
    try {
      const { data, error } = await supabase.from("dealers").select("slug, name").eq("id", dId).maybeSingle();
      if (!error && data) {
        const slug = String((data as any)?.slug || "").trim();
        const name = String((data as any)?.name || "").trim();
        return slug || name || dId;
      }
      return dealerName || dId;
    } catch {
      return dealerName || dId;
    }
  }

  const loadAssessments = async (dId: string) => {
    setLoading(true);
    setErrorMsg(null);

    const attempt1 = await supabase
      .from("assessments")
      .select("id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning, facts, vehicle_type, vehicle_specific")
      .eq("dealer_id", dId)
      .order("created_at", { ascending: false });

    if (!attempt1.error) {
      setAssessments((attempt1.data as any) || []);
      setLoading(false);
      return;
    }

    if (isMissingColumnError(String(attempt1.error.message || ""))) {
      const attempt2 = await supabase
        .from("assessments")
        .select("id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning, facts, vehicle_type, vehicle_specific")
        .eq("dealership_id" as any, dId)
        .order("created_at", { ascending: false });

      if (!attempt2.error) {
        setAssessments((attempt2.data as any) || []);
        setLoading(false);
        return;
      }

      const attempt3 = await supabase
        .from("assessments")
        .select("id, created_at, customer_name, customer_phone, status, mode, flow, risk_score, reasoning, facts")
        .eq("dealer_id", dId)
        .order("created_at", { ascending: false });

      if (attempt3.error) {
        setErrorMsg(attempt3.error.message);
        setAssessments([]);
      } else {
        setAssessments((attempt3.data as any) || []);
      }

      setLoading(false);
      return;
    }

    setErrorMsg(attempt1.error.message);
    setAssessments([]);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const u = data.session?.user ?? null;
      setUser(u);
      setAuthLoading(false);

      if (u?.id) {
        await fetchDealerIdForUser(u.id);
      } else {
        setDealerId(null);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);

      if (u?.id) {
        await fetchDealerIdForUser(u.id);
      } else {
        setDealerId(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!dealerId) return;

    loadAssessments(dealerId);
    fetchDealerNameById(dealerId);

    const channel = supabase
      .channel(`assessments_${dealerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessments", filter: `dealer_id=eq.${dealerId}` }, () => {
        loadAssessments(dealerId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  function buildChatbotUrl(dealerKeyForUrl: string, assessmentId: string) {
    return `${window.location.origin}/chatbot?dealer=${encodeURIComponent(dealerKeyForUrl)}&assessmentId=${encodeURIComponent(assessmentId)}`;
  }

  function buildPublicChatbotUrl(dealerKeyForUrl: string) {
    return `${window.location.origin}/chatbot?dealer=${encodeURIComponent(dealerKeyForUrl)}`;
  }

  // ✅ Start on dealer device: create assessment ONLY, then redirect.
  async function startOnDealerDevice() {
    if (!dealerId) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/start-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
        body: JSON.stringify({ kind: "device" }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not create assessment");

      loadAssessments(dealerId);

      const dealerKeyForUrl =
        String(json?.dealerKey || json?.dealer || json?.dealer_id || json?.dealerId || "").trim() || String(dealerId);

      const assessmentId = String(json?.assessmentId || json?.id || "").trim();
      if (!assessmentId) throw new Error("Missing assessmentId from server");

      const url = buildChatbotUrl(dealerKeyForUrl, assessmentId);
      window.location.assign(url);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not create assessment");
    } finally {
      setCreating(false);
    }
  }

  // ✅ QR Code: /chatbot?dealer=...
  async function openQr() {
    if (!dealerId) return;
    setCreating(true);
    setErrorMsg(null);

    try {
      const dealerKeyForUrl = await getPublicDealerKey(dealerId);
      const url = buildPublicChatbotUrl(dealerKeyForUrl);

      setQrUrl(url);
      setQrAssessmentId("Created after customer submits info");
      setQrPngDataUrl(""); // will be populated after canvas renders
      setQrModalOpen(true);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not generate QR");
    } finally {
      setCreating(false);
    }
  }

  // When modal opens and QR renders, grab PNG for printing
  useEffect(() => {
    if (!qrModalOpen) return;

    const t = setTimeout(() => {
      try {
        const canvas = qrCanvasRef.current;
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          setQrPngDataUrl(dataUrl);
        }
      } catch {
        // ignore
      }
    }, 50);

    return () => clearTimeout(t);
  }, [qrModalOpen, qrUrl]);

  const copyQrLink = async () => {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
  };

  const printQr = () => {
    const el = printRef.current;
    if (!el) return;

    const safeDealer = (dealerName || "Dealer").replace(/[<>]/g, "");

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeDealer} - Vetta QR</title>
    <style>
      * { box-sizing: border-box; }
      @page { margin: 14mm; }
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: #ffffff;
        color: #0B1220;
        margin: 0;
        padding: 0;
      }
      .sheet { width: 100%; display: flex; justify-content: center; }
      .card {
        width: 190mm;
        max-width: 720px;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 18px 18px 16px 18px;
      }
      .top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .dealer { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
      .tag {
        font-size: 12px; font-weight: 800; color: #1E3A8A;
        background: #EEF2FF; border: 1px solid #E0E7FF;
        padding: 6px 10px; border-radius: 999px; white-space: nowrap;
      }
      .subtitle { margin-top: 8px; font-size: 12px; color: #334155; }
      .title { margin-top: 12px; font-size: 14px; font-weight: 900; letter-spacing: -0.01em; }
      .qrWrap { margin-top: 14px; display: flex; justify-content: center; padding: 10px 0; }
      .qrBox {
        width: 330px; height: 330px; border: 1px solid #e5e7eb; border-radius: 18px;
        padding: 14px; display:flex; align-items:center; justify-content:center; background: #ffffff;
      }
      .scan { margin-top: 10px; text-align: center; font-size: 11px; color: #475569; }
      .meta { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      .label { font-size: 10px; font-weight: 800; color: #475569; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
      .value { font-size: 11px; color: #0B1220; word-break: break-all; margin-top: 4px; }
      .note { margin-top: 10px; font-size: 11px; color: #64748b; }
      .footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .powered { font-size: 11px; color: #64748b; }
      .brand { font-size: 11px; font-weight: 900; letter-spacing: 0.08em; }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${el.innerHTML}
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
</html>
    `.trim();

    const w = window.open("", "_blank", "width=920,height=760");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const deleteAssessment = async (assessmentId: string) => {
    if (!dealerId) return;

    const ok = confirm("Delete this applicant/assessment? This cannot be undone.");
    if (!ok) return;

    setDeletingId(assessmentId);
    setErrorMsg(null);

    const { error } = await supabase.from("assessments").delete().eq("id", assessmentId).eq("dealer_id", dealerId);

    if (error) setErrorMsg(error.message);
    else setAssessments((prev) => prev.filter((a) => a.id !== assessmentId));

    setDeletingId(null);
  };

  const totals = useMemo(() => {
    const total = assessments.length;
    const completed = assessments.filter((a) => String(a.status || "").toLowerCase() === "completed").length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [assessments]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="h-12 w-72 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-neutral-950 text-neutral-100">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <h1 className="text-xl font-semibold">Dealer Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-300">You must be signed in to view the dashboard.</p>
          <Link href="/signin">
            <button className="mt-5 h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium">Go to Sign In</button>
          </Link>
        </div>
      </main>
    );
  }

  if (dealerLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-neutral-950 text-neutral-100">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <div className="font-semibold mb-3">Dashboard</div>
          <div className="h-10 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          <p className="mt-3 text-sm text-neutral-300">Loading dealer profile…</p>
        </div>
      </main>
    );
  }

  if (!dealerId) {
    return (
      <main className="min-h-screen px-4 py-10 bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
          <div className="font-semibold mb-3">Dashboard</div>

          <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-sm">
            <div className="font-semibold mb-1">Dealer mapping missing</div>
            <div className="mb-2">
              Your account does not have <code className="font-mono">profiles.dealer_id</code> set, so Vetta can’t create assessments yet.
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-200 text-sm">{errorMsg}</div>
          )}

          <div className="mt-4 text-xs text-neutral-400">
            Debug: auth user id = <span className="font-mono">{user?.id}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Assessments</h1>
            <p className="mt-1 text-sm text-neutral-300">
              Start in-store on your device, or use <span className="text-neutral-100 font-semibold">QR Code</span> so the customer can use their phone.
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-200">Total: {totals.total}</span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">
                Completed: {totals.completed}
              </span>
              <span className="px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-200">In progress: {totals.pending}</span>
            </div>
          </div>

          <div className="h-10 w-2" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-soft overflow-hidden">
          <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="font-semibold">Recent assessments</div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={startOnDealerDevice}
                disabled={creating}
                className="h-11 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white font-medium"
              >
                Start on dealer device
              </button>

              <button
                onClick={openQr}
                disabled={creating}
                className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-70 text-neutral-100"
              >
                QR Code
              </button>

              <button
                onClick={() => dealerId && loadAssessments(dealerId)}
                disabled={loading}
                className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-70 text-neutral-100"
              >
                Refresh
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="m-5 p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-sm">{errorMsg}</div>
          )}

          {loading ? (
            <div className="m-5 h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : assessments.length === 0 ? (
            <div className="text-center py-12 text-sm text-neutral-300">
              <p className="font-semibold mb-1 text-neutral-100">No assessments yet.</p>
              <p>Use “Start on dealer device” or “QR Code”.</p>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {assessments.map((a) => {
                const fit = parseDealerFitFromReasoning(a.reasoning);
                const vehicle = getVehicleSummary(a);
                const bestName = getBestName(a);
                const bestPhone = getBestPhone(a);

                return (
                  <div key={a.id} className="rounded-2xl border border-white/10 bg-neutral-950/40 hover:bg-neutral-950/55 transition p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="font-semibold truncate">{bestName}</div>
                          <span className="text-xs text-neutral-400">• {new Date(a.created_at).toLocaleString()}</span>
                        </div>

                        {bestPhone ? <div className="mt-1 text-xs text-neutral-400">{formatPhone(bestPhone)}</div> : null}

                        {vehicle ? (
                          <div className="mt-2 text-xs text-neutral-300">
                            <span className="text-neutral-400">Vehicle:</span> {shortLine(vehicle, 160)}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className={`px-3 py-1 rounded-full ${statusBadge(a.status)}`}>{prettyStatus(a.status)}</span>
                          <span className={`px-3 py-1 rounded-full ${riskBadge(a.risk_score)}`}>Risk: {prettyRisk(a.risk_score)}</span>
                        </div>

                        {fit ? (
                          <div className="mt-3 text-xs text-neutral-300">
                            <span className="text-neutral-400">Dealer fit:</span> {shortLine(fit, 160)}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 lg:items-center">
                        <Link href={`/dashboard/assessments/${a.id}`} className="w-full sm:w-auto">
                          <button className="h-11 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium w-full">View Details</button>
                        </Link>

                        <button
                          onClick={() => deleteAssessment(a.id)}
                          disabled={deletingId === a.id}
                          className="h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white"
                        >
                          {deletingId === a.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          Tip: Applicant Info is collected in the chatbot intro screen — so name/phone/vehicle always save in the same place for both Dealer Device + QR.
        </div>
      </div>

      {/* QR Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setQrModalOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-neutral-100">QR Code</div>
                <div className="text-sm text-neutral-400">Customer scans → enters Applicant Info → then chat begins.</div>
              </div>
              <button
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100"
                onClick={() => setQrModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div ref={printRef} className="mt-4">
              <div className="card">
                <div className="top">
                  <div className="dealer">{dealerName || "Dealer"}</div>
                  <div className="tag">Pre-Approval Screening</div>
                </div>

                <div className="subtitle">Vetta customer intake — scan the QR code to begin.</div>
                <div className="title">Scan to begin your assessment</div>

                <div className="qrWrap">
                  <div className="qrBox">
                    <QRCodeCanvas
                      value={qrUrl || "https://getvetta.app"}
                      size={280}
                      includeMargin
                      level="M"
                      ref={(node) => {
                        // qrcode.react ref gives canvas element
                        qrCanvasRef.current = node as unknown as HTMLCanvasElement | null;
                      }}
                    />
                  </div>
                </div>

                <div className="scan">Use your phone camera to scan the code and follow the link.</div>

                <div className="meta">
                  <div className="label">Backup URL</div>
                  <div className="value">{qrUrl || "—"}</div>

                  <div className="label">Assessment ID</div>
                  <div className="value">{qrAssessmentId || "—"}</div>

                  <div className="note">If the camera doesn’t auto-open, open the camera app and point it at the QR code (or type the backup URL).</div>

                  <div className="footer">
                    <div className="powered">Powered by Vetta</div>
                    <div className="brand">VETTA</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  await copyQrLink();
                  alert("Copied QR URL!");
                }}
                className="h-11 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium"
              >
                Copy URL
              </button>

              <button
                onClick={() => window.open(qrUrl, "_blank")}
                className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100"
              >
                Open URL
              </button>

              <button
                onClick={() => {
                  // Ensure print has an <img> if you want it (optional)
                  // Currently print uses the HTML inside printRef (canvas prints fine in most browsers)
                  printQr();
                }}
                className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100"
              >
                Print QR
              </button>
            </div>

            {/* Optional: if you want a PNG preview/backup */}
            {qrPngDataUrl ? (
              <div className="mt-3 text-xs text-neutral-500">
                QR PNG ready (for printing reliability).{" "}
                <button
                  className="underline text-neutral-300"
                  onClick={() => {
                    const w = window.open("", "_blank");
                    if (w) w.document.write(`<img src="${qrPngDataUrl}" style="max-width:100%;height:auto;" />`);
                  }}
                >
                  Open PNG
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}