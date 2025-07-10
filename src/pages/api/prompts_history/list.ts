import { listPromptsHistory } from '@/lib/services/promptsHistoryServices';

export async function GET() {
  const promptsHistory = await listPromptsHistory();
  return new Response(JSON.stringify(promptsHistory), { status: 200 });
} 