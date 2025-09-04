'use client';

import Image from "next/image";
import { SignInButton, SignedOut, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white px-4 py-12 transition-colors">
      
      {/* Logo */}
      <Image
        src="/images/vetta-logo.png"
        alt="Vetta AI Logo"
        width={120}
        height={120}
        className="mb-6"
        priority
      />

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-blue-800 dark:text-blue-300 mb-4 text-center">
        Vetta AI
      </h1>

      {/* Subtitle */}
      <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 dark:text-gray-300 mb-10 text-center max-w-2xl">
        The AI-powered risk assessment system built for Buy Here Pay Here dealerships.
      </p>

      {/* Auth + Demo Buttons */}
      <div className="w-full flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full sm:w-auto bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:bg-blue-800 active:scale-95 transition">
              Dealer Sign In
            </button>
          </SignInButton>
          <Link href="/chatbot?dealer=demo" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-medium shadow hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition">
              Try Demo
            </button>
          </Link>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:bg-blue-800 active:scale-95 transition">
                Go to Dashboard
              </button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </div>

      {/* Theme Toggle */}
      <div className="mt-12">
        <ThemeToggle />
      </div>
    </main>
  );
}
