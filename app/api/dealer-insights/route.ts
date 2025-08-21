import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';
import { openai } from '@/utils/openaiClient';
import { auth } from '@clerk/nextjs';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assessments } = await supabase
    .from('assessments')
    .select('answers,risk')
    .eq('dealer_id', userId);

  const summaryText = assessments?.map(a =>
    `Risk: ${a.risk}. Answers: ${a.answers.map((qa: any) => `${qa.question}: ${qa.answer}`).join('; ')}`
  ).join('\n');

  const prompt = `
  You are an AI assistant helping a car dealership analyze customer assessments.
  Provide a 3-4 sentence summary of trends (e.g., top reasons for buying, common financial situations, accountability themes)
  and suggest 1-2 actionable insights for the dealer to improve their financing decisions.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: summaryText || 'No data available.' }
    ],
    temperature: 0.7
  });

  const insights = response.choices[0].message?.content || 'No insights available.';
  return NextResponse.json({ insights });
}
