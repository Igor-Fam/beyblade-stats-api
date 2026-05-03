import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoggedIn: boolean;
    isPremium: boolean;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('AuthProvider: Initializing Supabase session...');
        // Load initial session
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                console.error('AuthProvider: Error getting session:', error);
            } else {
                console.log('AuthProvider: Initial session loaded:', data.session?.user?.email || 'None');
                setSession(data.session);
                setUser(data.session?.user ?? null);
            }
            setIsLoading(false);
        });

        // Listen for login/logout events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            console.log('AuthProvider: Auth state changed:', event, newSession?.user?.email || 'None');
            setSession(newSession);
            setUser(newSession?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async () => {
        console.log('useAuth: Starting Google Login flow...');
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: window.location.origin
            }
        });
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    const getToken = async (): Promise<string | null> => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
    };

    // isPremium is stored in Supabase user_metadata and set server-side by an admin.
    const isPremium = (user?.user_metadata?.is_premium ?? false) as boolean;

    const value: AuthState = {
        user, session,
        isLoggedIn: !!user,
        isPremium, isLoading,
        login, logout, getToken
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
