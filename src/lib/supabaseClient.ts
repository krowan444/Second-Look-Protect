/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Returns the shared Supabase client.
 * Throws a user-friendly error if env vars are not configured —
 * this is caught in the submit handler and shown as an inline UI error,
 * so it never crashes the app at module-load time.
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel environment variables, then redeploy.'
        );
    }
    if (!_client) {
        _client = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _client;
}
