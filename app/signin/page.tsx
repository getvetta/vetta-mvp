// app/signin/page.tsx
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
        <h1 className="text-xl font-semibold">Dealer Sign In</h1>
        <p className="mt-2 text-sm text-neutral-300">Log in to view assessments and AI risk results.</p>

        <label className="block mt-5 text-xs text-neutral-400">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dealership.com"
          className="mt-2 w-full h-11 rounded-xl bg-neutral-950/40 border border-white/10 px-3 text-neutral-100 outline-none focus:border-brand-500"
        />

        <label className="block mt-4 text-xs text-neutral-400">Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          className="mt-2 w-full h-11 rounded-xl bg-neutral-950/40 border border-white/10 px-3 text-neutral-100 outline-none focus:border-brand-500"
        />

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-5 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white font-medium"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="mt-3 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-200 hover:underline">
            Forgot password?
          </Link>

          <Link href="/signup" className="text-neutral-300 hover:text-neutral-100">
            Sign up
          </Link>
        </div>

        {msg ? (
          <div className="mt-4 p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-sm">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 text-sm text-neutral-300">
          Don’t have access?{" "}
          <a className="text-brand-200 hover:underline" href="mailto:support@vetta.services">
            Request dealer account
          </a>
        </div>

        <div className="mt-2 text-sm text-neutral-300">
          Want to see customer flow?{" "}
          <Link className="text-brand-200 hover:underline" href="/chatbot?demo=1">
            Try demo assessment
          </Link>
        </div>
      </div>
    </main>
  );
}