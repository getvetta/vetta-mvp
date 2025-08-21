'use client';

import { SignInButton, SignedOut, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-blue-50 dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-8 sm:px-6 lg:px-8 transition-colors">
      
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-800 dark:text-blue-300 mb-3 text-center">
        Vetta AI
      </h1>

      {/* Subtitle */}
      <p className="text-base sm:text-lg lg:text-xl text-gray-700 dark:text-gray-300 mb-8 text-center max-w-md sm:max-w-lg">
        AI-powered risk assessment system for Buy Here Pay Here dealerships.
      </p>

      {/* Auth Buttons */}
      <div className="w-full flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full sm:w-auto bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800 active:scale-[0.98] transition-transform">
              Dealer Sign In
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800 active:scale-[0.98] transition-transform">
                Go to Dashboard
              </button>
            </Link>
            <UserButton />
          </div>
        </SignedIn>
      </div>

      {/* Theme Toggle */}
      <div className="mt-8">
        <ThemeToggle />
      </div>
    </main>
  );
}
