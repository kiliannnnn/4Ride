import { getFriendshipById, updateFriendship, deleteFriendship } from '@/lib/services/friendshipsServices';

export async function GET({ params }: { params: { id: string } }) {
  const { id } = params;
  const friendship = await getFriendshipById(Number(id));
  return new Response(JSON.stringify(friendship), { status: 200 });
}

export async function PATCH({ params, request }: { params: { id: string }, request: Request }) {
  const { id } = params;
  const updates = await request.json();
  const friendship = await updateFriendship(Number(id), updates);
  return new Response(JSON.stringify(friendship), { status: 200 });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const { id } = params;
  await deleteFriendship(Number(id));
  return new Response(null, { status: 204 });
} 