import type { APIRoute } from 'astro';
import { getPromptHistoryById, updatePromptHistory, deletePromptHistory } from '@/lib/services/promptsHistoryServices';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const { id } = params;
    const promptHistory = await getPromptHistoryById(Number(id));
    
    if (!promptHistory) {
      return new Response('Prompt history not found', { status: 404 });
    }

    // Ensure user can only access their own prompt history
    if (promptHistory.user_id !== locals.sb_user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(JSON.stringify(promptHistory), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const { id } = params;
    
    // First check if the prompt history exists and belongs to the user
    const existingHistory = await getPromptHistoryById(Number(id));
    if (!existingHistory) {
      return new Response('Prompt history not found', { status: 404 });
    }

    if (existingHistory.user_id !== locals.sb_user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const updates = await request.json();
    const promptHistory = await updatePromptHistory(Number(id), updates);
    return new Response(JSON.stringify(promptHistory), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const { id } = params;
    
    // First check if the prompt history exists and belongs to the user
    const existingHistory = await getPromptHistoryById(Number(id));
    if (!existingHistory) {
      return new Response('Prompt history not found', { status: 404 });
    }

    if (existingHistory.user_id !== locals.sb_user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    await deletePromptHistory(Number(id));
    return new Response(null, { status: 204 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}; 