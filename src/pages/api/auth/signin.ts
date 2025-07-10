import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";

export const POST: APIRoute = async ({ cookies, request }) => {
    console.log("Received POST to /api/auth/signin");
    let email, password;
    try {
        const body = await request.json();
        email = body.email;
        password = body.password;
    } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
    }

    if (!email || !password) {
        return new Response("Email and password are required", { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const { access_token, refresh_token } = data.session;
    cookies.set("sb-access-token", access_token, {path: "/",});
    cookies.set("sb-refresh-token", refresh_token, { path: "/",});

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
};