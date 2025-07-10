import { createConversation } from '@/lib/services/conversationsServices';

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const conversation = await createConversation(body);
  return new Response(JSON.stringify(conversation), { status: 201 });
} 