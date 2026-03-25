import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Swords, BarChart3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { t, lang, setLanguage } = useTranslation();

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { path: '/', label: t('hub'), icon: <Home size={20} /> },
    { path: '/logger', label: t('logger_title'), icon: <Swords size={20} /> },
    { path: '#', label: t('hub_stats_title'), icon: <BarChart3 size={20} />, disabled: true },
  ];

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-wrapper">
          <div className="sidebar-header" onClick={toggleSidebar} style={{ cursor: 'pointer' }}>
             <div className="nav-icon menu-icon">
                {isOpen ? <X size={24} /> : <Menu size={24} />}
             </div>
             <div className="logo-text">BX Stats</div>
          </div>

          {isOpen && (
            <div className="sidebar-content-fade-in">
              <nav className="sidebar-nav">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                    onClick={item.disabled ? (e) => e.preventDefault() : () => setIsOpen(false)}
                  >
                    <div className="nav-icon">{item.icon}</div>
                    <span className="nav-label">{item.label}</span>
                    {item.disabled && <span className="coming-soon-badge small">Soon</span>}
                  </Link>
                ))}
              </nav>

              <div className="sidebar-footer">
                <div className="lang-toggle-container">
                  <span className="lang-label">{lang.toUpperCase()}</span>
                  <div className="lang-toggle-sidebar">
                    <button 
                      className={`lang-btn ${lang === 'pt' ? 'active' : ''}`} 
                      onClick={() => setLanguage('pt')}
                    >PT</button>
                    <button 
                      className={`lang-btn ${lang === 'en' ? 'active' : ''}`} 
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
      {isOpen && <div className="sidebar-backdrop" onClick={toggleSidebar} />}
    </>
  );
}
