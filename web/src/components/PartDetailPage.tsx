import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Sword, BarChart3, Activity, Target, X, Info } from 'lucide-react';
import { fetchPartDetails, type PartDetails } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import styles from './PartDetailPage.module.css';

const TYPE_COLORS: Record<string, string> = {
  Blade: '#38bdf8',
  Ratchet: '#fb923c',
  Bit: '#4ade80',
  'Lock Chip': '#a78bfa',
  'Metal Blade': '#facc15',
  'Assist Blade': '#f472b6',
};

const FINISH_LABELS: Record<string, string> = {
  SPIN: 'finish_spin',
  OVER: 'finish_over',
  BURST: 'finish_burst',
  XTREME: 'finish_xtreme',
};

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const [part, setPart] = useState<PartDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showDependencies') === 'true' && part) {
      setShowDependencyModal(true);
    }
  }, [location.search, part]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPartDetails(Number(id))
      .then(setPart)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="view"><div className={styles.loading}>{t('stats_loading')}</div></div>;
  if (error || !part) return <div className="view"><div className={styles.error}>{error || 'Part not found'}</div></div>;

  const typeColor = TYPE_COLORS[part.type] ?? '#94a3b8';

  const renderFinishStats = (finishes: Record<string, number>, total: number, title: string) => {
    return (
      <div className={styles.finishSection}>
        <h3 className={styles.finishTitle}>{title}</h3>
        <div className={styles.finishList}>
          {Object.entries(finishes).map(([type, count]) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={type} className={styles.finishItem}>
                <div className={styles.finishLabelInfo}>
                  <span className={styles.finishTypeLabel}>{t(FINISH_LABELS[type] as any)}</span>
                  <span className={styles.finishCount}>{count}</span>
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
    <div className={`view ${styles.page}`}>
      <header className={styles.header}>
        <Link to="/stats" className={styles.backLink}>
          <ArrowLeft size={20} /> {t('back_to_stats')}
        </Link>
        <div className={styles.titleInfo}>
          <h1 className={styles.name}>{part.name}</h1>
          {part.isDependent && (
            <button className={`${styles.tag} dependent-tag`} onClick={() => setShowDependencyModal(true)}>
              {t('tag_dependent')}
            </button>
          )}
          <span className={styles.typeBadge} style={{ backgroundColor: `${typeColor}22`, color: typeColor, borderColor: `${typeColor}44` }}>
            {part.type}
          </span>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#38bdf8' }}><Activity size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>BP (Colley)</span>
            <span className={styles.statValue}>{part.bp}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#a78bfa' }}><TrendingUp size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Elo</span>
            <span className={styles.statValue}>{part.elo}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#facc15' }}><BarChart3 size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{t('col_avg_pts')}</span>
            <span className={styles.statValue}>{part.avgPoints}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#94a3b8' }}><Users size={24} /></div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{t('col_battles')}</span>
            <span className={styles.statValue}>{part.totalMatches}</span>
          </div>
        </div>
      </section>

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

      <div className={styles.performanceOverview} style={{ marginTop: '-1.5rem' }}>
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

      <section className={styles.finishContainer}>
        {renderFinishStats(part.winFinishes, part.wins, t('win_finishes'))}
        {renderFinishStats(part.lossFinishes, part.losses, t('loss_finishes'))}
      </section>

      <div className={styles.analyticalGrid}>
        <section className={styles.analyticsSection}>
          <h2 className={styles.sectionTitle}>
            <Target size={20} className={styles.sectionIcon} /> {t('best_synergies')}
          </h2>
          <p className={styles.sectionDesc}>{t('best_synergies_desc')}</p>
          <div className={styles.partsList}>
            {part.bestPartners.length > 0 ? part.bestPartners.map(p => (
              <Link key={p.id} to={`/stats/parts/${p.id}`} className={styles.partItem}>
                <div className={styles.partInfo}>
                  <span className={styles.partItemName}>{p.name}</span>
                  <span className={styles.partItemType} style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                </div>
                <div className={styles.partMetrics}>
                  <span className={styles.metricValue}>{p.scoringRate}%</span>
                  <span className={styles.metricLabel}>{p.totalMatches} battles</span>
                </div>
              </Link>
            )) : <div className={styles.emptyMsg}>{t('no_analytics_data')}</div>}
          </div>
        </section>

        <section className={styles.analyticsSection}>
          <h2 className={styles.sectionTitle}>
            <Sword size={20} className={styles.sectionIcon} /> {t('best_counters')}
          </h2>
          <p className={styles.sectionDesc}>{t('best_counters_desc')}</p>
          <div className={styles.partsList}>
            {part.bestCounters.length > 0 ? part.bestCounters.map(p => (
              <Link key={p.id} to={`/stats/parts/${p.id}`} className={styles.partItem}>
                <div className={styles.partInfo}>
                  <span className={styles.partItemName}>{p.name}</span>
                  <span className={styles.partItemType} style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                </div>
                <div className={styles.partMetrics}>
                  <span className={styles.metricValue}>{p.scoringRate}%</span>
                  <span className={styles.metricLabel}>{p.totalMatches} battles</span>
                </div>
              </Link>
            )) : <div className={styles.emptyMsg}>{t('no_analytics_data')}</div>}
          </div>
        </section>
      </div>

      {showDependencyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDependencyModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <Info size={20} className={styles.modalTitleIcon} />
                <h2>{t('dependency_modal_title')}</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowDependencyModal(false)}>
                <X size={20} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>{t('dependency_modal_desc')}</p>
              <div className={styles.dependencyList}>
                {part.dependencies.map(dep => (
                  <Link 
                    key={dep.id} 
                    to={`/stats/parts/${dep.id}`} 
                    className={styles.dependencyItem}
                    onClick={() => setShowDependencyModal(false)}
                  >
                    <div className={styles.depInfo}>
                      <span className={styles.depName}>{dep.name}</span>
                      <span className={styles.depType} style={{ color: TYPE_COLORS[dep.type] }}>{dep.type}</span>
                    </div>
                    <div className={styles.depMetrics}>
                      <div className={styles.depPercentage}>
                        <span className={styles.depValue}>{dep.share}%</span>
                        <span className={styles.depLabel}>{t('col_points_gained')}</span>
                      </div>
                      <div className={styles.depProgress}>
                        <div className={styles.depProgressFill} style={{ width: `${dep.share}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
