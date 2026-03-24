import { Link } from 'react-router-dom';
import { Swords, BarChart3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

export default function Hub() {
  const { t, lang, setLanguage } = useTranslation();

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="lang-toggle">
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

      <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2.5rem', textShadow: '0 0 20px rgba(56, 189, 248, 0.3)' }}>
        {t('hub_title')}
      </h1>
      
      <div className="menu-cards">
        <Link to="/logger" className="menu-card">
          <h2><Swords style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> {t('logger_title')}</h2>
          <p>{t('hub_logger_desc')}</p>
        </Link>
        
        <div className="menu-card disabled" style={{ cursor: 'not-allowed' }}>
          <h2><BarChart3 style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> {t('hub_stats_title')}</h2>
          <p>{t('hub_stats_desc')}</p>
        </div>
      </div>
    </div>
  );
}
