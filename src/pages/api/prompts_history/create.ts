import type { APIRoute } from 'astro';
import { createPromptHistory } from '@/lib/services/promptsHistoryServices';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.sb_user?.id) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, user_input, answer } = body;

    if (!prompt || !user_input) {
      return new Response('Missing required fields: prompt and user_input', { status: 400 });
    }

    const promptHistory = await createPromptHistory({
      prompt,
      user_input,
      user_id: locals.sb_user.id, // Use authenticated user's ID
      answer: answer || null
    });

    return new Response(JSON.stringify(promptHistory), { status: 201 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}; 