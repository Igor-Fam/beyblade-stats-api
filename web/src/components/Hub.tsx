import { Link } from 'react-router-dom';
import { Swords, BarChart3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import styles from './Hub.module.css';

export default function Hub() {
  const { t } = useTranslation();

  return (
    <div className="view">
      <h1 className={styles['hub-title']}>
        {t('hub_title')}
      </h1>
      
      <div className={styles['menu-cards']}>
        <Link to="/logger" className={styles['menu-card']}>
          <h2><Swords style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> {t('logger_title')}</h2>
          <p>{t('hub_logger_desc')}</p>
        </Link>
        
        <div className={`${styles['menu-card']} ${styles.disabled}`} style={{ cursor: 'not-allowed' }}>
          <h2><BarChart3 style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> {t('hub_stats_title')}</h2>
          <p>{t('hub_stats_desc')}</p>
        </div>
      </div>
    </div>
  );
}
