import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const promptId = params.id;
    if (!promptId) {
      return new Response("Prompt ID is required", { status: 400 });
    }

    // Get current user
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify ownership
    const { data: prompt, error: promptError } = await supabase
      .from('prompts_history')
      .select('*')
      .eq('id', parseInt(promptId))
      .eq('user_id', user.id)
      .single();

    if (promptError || !prompt) {
      return new Response("Prompt not found or access denied", { status: 404 });
    }

    // Delete the prompt
    const { error: deleteError } = await supabase
      .from('prompts_history')
      .delete()
      .eq('id', parseInt(promptId))
      .eq('user_id', user.id);

    if (deleteError) {
      return new Response("Failed to delete prompt", { status: 500 });
    }

    return new Response("Prompt deleted successfully", { status: 200 });
  } catch (error: any) {
    console.error("Error deleting prompt:", error);
    return new Response("Failed to delete prompt: " + error.message, { status: 500 });
  }
}; 