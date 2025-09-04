'use client';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await fetch('/api/dashboard-data');
    const json = await res.json();

    const coachingRes = await fetch('/api/dealer-coaching');
    const coachingJson = await coachingRes.json();
    json.coaching = coachingJson.coaching;

    const qRes = await fetch('/api/custom-questions');
    const qJson = await qRes.json();
    setQuestions(qJson.questions);

    const settingsRes = await fetch('/api/dealer-settings');
    const settingsJson = await settingsRes.json();
    json.logo_url = settingsJson.logo_url;
    json.theme_color = settingsJson.theme_color || '#1E3A8A';
    json.contact_email = settingsJson.contact_email;

    setData(json);
    setLoading(false);
  };

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;
    const res = await fetch('/api/custom-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: newQuestion })
    });
    if (res.ok) { setNewQuestion(''); fetchDashboard(); }
  };

  const deleteQuestion = async (id: string) => {
    const res = await fetch('/api/custom-questions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) fetchDashboard();
  };

  const updateBranding = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/dealer-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logo_url: e.currentTarget.logo_url.value,
        theme_color: e.currentTarget.theme_color.value,
        contact_email: e.currentTarget.contact_email.value
      })
    });
    if (res.ok) fetchDashboard();
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) return <p className="p-6 text-center text-gray-700 dark:text-gray-300">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8 text-gray-900 dark:text-white transition-colors">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div className="flex items-center space-x-4">
          {data.logo_url && <img src={data.logo_url} alt="Dealer Logo" className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover" />}
          <h1 className="text-2xl sm:text-3xl font-bold">Dealer Dashboard</h1>
        </div>
        <ThemeToggle />
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'QR Scans', value: data.qr_scans },
          { label: 'Assessments Started', value: data.assessments_started },
          { label: 'Completed', value: data.completed },
          { label: 'Drop-offs', value: data.drop_offs },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow flex flex-col items-center">
            <h2 className="text-lg font-semibold mb-1">{label}</h2>
            <p className="text-3xl font-bold">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Predictive Dealer Coaching</h2>
        <p className="text-gray-700 dark:text-gray-300">{data.coaching || 'No insights available yet.'}</p>
      </section>

      <section className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-3">Custom Chatbot Questions</h2>
        <form onSubmit={(e) => { e.preventDefault(); addQuestion(); }} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Enter a new question"
            className="flex-grow border border-gray-300 dark:border-gray-600 rounded-l px-3 py-2 dark:bg-gray-700 dark:text-white"
          />
          <button type="submit" style={{ backgroundColor: data.theme_color }} className="text-white rounded-r px-5 py-2 hover:brightness-90 active:scale-95 transition-transform">
            Add
          </button>
        </form>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-auto">
          {(!Array.isArray(questions) || questions.length === 0) && <li className="text-gray-500 dark:text-gray-400 py-2">No custom questions.</li>}
          {Array.isArray(questions) && questions.map((q: any) => (
            <li key={q.id} className="flex justify-between items-center py-2">
              <span>{q.question}</span>
              <button onClick={() => deleteQuestion(q.id)} className="text-red-600 hover:text-red-800">Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Recent Assessments</h2>
        <ul className="max-h-64 overflow-auto divide-y divide-gray-200 dark:divide-gray-700">
          {(!data.recent_assessments || data.recent_assessments.length === 0) && (
            <li className="text-gray-500 dark:text-gray-400 py-2">No recent assessments.</li>
          )}
          {data.recent_assessments?.map((a: any) => (
            <li key={a.id} className="py-2">
              <p><strong>Risk:</strong> {a.risk}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {a.answers.map((qa: any) => `${qa.question}: ${qa.answer}`).join(' | ')}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
