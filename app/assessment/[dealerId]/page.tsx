'use client';
import { useEffect, useMemo, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

type QA = { question: string; answer: string };
type Risk = 'low' | 'medium' | 'high';

const initialQuestions = [
  'What brings you to the dealership today?',
  'Do you have a current job? If so, how long have you been working there?',
  'How do you plan to use the vehicle?',
  'Have you financed a car before?',
  'Have there been any recent changes in your financial situation?'
];

export default function ChatbotPage({ params }: { params: { dealerId: string } }) {
  const dealerId = params.dealerId;
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<QA[]>([]);
  const [input, setInput] = useState('');
  const [finished, setFinished] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [riskResult, setRiskResult] = useState<{ risk: Risk; reasoning: string } | null>(null);

  const total = initialQuestions.length;
  const progressPct = useMemo(() => Math.round(((step) / total) * 100), [step, total]);

  useEffect(() => {
    // best-effort scan log
    fetch('/api/log-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealer_id: dealerId, event_type: 'scanned' }) }).catch(() => {});
  }, [dealerId]);

  const handleSubmit = async () => {
    setGlobalError(null);
    if (!input.trim()) return;

    const updated = [...responses, { question: initialQuestions[step], answer: input.trim() }];
    setResponses(updated);
    setInput('');

    if (!hasStarted) {
      setHasStarted(true);
      fetch('/api/log-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealer_id: dealerId, event_type: 'started' }) }).catch(() => {});
    }

    if (step + 1 < initialQuestions.length) { setStep(step + 1); return; }

    setSubmitting(true);
    try {
      const aiRes = await fetch('/api/analyze-risk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: updated })
      });
      if (!aiRes.ok) throw new Error('Risk analysis failed');
      const aiJson = await aiRes.json();
      const risk: Risk = (aiJson.risk as Risk) ?? 'medium';
      const reasoning = aiJson.reasoning ?? 'No reasoning provided.';
      setRiskResult({ risk, reasoning });

      // Store via server (service-role) for public flow:
      await fetch('/api/dashboard-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_assessment', dealer_id: dealerId, answers: updated, risk, reasoning })
      });

      fetch('/api/log-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealer_id: dealerId, event_type: 'completed' }) }).catch(() => {});
      setFinished(true);
    } catch (err) {
      setGlobalError('Request failed, please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-blue-50 dark:bg-gray-900 flex flex-col items-center justify-start px-4 py-6 sm:py-10 text-gray-900 dark:text-white">
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-800 dark:text-blue-300">Customer Assessment</h1>
          <ThemeToggle />
        </div>

        {!finished && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Step {step + 1} of {total}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-2 bg-blue-600 dark:bg-blue-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {globalError && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
            {globalError}
          </div>
        )}

        {finished ? (
          <div className="text-center">
            <p className="text-green-600 dark:text-green-400 text-lg font-semibold mb-2">Thank you!</p>
            {riskResult ? (
              <>
                <p className="mb-2">
                  <span className="font-semibold">Risk:</span>{' '}
                  <span className={riskResult.risk === 'low' ? 'text-green-600' : riskResult.risk === 'high' ? 'text-red-600' : 'text-yellow-600'}>
                    {riskResult.risk.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{riskResult.reasoning}</p>
              </>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">We’ve received your responses. The dealership will review your info shortly.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-gray-700 dark:text-gray-300 mb-3">{initialQuestions[step]}</p>
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 h-28 sm:h-32 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Type your response here..." disabled={submitting}
            />
            <button
              onClick={handleSubmit} disabled={submitting || !input.trim()}
              className={`mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white transition 
                ${submitting || !input.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800 active:scale-[0.98]'}`}
            >
              {submitting ? 'Submitting...' : step + 1 === initialQuestions.length ? 'Submit' : 'Next'}
            </button>
          </>
        )}
      </div>
      <div className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400 max-w-xl">
        Your answers help the dealer understand your situation beyond credit score.
      </div>
    </main>
  );
}
