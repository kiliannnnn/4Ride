import { listConversations } from '@/lib/services/conversationsServices';

export async function GET() {
  const conversations = await listConversations();
  return new Response(JSON.stringify(conversations), { status: 200 });
} 