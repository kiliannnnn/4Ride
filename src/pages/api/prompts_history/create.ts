import { createPromptHistory } from '@/lib/services/promptsHistoryServices';

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const promptHistory = await createPromptHistory(body);
  return new Response(JSON.stringify(promptHistory), { status: 201 });
} 