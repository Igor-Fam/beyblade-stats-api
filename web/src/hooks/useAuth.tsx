import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { DatabaseService } from '../lib/DatabaseService';
import { SyncService } from '../lib/SyncService';
import { SyncConflictModal } from '../components/SyncConflictModal';

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoggedIn: boolean;
    isPremium: boolean;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getToken: () => Promise<string | null>;
    activeDatabaseId: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [guestCount, setGuestCount] = useState(0);
    const [activeDatabaseId, setActiveDatabaseId] = useState<string>('guest-db');

    useEffect(() => {
        console.log('AuthProvider: Initializing Supabase session...');
        
        const handleAuthSession = async (newSession: Session | null) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
                // 1. Check premium status
                const freshIsPremium = (newSession.user.user_metadata?.is_premium ?? false) as boolean;
                setIsPremium(freshIsPremium);

                // 2. Handle data ownership / sync
                const localGuestCount = await DatabaseService.getGuestBattleCount();
                
                if (localGuestCount > 0) {
                    if (freshIsPremium) {
                        setGuestCount(localGuestCount);
                        setShowSyncModal(true);
                    } else {
                        // Free user: automatic transfer
                        console.log('AuthProvider: Transferring guest data to free user...');
                        await DatabaseService.transferGuestDataToUser(
                            newSession.user.id, 
                            newSession.user.user_metadata?.full_name || 'User'
                        );
                        window.location.reload(); // Refresh to show new data
                    }
                } else if (freshIsPremium) {
                    // Premium user with no guest data: background sync primary DB
                    const dbId = await DatabaseService.getOrCreateUserDatabase(
                        newSession.user.id,
                        newSession.user.user_metadata?.full_name || 'User'
                    );
                    setActiveDatabaseId(dbId);
                    SyncService.syncDatabase(dbId, newSession.access_token).catch(console.error);
                }
            } else {
                setIsPremium(false);
                setActiveDatabaseId('guest-db');
                // Ensure guest DB exists for anonymous browsing
                DatabaseService.ensureGuestDatabase();
            }
            setIsLoading(false);
        };

        // Load initial session
        supabase.auth.getSession().then(({ data }) => handleAuthSession(data.session));

        // Listen for login/logout events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            handleAuthSession(newSession);
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
        login, logout, getToken,
        activeDatabaseId
    };

    const handleSync = async () => {
        if (!user || !session) return;
        const dbId = await DatabaseService.getOrCreateUserDatabase(
            user.id, 
            user.user_metadata?.full_name || 'User'
        );
        // Move guest battles to user DB first
        await DatabaseService.transferGuestDataToUser(user.id, user.user_metadata?.full_name || 'User');
        // Then sync that DB to cloud
        await SyncService.syncDatabase(dbId, session.access_token);
        setShowSyncModal(false);
        window.location.reload();
    };

    const handleDelete = async () => {
        await DatabaseService.deleteGuestData();
        setShowSyncModal(false);
        window.location.reload();
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            <SyncConflictModal 
                isOpen={showSyncModal}
                battleCount={guestCount}
                onSync={handleSync}
                onDelete={handleDelete}
            />
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
