import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Swords, BarChart3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { fetchDatabaseHealth } from '../lib/api';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dbEnv, setDbEnv] = useState<'production' | 'sandbox' | null>(null);
  const location = useLocation();
  const { t, lang, setLanguage } = useTranslation();

  useState(() => {
    fetchDatabaseHealth().then(h => setDbEnv(h.env));
  });

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { path: '/', label: t('hub'), icon: <Home size={20} /> },
    { path: '/logger', label: t('logger_title'), icon: <Swords size={20} /> },
    { path: '/stats', label: t('hub_stats_title'), icon: <BarChart3 size={20} /> },
  ];

  return (
    <>
      {/* Floating Trigger Button (Mobile & Desktop) */}
      {!isOpen && (
        <button 
          className={styles.floatingTrigger} 
          onClick={toggleSidebar}
          aria-label="Open Menu"
        >
          <Menu size={24} />
          {dbEnv && (
            <div className={`${styles['env-dot-floating']} ${styles[dbEnv]}`} />
          )}
        </button>
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.collapsed}`}>
        <div className={styles['sidebar-wrapper']}>
          <div className={styles['sidebar-header']}>
             <div className={`${styles['nav-icon']} ${styles['menu-icon']}`} onClick={toggleSidebar} style={{ cursor: 'pointer' }}>
                <X size={24} />
             </div>
             <div className={styles['logo-text']}>
                BX Stats
                {isOpen && dbEnv && (
                  <span className={`${styles['db-env-badge-small']} ${styles[dbEnv]}`}>
                    {dbEnv.toUpperCase()}
                  </span>
                )}
             </div>
          </div>

          {isOpen && (
            <div className={styles['sidebar-content-fade-in']}>
              <nav className={styles['sidebar-nav']}>
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`${styles['nav-item']} ${location.pathname === item.path ? styles.active : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className={styles['nav-icon']}>{item.icon}</div>
                    <span className={styles['nav-label']}>{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className={styles['sidebar-footer']}>
                <div className={styles['lang-toggle-container']}>
                  <span className={styles['lang-label']}>{lang.toUpperCase()}</span>
                  <div className={styles['lang-toggle-sidebar']}>
                    <button 
                      className={`${styles['lang-btn']} ${lang === 'pt' ? styles.active : ''}`} 
                      onClick={() => setLanguage('pt')}
                    >PT</button>
                    <button 
                      className={`${styles['lang-btn']} ${lang === 'en' ? styles.active : ''}`} 
                      onClick={() => setLanguage('en')}
                    >EN</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop for mobile overlays when expanded */}
      {isOpen && <div className={styles['sidebar-backdrop']} onClick={toggleSidebar} />}
    </>
  );
}
