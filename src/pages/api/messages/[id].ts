import { getMessageById, updateMessage, deleteMessage } from '@/lib/services/messagesServices';

export async function GET({ params }: { params: { id: string } }) {
  const { id } = params;
  const message = await getMessageById(Number(id));
  return new Response(JSON.stringify(message), { status: 200 });
}

export async function PATCH({ params, request }: { params: { id: string }, request: Request }) {
  const { id } = params;
  const updates = await request.json();
  const message = await updateMessage(Number(id), updates);
  return new Response(JSON.stringify(message), { status: 200 });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const { id } = params;
  await deleteMessage(Number(id));
  return new Response(null, { status: 204 });
} 