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

  if (!assessments || assessments.length === 0)
    return NextResponse.json({ coaching: 'No data available yet.' });

  const input = assessments
    .map(a =>
      `Risk: ${a.risk}. Answers: ${a.answers.map((qa: any) => `${qa.question}: ${qa.answer}`).join('; ')}`
    )
    .join('\n\n');

  const prompt = `
  You are a senior BHPH dealership coach. Analyze these assessments.
  Identify patterns in high-risk customers. 
  Suggest specific coaching actions (e.g., "Ask for references", "Request proof of employment").
  Keep suggestions practical and 3-4 sentences long.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: input }
    ],
    temperature: 0.6
  });

  const coaching = response.choices[0].message?.content || 'No coaching available.';

  // Save to history for tracking
  await supabase.from('dealer_coaching').insert([{ dealer_id: userId, insight: coaching }]);

  return NextResponse.json({ coaching });
}
