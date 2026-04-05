import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, Activity, Target, Sword, HelpCircle, Filter } from 'lucide-react';
import { fetchPartDetails, fetchPartsList, type PartDetails } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { StatCard, StatsGrid } from './ui/StatCard';
import { TYPE_COLORS } from './ui/PartLinkCard';
import layout from './ui/DetailPageLayout.module.css';
import styles from './PartDetailPage.module.css';
import { HelpModal } from './ui/HelpModal';

const FINISH_LABELS: Record<string, string> = {
  SPIN: 'finish_spin',
  OVER: 'finish_over',
  BURST: 'finish_burst',
  XTREME: 'finish_xtreme',
};

const FINISH_WEIGHTS: Record<string, number> = {
  SPIN: 1,
  OVER: 2,
  BURST: 2,
  XTREME: 3,
};

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const [part, setPart] = useState<PartDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [winFinishMode, setWinFinishMode] = useState<'matches'|'points'>('matches');
  const [lossFinishMode, setLossFinishMode] = useState<'matches'|'points'>('matches');
  const [hasBattleFilters, setHasBattleFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showDependencies') === 'true' && part) {
      setShowDependencyModal(true);
    }
  }, [location.search, part]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    let battleFilters: any[] = [];
    try {
      const saved = localStorage.getItem('battle_filters');
      if (saved) {
        battleFilters = JSON.parse(saved);
        setHasBattleFilters(battleFilters.length > 0);
      }
    } catch (e) { console.error(e); }

    Promise.all([
      fetchPartDetails(Number(id), battleFilters),
      fetchPartsList(battleFilters)
    ])
      .then(([partData, partsList]) => {
        setPart(partData);
        // Considerando que a listagem já vem ordenada por BP do backend:
        const rIndex = partsList.findIndex(p => p.id === Number(id));
        if (rIndex !== -1 && partData.totalMatches > 0) {
          setRank(rIndex + 1);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="view"><div className={layout.loading}>{t('stats_loading')}</div></div>;
  if (error || !part) return <div className="view"><div className={layout.error}>{error || 'Part not found'}</div></div>;

  const typeColor = TYPE_COLORS[part.type] ?? '#94a3b8';

  const renderFinishStats = (finishes: Record<string, number>, rawTotal: number, title: string, mode: 'matches'|'points', setMode: (m: 'matches'|'points') => void) => {
    // Re-calcula o total usando weights se o modo for points
    const total = Object.entries(finishes).reduce((sum, [t, count]) => sum + (mode === 'points' ? count * (FINISH_WEIGHTS[t] || 1) : count), 0);

    return (
      <div className={styles.finishSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h3 className={styles.finishTitle} style={{ margin: 0 }}>{title}</h3>
          
          <div className={styles.rankingModeRow} style={{ margin: 0, padding: 0, background: 'transparent', border: 'none' }}>
            <div className={styles.toggle} style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '0.4rem', overflow: 'hidden' }}>
              <button
                className={mode === 'matches' ? styles.toggleBtnActive : styles.toggleBtn}
                onClick={() => setMode('matches')}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'matches' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: mode === 'matches' ? '#38bdf8' : '#94a3b8' }}
              >
                {t('col_battles') ?? 'Partidas'}
              </button>
              <button
                className={mode === 'points' ? styles.toggleBtnActive : styles.toggleBtn}
                onClick={() => setMode('points')}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'points' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: mode === 'points' ? '#38bdf8' : '#94a3b8' }}
              >
                {t('col_points_gained') ?? 'Pontos'}
              </button>
            </div>
          </div>
        </div>
        
        <div className={styles.finishList}>
          {Object.entries(finishes).map(([type, count]) => {
            const val = mode === 'points' ? count * (FINISH_WEIGHTS[type] || 1) : count;
            const percentage = total > 0 ? (val / total) * 100 : 0;
            return (
              <div key={type} className={styles.finishItem}>
                <div className={styles.finishLabelInfo}>
                  <span className={styles.finishTypeLabel}>{t(FINISH_LABELS[type] as any)}</span>
                  <span className={styles.finishCount}>
                    {val}
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: type === 'XTREME' ? '#f43f5e' : type === 'BURST' ? '#fb923c' : type === 'OVER' ? '#fbbf24' : '#38bdf8'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`view ${layout.page}`}>
      <header className={layout.header}>
        <Link to="/stats" className={layout.backLink}>
          <ArrowLeft size={20} /> {t('back_to_stats')}
        </Link>
        <div className={styles.titleInfo}>
          <h1 className={layout.title}>{t(part.name as any)}</h1>
          <span className={styles.typeBadge} style={{ backgroundColor: `${typeColor}22`, color: typeColor, borderColor: `${typeColor}44` }}>
            {part.type}
          </span>
          {part.isDependent && (
            <button className={`${styles.tag} dependent-tag`} onClick={() => setShowDependencyModal(true)}>
              <HelpCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {t('tag_dependent')}
            </button>
          )}
        </div>
        {hasBattleFilters && (
          <div className={styles.filterNotice}>
            <Filter size={14} />
            <span>{t('filter_active_notice')}</span>
          </div>
        )}
      </header>

      <StatsGrid>
        <StatCard icon={<Activity size={24} />} iconColor="#38bdf8" label="Battle Power">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span>{part.bp}</span>
            {rank !== null && (
              <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', fontWeight: 600 }}>
                #{rank}
              </span>
            )}
          </div>
        </StatCard>
        <StatCard icon={<Users size={24} />} iconColor="#94a3b8" label={t('col_battles')}>
          {part.totalMatches}
        </StatCard>
      </StatsGrid>

      <div className={styles.performanceStatsGrid}>
        <div className={styles.performanceOverview}>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_winrate')}</span>
            <span className={styles.perfValue} style={{ color: Number(part.winRate.replace('%', '')) > 50 ? '#4ade80' : '#f87171' }}>
              {part.winRate}
            </span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_wins')}</span>
            <span className={styles.perfValue} style={{ color: '#4ade80' }}>{part.wins}</span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_losses')}</span>
            <span className={styles.perfValue} style={{ color: '#f87171' }}>{part.losses}</span>
          </div>
        </div>

        <div className={styles.performanceOverview}>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_scoring_rate')}</span>
            <span className={styles.perfValue} style={{ color: part.scoringRate > 50 ? '#4ade80' : '#f87171' }}>
              {part.scoringRate}%
            </span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_points_gained')}</span>
            <span className={styles.perfValue} style={{ color: '#4ade80' }}>{part.totalGained}</span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.perfLabel}>{t('col_points_conceded')}</span>
            <span className={styles.perfValue} style={{ color: '#f87171' }}>{part.totalConceded}</span>
          </div>
        </div>
      </div>

      <section className={styles.finishContainer}>
        {renderFinishStats(part.winFinishes, part.wins, t('win_finishes'), winFinishMode, setWinFinishMode)}
        {renderFinishStats(part.lossFinishes, part.losses, t('loss_finishes'), lossFinishMode, setLossFinishMode)}
      </section>

      <div className={styles.analyticalGrid}>
        <section className={styles.analyticsSection}>
          <h2 className={styles.sectionTitle}>
            <Target size={20} className={styles.sectionIcon} /> {t('best_synergies')}
          </h2>
          <p className={styles.sectionDesc}>{t('best_synergies_desc')}</p>
          <div className={styles.analyticsTable}>
            <table className={styles.partTable}>
              <thead>
                <tr>
                  <th className={styles.tableHeaderPart}>{t('col_part')}</th>
                  <th className={styles.tableHeaderMetric}>{t('col_efficiency_with', { part: t(part.name as any) })}</th>
                </tr>
              </thead>
              <tbody>
                {part.bestPartners.length > 0 ? part.bestPartners.map(p => (
                  <tr key={p.id} className={styles.tableRow}>
                    <td>
                      <Link to={`/stats/parts/${p.id}`} className={styles.tablePartLink}>
                        <span className={styles.partItemName}>{t(p.name as any)}</span>
                        <span className={styles.partItemType} style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                      </Link>
                    </td>
                    <td className={styles.tableMetricCell}>
                      <span className={styles.metricValue} style={{ color: p.scoringRate > 55 ? '#4ade80' : p.scoringRate < 45 ? '#f87171' : '#fbbf24' }}>
                        {p.scoringRate}%
                      </span>
                      <span className={styles.metricBattles}>{p.totalMatches} {t('col_battles').toLowerCase()}</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={2}><div className={styles.emptyMsg}>{t('no_analytics_data')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.analyticsSection}>
          <h2 className={styles.sectionTitle}>
            <Sword size={20} className={styles.sectionIcon} /> {t('best_counters')}
          </h2>
          <p className={styles.sectionDesc}>{t('best_counters_desc')}</p>
          <div className={styles.analyticsTable}>
            <table className={styles.partTable}>
              <thead>
                <tr>
                  <th className={styles.tableHeaderPart}>{t('col_part')}</th>
                  <th className={styles.tableHeaderMetric}>{t('col_efficiency_against', { part: t(part.name as any) })}</th>
                </tr>
              </thead>
              <tbody>
                {part.bestCounters.length > 0 ? part.bestCounters.map(p => (
                  <tr key={p.id} className={styles.tableRow}>
                    <td>
                      <Link to={`/stats/parts/${p.id}`} className={styles.tablePartLink}>
                        <span className={styles.partItemName}>{t(p.name as any)}</span>
                        <span className={styles.partItemType} style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                      </Link>
                    </td>
                    <td className={styles.tableMetricCell}>
                      <span className={styles.metricValue} style={{ color: p.scoringRate > 55 ? '#4ade80' : p.scoringRate < 45 ? '#f87171' : '#fbbf24' }}>
                        {p.scoringRate}%
                      </span>
                      <span className={styles.metricBattles}>{p.totalMatches} {t('col_battles').toLowerCase()}</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={2}><div className={styles.emptyMsg}>{t('no_analytics_data')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showDependencyModal && (
        <HelpModal 
          title={t('modal_help_dependent_title')}
          desc={t('modal_help_dependent_desc')}
          dependencies={part.dependencies}
          onClose={() => setShowDependencyModal(false)}
        />
      )}
    </div>
  );
}
