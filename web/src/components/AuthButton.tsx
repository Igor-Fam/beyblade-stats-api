import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { syncToCloud } from '../hooks/useCloudSync';
import styles from './AuthButton.module.css';

export default function AuthButton() {
    const { user, isLoggedIn, isPremium, isLoading, login, logout, getToken } = useAuth();
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState<string | null>(null);

    const handleSync = async () => {
        setSyncing(true);
        setSyncMsg(null);
        try {
            const token = await getToken();
            if (!token) return;
            const { synced } = await syncToCloud(token);
            setSyncMsg(`✓ ${synced} batalha(s) sincronizada(s)`);
        } catch {
            setSyncMsg('Erro ao sincronizar');
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncMsg(null), 3000);
        }
    };

    if (isLoading) return null;

    if (!isLoggedIn) {
        return (
            <button className={styles.loginBtn} onClick={login} title="Entrar com Google">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Entrar</span>
            </button>
        );
    }

    return (
        <div className={styles.userMenu}>
            {user?.user_metadata?.avatar_url && (
                <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className={styles.avatar}
                    title={user.user_metadata.full_name || user.email}
                />
            )}
            <span className={`${styles.badge} ${isPremium ? styles.premium : styles.free}`}>
                {isPremium ? 'Premium' : 'Free'}
            </span>
            {isPremium && (
                <button className={styles.syncBtn} onClick={handleSync} disabled={syncing} title="Sincronizar batalhas com a nuvem">
                    {syncing ? '⏳' : '☁️'}
                </button>
            )}
            {syncMsg && <span className={styles.syncMsg}>{syncMsg}</span>}
            <button className={styles.logoutBtn} onClick={logout} title="Sair">
                Sair
            </button>
        </div>
    );
}
