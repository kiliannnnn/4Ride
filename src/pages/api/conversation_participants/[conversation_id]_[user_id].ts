import { getConversationParticipant, updateConversationParticipant, deleteConversationParticipant } from '@/lib/services/conversationParticipantsServices';

export async function GET({ params }: { params: { id: string } }) {
  const [conversation_id, user_id] = params.id.split('_');
  const participant = await getConversationParticipant(Number(conversation_id), user_id);
  return new Response(JSON.stringify(participant), { status: 200 });
}

export async function PATCH({ params, request }: { params: { id: string }, request: Request }) {
  const [conversation_id, user_id] = params.id.split('_');
  const updates = await request.json();
  const participant = await updateConversationParticipant(Number(conversation_id), user_id, updates);
  return new Response(JSON.stringify(participant), { status: 200 });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const [conversation_id, user_id] = params.id.split('_');
  await deleteConversationParticipant(Number(conversation_id), user_id);
  return new Response(null, { status: 204 });
} 