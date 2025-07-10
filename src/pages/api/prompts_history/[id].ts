import { getPromptHistoryById, updatePromptHistory, deletePromptHistory } from '@/lib/services/promptsHistoryServices';

export async function GET({ params }: { params: { id: string } }) {
  const { id } = params;
  const promptHistory = await getPromptHistoryById(Number(id));
  return new Response(JSON.stringify(promptHistory), { status: 200 });
}

export async function PATCH({ params, request }: { params: { id: string }, request: Request }) {
  const { id } = params;
  const updates = await request.json();
  const promptHistory = await updatePromptHistory(Number(id), updates);
  return new Response(JSON.stringify(promptHistory), { status: 200 });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const { id } = params;
  await deletePromptHistory(Number(id));
  return new Response(null, { status: 204 });
} 