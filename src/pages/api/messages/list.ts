import { listMessages } from '@/lib/services/messagesServices';

export async function GET() {
  const messages = await listMessages();
  return new Response(JSON.stringify(messages), { status: 200 });
} 