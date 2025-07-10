import { createFriendship } from '@/lib/services/friendshipsServices';

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const friendship = await createFriendship(body);
  return new Response(JSON.stringify(friendship), { status: 201 });
} 