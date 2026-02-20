// app/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

type AssessmentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  risk: string | null;        // or risk_score depending on your DB
  status: string | null;
  created_at: string;
};

export default function ResultsPage() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (q: string = "") => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("You must be signed in as a dealer to view results.");
        setRows([]);
        return;
      }

      const url = q
        ? `/api/assessments?q=${encodeURIComponent(q)}`
        : "/api/assessments";

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to load assessments.");
        setRows([]);
        return;
      }

      setRows(Array.isArray(json?.assessments) ? json.assessments : []);
    } catch (err) {
      console.error("Results load error:", err);
      setError("Unexpected error loading results.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="container container-py">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Assessment Results
        </h1>
        <Link href="/dashboard" className="text-sm text-brand-400 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Search by customer name or phone. Only your dealership’s results are visible here.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          placeholder="Search by name or phone..."
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xl rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button onClick={() => load(search)} className="btn btn-primary px-4">
          Search
        </button>
      </div>

      {loading && (
        <div className="glass p-4 animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
        </div>
      )}

      {error && !loading && (
        <div className="glass p-4 border border-red-400/30 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="glass mt-2">
          <div className="p-4 overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-neutral-400">No assessments found.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-left text-neutral-300">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Phone</th>
                    <th className="py-2 pr-4">Risk</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const name = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—";
                    const risk = (row.risk || "pending").toLowerCase();

                    const riskClass =
                      risk === "low"
                        ? "text-emerald-300"
                        : risk === "high"
                        ? "text-red-300"
                        : "text-amber-300";

                    return (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="py-2 pr-4 text-neutral-100">{name}</td>
                        <td className="py-2 pr-4 text-neutral-200">{row.phone || "-"}</td>
                        <td className={`py-2 pr-4 font-semibold ${riskClass}`}>
                          {(row.risk || "pending").toUpperCase()}
                        </td>
                        <td className="py-2 pr-4 capitalize text-neutral-200">
                          {row.status || "completed"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-400">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                        </td>
                        <td className="py-2 pr-2">
                          <Link
                            href={`/results/${row.id}`}
                            className="text-brand-300 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
