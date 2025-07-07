interface ImportMetaEnv {
  // TODO : Comment out the ones you don't use
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string

  readonly PUBLIC_SUPABASE_URL: string
  readonly PUBLIC_SUPABASE_ANON_KEY: string
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
