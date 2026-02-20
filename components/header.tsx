"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function Header() {
  const pathname = usePathname();

  // ✅ Compute once, but DO NOT early-return before hooks
  const hideHeader = useMemo(() => {
    return Boolean(pathname && pathname.startsWith("/chatbot"));
  }, [pathname]);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    // user state updates via onAuthStateChange
  };

  // ✅ Now it's safe to return conditionally (hooks already ran)
  if (hideHeader) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="font-display text-2xl tracking-wide text-white">VETTA</div>
        </Link>

        {/* Right: Nav */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-10 w-28 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : user ? (
            <>
              <Link href="/dashboard">
                <button className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100">
                  Dashboard
                </button>
              </Link>

              <button
                onClick={onSignOut}
                className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin">
                <button className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-100">
                  Sign In
                </button>
              </Link>

              <Link href="/signup">
                <button className="h-10 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}