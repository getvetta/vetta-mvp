// app/assessment/start/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartAssessmentPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg("Please fill out all fields.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/start-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.id) {
        console.error("start-assessment error →", json);
        throw new Error(json?.error || "Failed to start assessment");
      }

      // mode: "demo" or "normal"
      const mode = json.mode || "demo";
      const id = json.id as string;

      // For now we always pass dealer=demo for demo mode.
      // Later you can switch to real dealer-specific IDs.
      if (mode === "demo") {
        router.push(`/chatbot?assessmentId=${id}&dealer=demo`);
      } else {
        // normal mode → dealer will come from session on server
        router.push(`/chatbot?assessmentId=${id}`);
      }
    } catch (err: any) {
      console.error("Start assessment failed:", err);
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-neutral-900 px-4 py-8">
      <div className="w-full max-w-md card">
        <div className="card-body">
          <h1 className="card-title mb-1">Start Your Assessment</h1>
          <p className="card-subtitle mb-4">
            A few details so the dealership knows who they’re reviewing.
          </p>

          {errorMsg && (
            <div className="mb-3 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                First Name
              </label>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                autoComplete="given-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Last Name
              </label>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                autoComplete="family-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Mobile Phone
              </label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                autoComplete="tel"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`btn btn-primary w-full mt-2 ${
                submitting ? "btn-disabled" : ""
              }`}
            >
              {submitting ? "Starting..." : "Start Assessment"}
            </button>
          </form>

          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            This demo may not store your data permanently. It’s used to help the
            dealer understand your situation better.
          </p>
        </div>
      </div>
    </main>
  );
}
