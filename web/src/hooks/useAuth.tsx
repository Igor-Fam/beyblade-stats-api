import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';

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
    const [isPremium, setIsPremium] = useState(false);

    // Fetches fresh user data from Supabase (bypasses cached JWT)
    // and updates isPremium accordingly.
    const refreshPremiumStatus = async (currentSession: Session | null) => {
        if (!currentSession) {
            setIsPremium(false);
            return;
        }
        const { data } = await supabase.auth.getUser(currentSession.access_token);
        const freshIsPremium = (data.user?.user_metadata?.is_premium ?? false) as boolean;
        console.log('AuthProvider: Fresh isPremium status:', freshIsPremium);
        setIsPremium(freshIsPremium);
    };

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
                refreshPremiumStatus(data.session);
            }
            setIsLoading(false);
        });

        // Listen for login/logout events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            console.log('AuthProvider: Auth state changed:', event, newSession?.user?.email || 'None');
            setSession(newSession);
            setUser(newSession?.user ?? null);
            refreshPremiumStatus(newSession);
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
        console.log('useAuth: Logging out...');
        
        if (isPremium) {
            console.log('useAuth: Premium user detected, clearing local battles...');
            await db.battles.clear();
        }

        await supabase.auth.signOut();
        
        // Force a page reload to reset all states and clear any cached data
        window.location.reload();
    };

    const getToken = async (): Promise<string | null> => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
    };

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
