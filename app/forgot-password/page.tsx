// app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sendReset = async () => {
    setMsg(null);
    setLoading(true);

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "";

      const redirectTo = `${origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) setMsg(error.message);
      else setMsg("Check your email for a password reset link.");
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Enter your email and we’ll send you a reset link.
        </p>

        <label className="block mt-5 text-xs text-neutral-400">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dealership.com"
          className="mt-2 w-full h-11 rounded-xl bg-neutral-950/40 border border-white/10 px-3 text-neutral-100 outline-none focus:border-brand-500"
        />

        <button
          onClick={sendReset}
          disabled={loading || !email.trim()}
          className="mt-4 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white font-medium"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        {msg ? (
          <div className="mt-4 text-sm text-neutral-200 border border-white/10 bg-white/5 rounded-xl p-3">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 text-sm text-neutral-300">
          <Link href="/signin" className="text-brand-200 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}