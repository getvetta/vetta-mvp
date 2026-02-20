"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const signIn = async () => {
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">

        <h1 className="text-2xl font-extrabold tracking-tight text-brand-200 mb-2">
          Dealer Sign In
        </h1>

        <p className="text-sm text-neutral-400 mb-4">
          Log in to view assessments and AI risk results.
        </p>

        {msg && (
          <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {msg}
          </div>
        )}

        <label className="text-xs mb-1 block">Email</label>
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-brand-500/40"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dealership.com"
        />

        <label className="text-xs mb-1 block">Password</label>
        <input
          type="password"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-4 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 font-medium"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="mt-4 text-sm text-neutral-400">
          Don’t have access?{" "}
          <Link href="/signup" className="text-brand-300 underline">
            Request dealer account
          </Link>
        </div>

        <div className="mt-3 text-xs text-neutral-500">
          Want to see customer flow?{" "}
          <Link href="/chatbot?dealer=demo" className="text-brand-300 underline">
            Try demo assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
