import { listConversationParticipants } from '@/lib/services/conversationParticipantsServices';

export async function GET() {
  const participants = await listConversationParticipants();
  return new Response(JSON.stringify(participants), { status: 200 });
} 