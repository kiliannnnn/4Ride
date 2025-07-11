import type { APIRoute } from 'astro';
import { getPromptsHistoryByUser } from '@/lib/services/promptsHistoryServices';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const promptsHistory = await getPromptsHistoryByUser(locals.sb_user.id);
    return new Response(JSON.stringify(promptsHistory), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}; 