import { supabase } from '@/lib/supabase';
import { sequence } from "astro:middleware";

import { getLangFromUrl, useTranslationsRoute } from "@/i18n/utils";

interface AuthContext {
    request: Request;
    locals: {
        sb_user: any;
        isAdmin: boolean;
    };
    url: URL;
    redirect: (location: string) => Response;
    cookies: any;
}

interface NextFunction {
    (): Promise<Response>;
}

const adminWhitelist = import.meta.env.ADMIN_WHITELIST.split(',');

async function auth({ locals, url, cookies, redirect }: AuthContext, next: NextFunction): Promise<Response> {
    const pathname = url.pathname;
    const lang = getLangFromUrl(url);
    const tRoute = useTranslationsRoute(lang);

    // TODO : add your protected routes
    const protectedRoutes = [tRoute('/dashboard'), tRoute('/community')];
    // TODO : add your admin routes
    const adminRoutes = [tRoute('/admin')];
    
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    let session;
    try {
        session = await supabase.auth.setSession({
            refresh_token: refreshToken.value,
            access_token: accessToken.value,
        });
        if (session.error) {
            cookies.delete("sb-access-token", {path: "/",});
            cookies.delete("sb-refresh-token", {path: "/",});
        }
    } catch (error) {
        cookies.delete("sb-access-token", {path: "/",});
        cookies.delete("sb-refresh-token", {path: "/",});
    }

    let user = null;
    if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            cookies.delete("sb-access-token", {path: "/",});
            cookies.delete("sb-refresh-token", {path: "/",});
        }
        user = data.user;
    }
    locals.sb_user = user;

    if (protectedRoutes.includes(pathname) && !user) {
        return redirect(tRoute('/signin'));
    }
    
    if ((pathname === tRoute('/signup') || pathname === tRoute('/signin')) && user) {
        return redirect(tRoute('/'));
    }
    
    if (adminWhitelist.includes(locals.sb_user?.id)) {
        locals.isAdmin = true;
    } else {
        locals.isAdmin = false;
        if (adminRoutes.includes(pathname)) {
            return redirect(tRoute('/'));
        }
    }

    const response = await next();
    return response;
}

export const onRequest = sequence(auth);