interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string
  readonly PUBLIC_SUPABASE_ANON_KEY: string
  readonly ADMIN_WHITELIST: string
  readonly PUBLIC_GOOGLE_MAPS_KEY: string
 
  readonly PUBLIC_OLLAMA_IP: string
  readonly PUBLIC_OLLAMA_PORT: string
  readonly PUBLIC_OLLAMA_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace App {
  interface Locals {
    // sb_user represents the supabase users table from the protected auth schema
    // You can create your own user table in the public schema to expand it
    sb_user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      emailConfirmedAt: string;
      lastSignInAt: string;
      provider: string;
      createdAt: string;
      updatedAt: string;
      isAnonymous: boolean;
    };
    isAdmin: boolean;
  }
}
