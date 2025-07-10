import type { APIRoute } from "astro";
import { supabase } from "@/lib/supabase";
import { createUserProfile } from "@/lib/services/userProfileServices";

export const POST: APIRoute = async ({ request, cookies }) => {
    let email, password, passwordConfirm, username;
    try {
        const body = await request.json();
        email = body.email;
        password = body.p1;
        passwordConfirm = body.p2;
        username = body.username;
    } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
    }

    if (!email || !password || !passwordConfirm || !username) {
        return new Response("Email, username and password are required", { status: 400 });
    }

    if (password !== passwordConfirm) {
        return new Response("Passwords do not match", { status: 400 });
    }

    let { data: user_profile, error : user_profile_error } = await supabase
        .from('user_profile')
        .select("*")
        .eq('username', username);

    if (user_profile_error) {
        return new Response(user_profile_error.message, { status: 500 });
    }

    if (user_profile && user_profile.length > 0) {
        return new Response("Username is already taken", { status: 400 });
    }

    const { error: auth_error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (auth_error) {
        return new Response(auth_error.message, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return new Response("Failed to create user", { status: 500 });
    }

    try {
        await createUserProfile({
            user_id: user.id,
            username,
            mileage: 0
        });
    } catch (profileError: any) {
        return new Response("Failed to create user profile: " + (profileError.message || profileError), { status: 500 });
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError) {
        return new Response("Failed to sign in user: " + signInError.message, { status: 500 });
    }

    // Set cookies manually like the signin route
    const { access_token, refresh_token } = signInData.session;
    cookies.set("sb-access-token", access_token, { path: "/" });
    cookies.set("sb-refresh-token", refresh_token, { path: "/" });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
};