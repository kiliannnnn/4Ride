import { listFriendships } from '@/lib/services/friendshipsServices';

export async function GET() {
  const friendships = await listFriendships();
  return new Response(JSON.stringify(friendships), { status: 200 });
} 