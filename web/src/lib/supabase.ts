import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log('Supabase: Initializing client...');

// Singleton Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// AGGRESSIVE FIX for HashRouter:
// Manually extract tokens if present in the hash before the router eats them
const hash = window.location.hash;
if (hash.includes('access_token=')) {
    console.log('Supabase: Manual token detection triggered!');
    const params = new URLSearchParams(hash.substring(hash.indexOf('access_token=')));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        }).then(({ data, error }) => {
            if (error) console.error('Supabase: Manual session injection failed:', error);
            else console.log('Supabase: Manual session injection success!', data.user?.email);
            
            // Clean URL after success
            window.history.replaceState(null, '', window.location.pathname);
        });
    }
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase: Missing environment variables!');
}
