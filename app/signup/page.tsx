"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const signUp = async () => {
    setMsg(null);
    setLoading(true);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setMsg("Missing NEXT_PUBLIC_SUPABASE_URL");
        setLoading(false);
        return;
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setMsg("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
        setLoading(false);
        return;
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/signin`,
        },
      });

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setMsg("Signup succeeded but no user returned.");
        setLoading(false);
        return;
      }

      setMsg("Check your email to confirm, then sign in.");
    } catch (err: any) {
      setMsg(err?.message || "Network error: Failed to fetch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">

        <h1 className="text-2xl font-extrabold tracking-tight text-brand-200 mb-2">
          Create Dealer Account
        </h1>

        <p className="text-sm text-neutral-400 mb-4">
          Email confirmation required.
        </p>

        {msg && (
          <div className="mb-3 rounded-xl border border-brand-500/25 bg-brand-500/10 px-3 py-2 text-sm text-brand-100">
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
          placeholder="Create password"
        />

        <button
          onClick={signUp}
          disabled={loading}
          className="mt-4 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 font-medium"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <div className="mt-4 text-sm text-neutral-400">
          Already have account?{" "}
          <Link href="/signin" className="text-brand-300 underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}