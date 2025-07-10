import { createMessage } from '@/lib/services/messagesServices';

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const message = await createMessage(body);
  return new Response(JSON.stringify(message), { status: 201 });
} 