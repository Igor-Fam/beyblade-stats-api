import { useState } from 'react';
import { AlertTriangle, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginView.module.css';

interface LoginViewProps {
  isUnauthorized?: boolean;
}

export default function LoginView({ isUnauthorized = false }: LoginViewProps) {
  const { login, logout, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await login();
    } catch (e) {
      console.error('Google Sign-In failed:', e);
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  if (isUnauthorized && user) {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.deniedCard}`}>
          <div className={styles.deniedAlert}>
            <AlertTriangle size={48} />
            <h2>Acesso Restrito</h2>
          </div>

          <p className={styles.deniedMsg}>
            Seu e-mail <span className={styles.emailBadge}>{user.email}</span> não está na lista de testadores autorizados para esta versão Alfa do aplicativo.
          </p>

          <p className={styles.welcomeText}>
            Solicite permissão ao administrador do aplicativo ou faça login usando outra conta autorizada.
          </p>

          <button className={styles.switchAccountBtn} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Trocar de Conta / Sair</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <h1 className={styles.logoTitle}>BX Stats</h1>
          <span className={styles.logoSubtitle}>Alpha Tester Release</span>
        </div>

        <p className={styles.welcomeText}>
          Esta é uma versão inicial de testes exclusiva. Para acessar o painel de estatísticas e registro de batalhas, faça login com sua conta Google autorizada.
        </p>

        {isSubmitting ? (
          <div className={styles.spinner} />
        ) : (
          <button className={styles.googleBtn} onClick={handleLogin}>
            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.09 14.99 0 12 0 7.354 0 3.307 2.68 1.347 6.58l3.919 3.185z"
              />
              <path
                fill="#4285F4"
                d="M24 12.273c0-.818-.082-1.636-.218-2.427H12v4.623h6.736A5.764 5.764 0 0 1 16.2 18.3l3.927 3.19c2.3-2.127 3.873-5.264 3.873-9.217z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235A7.126 7.126 0 0 1 4.909 12c0-.79.136-1.55.357-2.265L1.347 6.55A11.95 11.95 0 0 0 0 12c0 1.927.455 3.74 1.259 5.373l4.007-3.138z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.973-1.077 7.964-2.927l-3.927-3.19c-1.1.737-2.5 1.182-4.037 1.182-3.11 0-5.75-2.1-6.7-4.936l-4.007 3.136C3.267 21.29 7.324 24 12 24z"
              />
            </svg>
            <span>Entrar com Google</span>
          </button>
        )}

        <div className={styles.divider} />

        <p className={styles.footerText}>
          <Lock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Acesso seguro via Google OAuth de teste. Seus dados locais permanecem seguros em seu dispositivo.
        </p>
      </div>
    </div>
  );
}
