// app/reset-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setReady(true);

      if (!data.session) {
        setMsg(
          "If updating fails, open the reset link from your email again (some email apps open in a preview browser)."
        );
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setMsg(null);

    if (pw1.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) setMsg(error.message);
      else setMsg("Password updated. You can sign in now.");
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-soft">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-neutral-300">Set a new password for your dealer account.</p>

        {!ready ? (
          <div className="mt-5 h-11 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
        ) : (
          <>
            <label className="block mt-5 text-xs text-neutral-400">New password</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="mt-2 w-full h-11 rounded-xl bg-neutral-950/40 border border-white/10 px-3 text-neutral-100 outline-none focus:border-brand-500"
            />

            <label className="block mt-4 text-xs text-neutral-400">Confirm new password</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="mt-2 w-full h-11 rounded-xl bg-neutral-950/40 border border-white/10 px-3 text-neutral-100 outline-none focus:border-brand-500"
            />

            <button
              onClick={save}
              disabled={loading}
              className="mt-5 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white font-medium"
            >
              {loading ? "Saving..." : "Update password"}
            </button>
          </>
        )}

        {msg ? (
          <div className="mt-4 text-sm text-neutral-200 border border-white/10 bg-white/5 rounded-xl p-3">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 text-sm text-neutral-300">
          <Link href="/signin" className="text-brand-200 hover:underline">
            Go to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}