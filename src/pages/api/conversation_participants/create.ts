import { createConversationParticipant } from '@/lib/services/conversationParticipantsServices';

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const participant = await createConversationParticipant(body);
  return new Response(JSON.stringify(participant), { status: 201 });
} 