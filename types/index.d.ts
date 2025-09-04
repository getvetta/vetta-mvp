export type Assessment = {
  id: string;
  dealer_id: string;
  answers: { question: string; answer: string }[];
  risk: 'low' | 'medium' | 'high';
  reasoning?: string;
  created_at: string;
};
