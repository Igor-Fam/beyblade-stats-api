import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';

import { fetchBattleDetails, type BattleHistoryItem, type BattleEntry } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import styles from './BattleDetailPage.module.css';

const TYPE_COLORS: Record<string, string> = {
  Blade: '#38bdf8',
  Ratchet: '#fb923c',
  Bit: '#4ade80',
  'Lock Chip': '#a78bfa',
  'Metal Blade': '#facc15',
  'Assist Blade': '#f472b6',
};

const FINISH_LABELS: Record<string, string> = {
  SPIN:    'finish_spin',
  OVER:    'finish_over',
  BURST:   'finish_burst',
  XTREME:  'finish_xtreme',
};

export default function BattleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [battle, setBattle] = useState<BattleHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchBattleDetails(Number(id))
      .then(setBattle)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="view"><div className={styles.loading}>{t('stats_loading')}</div></div>;
  if (error || !battle) return <div className="view"><div className={styles.error}>{error || 'Battle not found'}</div></div>;

  const [e1, e2] = battle.entries;
  const winner = e1.points > 0 ? e1 : e2;
  const loser = e1.points > 0 ? e2 : e1;
  const finish = winner.finishType;
  
  const date = new Date(battle.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const renderCombo = (entry: BattleEntry, isWinner: boolean) => (
    <div className={`${styles.comboColumn} ${isWinner ? styles.winnerColumn : styles.loserColumn}`}>
      <div className={styles.comboHeader}>
        <span className={`${styles.roleLabel} ${isWinner ? styles.winnerLabel : styles.loserLabel}`}>
          {isWinner ? t('winner_label') : t('loser_label')}
        </span>
      {isWinner ? (
        <div className={styles.outcomeInfo}>
          {t(FINISH_LABELS[finish] as any)} +{entry.points}
        </div>
      ) : (
        <div className={styles.outcomeInfoSpacer} />
      )}

      </div>
      
      {entry.parts.map((ep, idx) => {
        const typeColor = TYPE_COLORS[ep.part.partType.name] ?? '#94a3b8';
        return (
          <Link key={idx} to={`/stats/parts/${ep.partId}`} className={styles.partItem}>
            <div className={styles.partInfo}>
              <span className={styles.partName}>{t(ep.part.name as any)}</span>
              <span className={styles.partType} style={{ color: typeColor }}>
                {ep.part.partType.name}
              </span>
            </div>
            <ChevronRight size={16} className={styles.chevron} />
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className={`view ${styles.page}`}>
      <header className={styles.header}>
        <Link to="/battles" className={styles.backLink}>
          <ArrowLeft size={18} /> {t('back_to_history')}
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('battle_details_title')}</h1>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#94a3b8' }}><Calendar size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{t('date_label')}</span>
            <div className={styles.dateValueWrapper}>
              <span className={styles.statValue}>{dateStr}</span>
              <span className={styles.timeLabel}>{timeStr}</span>
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#38bdf8' }}><MapPin size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{t('stadium_label')}</span>
            <span className={styles.statValue}>{battle.stadium.name}</span>
          </div>
        </div>
      </section>


      <section className={styles.vsContainer}>
        {renderCombo(winner, true)}
        
        <div className={styles.vsBadge}>VS</div>
        
        {renderCombo(loser, false)}
      </section>
    </div>
  );
}
