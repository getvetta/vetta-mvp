// app/layout.tsx
import { type Metadata } from 'next';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import Image from "next/image";
import Link from "next/link";
import '@/styles/globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vetta – AI Risk Assessment',
  description: 'AI-powered risk assessment for Buy Here Pay Here dealerships',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white`}
        >
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200/70 dark:border-gray-700/60">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="h-14 sm:h-16 flex items-center justify-between">
                
                {/* Logo + Name */}
                <Link href="/" className="flex items-center gap-2">
                  <Image
                    src="/images/vetta-logo.png"
                    alt="Vetta Logo"
                    width={32}
                    height={32}
                    className="rounded-full"
                    priority
                  />
                  <span className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
                    Vetta
                  </span>
                </Link>

                {/* Auth buttons */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="h-9 sm:h-10 px-3 sm:px-4 rounded-full border border-blue-700 dark:border-blue-300 text-blue-700 dark:text-blue-300 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="h-9 sm:h-10 px-3 sm:px-4 rounded-full bg-blue-700 text-white text-sm hover:bg-blue-800 transition">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="min-h-screen pt-16 sm:pt-20">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
