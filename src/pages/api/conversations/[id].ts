import { getConversationById, updateConversation, deleteConversation } from '@/lib/services/conversationsServices';

export async function GET({ params }: { params: { id: string } }) {
  const { id } = params;
  const conversation = await getConversationById(Number(id));
  return new Response(JSON.stringify(conversation), { status: 200 });
}

export async function PATCH({ params, request }: { params: { id: string }, request: Request }) {
  const { id } = params;
  const updates = await request.json();
  const conversation = await updateConversation(Number(id), updates);
  return new Response(JSON.stringify(conversation), { status: 200 });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const { id } = params;
  await deleteConversation(Number(id));
  return new Response(null, { status: 204 });
} 