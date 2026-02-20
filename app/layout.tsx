// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "@/styles/globals.css";

import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Vetta",
  description: "Vetta — AI-powered assessment platform for dealerships",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          displayFont.variable,
          "antialiased bg-neutral-950 text-neutral-100",
        ].join(" ")}
      >
        {/* Global header (hidden on /chatbot inside Header.tsx) */}
        <Header />

        {/* App content */}
        <main className="min-h-screen pt-16 sm:pt-20">
          {children}
        </main>
      </body>
    </html>
  );
}
