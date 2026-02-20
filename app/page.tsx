"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);

    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-14 bg-neutral-950 text-neutral-100">
      {/* No gray card container */}
      <div className="flex flex-col items-center">
        <h1 className="font-display text-6xl sm:text-7xl tracking-wide text-white">VETTA</h1>
        <p className="mt-3 text-base sm:text-lg text-neutral-300 text-center">
          AI-powered Assessment
        </p>

        <div className="mt-10 w-full max-w-md flex flex-col gap-3">
          {!mounted ? (
            <div className="h-12 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : !user ? (
            <>
              <Link href="/signin">
                <button className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium">
                  Dealer Sign In
                </button>
              </Link>

              <Link href="/signup">
                <button className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100">
                  Sign Up
                </button>
              </Link>

              <Link href="/chatbot?dealer=demo">
                <button className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100">
                  Try Demo
                </button>
              </Link>
            </>
          ) : (
            <Link href="/dashboard">
              <button className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium">
                Go to Dashboard
              </button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
