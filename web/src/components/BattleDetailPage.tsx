import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar } from 'lucide-react';

import { fetchBattleDetails, type BattleHistoryItem, type BattleEntry } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { StatCard, StatsGrid } from './ui/StatCard';
import { PartLinkCard } from './ui/PartLinkCard';
import layout from './ui/DetailPageLayout.module.css';
import styles from './BattleDetailPage.module.css';

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

  if (loading) return <div className="view"><div className={layout.loading}>{t('stats_loading')}</div></div>;
  if (error || !battle) return <div className="view"><div className={layout.error}>{error || 'Battle not found'}</div></div>;

  const [e1, e2] = battle.entries;
  const winner = e1.points > 0 ? e1 : e2;
  const loser = e1.points > 0 ? e2 : e1;
  const finish = winner.finishType;
  
  const date = new Date(battle.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const renderCombo = (entry: BattleEntry, isWinner: boolean) => {
    const slots = entry.line.metadata?.slots ?? [];
    const sortedParts = [...entry.parts].sort((a, b) => {
      const aIdx = slots.indexOf(a.part.partType.name);
      const bIdx = slots.indexOf(b.part.partType.name);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    return (
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

        {sortedParts.map((ep, idx) => (
          <PartLinkCard
            key={idx}
            partId={ep.partId}
            name={ep.part.name}
            typeName={ep.part.partType.name}
          />
        ))}
      </div>
    );
  };


  return (
    <div className={`view ${layout.page}`}>
      <header className={layout.header}>
        <Link to="/battles" className={layout.backLink}>
          <ArrowLeft size={18} /> {t('back_to_history')}
        </Link>
        <h1 className={layout.title}>{t('battle_details_title')}</h1>
      </header>

      <StatsGrid className={styles.battleStatsGrid}>
        <StatCard icon={<Calendar size={24} />} iconColor="#94a3b8" label={t('date_label')}>
          <div className={styles.dateValueWrapper}>
            {dateStr}
            <span className={styles.timeLabel}>{timeStr}</span>
          </div>
        </StatCard>
        <StatCard icon={<MapPin size={24} />} iconColor="#38bdf8" label={t('stadium_label')}>
          {battle.stadium.name}
        </StatCard>
      </StatsGrid>

      <section className={styles.vsContainer}>
        {renderCombo(winner, true)}
        <div className={styles.vsBadge}>VS</div>
        {renderCombo(loser, false)}
      </section>
    </div>
  );
}
