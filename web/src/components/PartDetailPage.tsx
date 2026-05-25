import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, Activity, Target, Sword, HelpCircle, Filter, AlertTriangle, Eye, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchPartDetails, fetchPartsList, fetchLines, type PartDetails, type Line } from '../lib/api';
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

const PART_TYPE_ORDER = ['BLADE', 'RATCHET', 'BIT', 'LOCK_CHIP', 'MAIN_BLADE', 'ASSIST_BLADE', 'METAL_BLADE', 'OVER_BLADE'];

const sortPartTypes = (types: string[]) => {
  return [...types].sort((a, b) => {
    const idxA = PART_TYPE_ORDER.indexOf(a);
    const idxB = PART_TYPE_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
};

function ScrollTabs({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    const el = containerRef.current;
    if (el) {
      const canScrollLeft = el.scrollLeft > 5;
      const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 5);
      setShowLeft(canScrollLeft);
      setShowRight(canScrollRight);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      checkScroll();
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      const observer = new ResizeObserver(() => checkScroll());
      observer.observe(el);
      
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        observer.disconnect();
      };
    }
  }, [children]);

  return (
    <div className={styles.scrollWrapper}>
      {showLeft && (
        <div className={styles.scrollArrowLeft}>
          <ChevronLeft size={14} />
        </div>
      )}
      <div ref={containerRef} className={`${styles.scrollContainer} ${className}`}>
        {children}
      </div>
      {showRight && (
        <div className={styles.scrollArrowRight}>
          <ChevronRight size={14} />
        </div>
      )}
    </div>
  );
}

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const [part, setPart] = useState<PartDetails | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [helpModal, setHelpModal] = useState<{ title: string, desc: string, dependencies?: any[] } | null>(null);
  const [winFinishMode, setWinFinishMode] = useState<'matches' | 'points'>('matches');
  const [lossFinishMode, setLossFinishMode] = useState<'matches' | 'points'>('matches');
  const [hasBattleFilters, setHasBattleFilters] = useState(false);

  // Tabs states
  const [activeTab, setActiveTab] = useState<'overview' | 'synergies' | 'counters' | 'combos'>('overview');
  const [synergySubTab, setSynergySubTab] = useState<string>('all');
  const [counterSubTab, setCounterSubTab] = useState<string>('all');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showDependencies') === 'true' && part) {
      setHelpModal({
        title: t('modal_help_dependent_title'),
        desc: t('modal_help_dependent_desc'),
        dependencies: part.dependencies
      });
    }
  }, [location.search, part, t]);

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
      fetchPartsList(battleFilters),
      fetchLines()
    ])
      .then(([partData, partsList, linesList]) => {
        setPart(partData);
        setLines(linesList);

        // Calcular rank ignorando peças imprecisas ou sem partidas
        const consolidatedParts = partsList
          .filter(p => !p.isInaccurate && p.totalMatches > 0)
          .sort((a, b) => b.bp - a.bp); // Garantir ordenação por BP

        const rIndex = consolidatedParts.findIndex(p => p.id === Number(id));
        if (rIndex !== -1 && !partData.isInaccurate && partData.totalMatches > 0) {
          setRank(rIndex + 1);
        } else {
          setRank(null);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);


  const compatibleTypes = useMemo(() => {
    if (!part || !lines.length) return [];
    const currentType = part.type;
    const matchingLines = lines.filter(line => 
      line.metadata?.slots?.includes(currentType)
    );
    const types = new Set<string>();
    matchingLines.forEach(line => {
      line.metadata?.slots?.forEach(slot => {
        if (slot !== currentType) {
          types.add(slot);
        }
      });
    });
    return sortPartTypes(Array.from(types));
  }, [part, lines]);

  const allPartTypes = useMemo(() => {
    if (!lines.length) return [];
    const types = new Set<string>();
    lines.forEach(line => {
      line.metadata?.slots?.forEach(slot => {
        types.add(slot);
      });
    });
    return sortPartTypes(Array.from(types));
  }, [lines]);

  if (loading) return <div className="view"><div className={layout.loading}>{t('stats_loading')}</div></div>;
  if (error || !part) return <div className="view"><div className={layout.error}>{error || 'Part not found'}</div></div>;

  const typeColor = TYPE_COLORS[part.type] ?? '#94a3b8';

  const renderFinishStats = (finishes: Record<string, number>, title: string, mode: 'matches' | 'points', setMode: (m: 'matches' | 'points') => void) => {
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
                {t('col_battles')}
              </button>
              <button
                className={mode === 'points' ? styles.toggleBtnActive : styles.toggleBtn}
                onClick={() => setMode('points')}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'points' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: mode === 'points' ? '#38bdf8' : '#94a3b8' }}
              >
                {t('points')}
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

  // Filter lists based on nested sub-tabs
  const filteredPartners = synergySubTab === 'all'
    ? part.allPartners
    : part.allPartners.filter(p => p.type === synergySubTab);

  const filteredCounters = counterSubTab === 'all'
    ? part.allCounters
    : part.allCounters.filter(p => p.type === counterSubTab);

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
            <button
              className={`${styles.tag} dependent-tag`}
              onClick={() => setHelpModal({
                title: t('modal_help_dependent_title'),
                desc: t('modal_help_dependent_desc'),
                dependencies: part.dependencies
              })}
            >
              <HelpCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {t('tag_dependent')}
            </button>
          )}
          {part.isInaccurate && (
            <button
              className={`${styles.tag} inaccurate-tag`}
              onClick={() => setHelpModal({
                title: t('modal_help_inaccurate_title'),
                desc: t('modal_help_inaccurate_desc')
              })}
            >
              <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {t('tag_inaccurate')}
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

      {/* Main Tabs Navigation Bar */}
      <ScrollTabs className={styles.mainTabs}>
        <button
          className={`${styles.mainTabBtn} ${activeTab === 'overview' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Eye size={16} /> {t('tab_overview')}
        </button>
        <button
          className={`${styles.mainTabBtn} ${activeTab === 'synergies' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveTab('synergies')}
        >
          <Target size={16} /> {t('tab_synergies')}
        </button>
        <button
          className={`${styles.mainTabBtn} ${activeTab === 'counters' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveTab('counters')}
        >
          <Sword size={16} /> {t('tab_counters')}
        </button>
        <button
          className={`${styles.mainTabBtn} ${activeTab === 'combos' ? styles.mainTabActive : ''}`}
          onClick={() => setActiveTab('combos')}
        >
          <Layers size={16} /> {t('tab_combos')}
        </button>
      </ScrollTabs>

      {/* Tab Panels */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div className={styles.tabPanelFade}>
            <StatsGrid>
              <StatCard icon={<Activity size={24} />} iconColor="#38bdf8" label="Battle Power">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span>{part.isInaccurate ? <span className={styles.dash}>—</span> : part.bp}</span>
                  {rank !== null && !part.isInaccurate && (
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
              {renderFinishStats(part.winFinishes, t('win_finishes'), winFinishMode, setWinFinishMode)}
              {renderFinishStats(part.lossFinishes, t('loss_finishes'), lossFinishMode, setLossFinishMode)}
            </section>

            <div className={styles.analyticalGrid} style={{ marginTop: '2rem' }}>
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
                {part.bestPartners.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button
                      className={styles.seeMoreBtn}
                      onClick={() => { setActiveTab('synergies'); setSynergySubTab('all'); }}
                    >
                      {t('see_more')} &rarr;
                    </button>
                  </div>
                )}
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
                {part.bestCounters.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button
                      className={styles.seeMoreBtn}
                      onClick={() => { setActiveTab('counters'); setCounterSubTab('all'); }}
                    >
                      {t('see_more')} &rarr;
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'synergies' && (
          <div className={styles.tabPanelFade}>
            <p className={styles.tabSectionDesc}>
              {t('synergies_general_desc')}
            </p>

            {/* Sub-tabs pills */}
            <ScrollTabs className={styles.subTabs}>
              <button
                className={`${styles.subTabBtn} ${synergySubTab === 'all' ? styles.subTabActive : ''}`}
                onClick={() => setSynergySubTab('all')}
              >
                {t('tab_all')}
              </button>
              {compatibleTypes.map(type => (
                <button
                  key={type}
                  className={`${styles.subTabBtn} ${synergySubTab === type ? styles.subTabActive : ''}`}
                  onClick={() => setSynergySubTab(type)}
                >
                  <span className={styles.subTabColorDot} style={{ backgroundColor: TYPE_COLORS[type] }} />
                  {type}
                </button>
              ))}
            </ScrollTabs>

            {/* List */}
            <div className={styles.analyticsTable}>
              <table className={styles.partTable}>
                <thead>
                  <tr>
                    <th className={styles.tableHeaderPart}>{t('col_part')}</th>
                    <th className={styles.tableHeaderMetric}>{t('col_efficiency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.length > 0 ? filteredPartners.map(p => (
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
          </div>
        )}

        {activeTab === 'counters' && (
          <div className={styles.tabPanelFade}>
            <p className={styles.tabSectionDesc}>
              {t('counters_general_desc')}
            </p>

            {/* Sub-tabs pills */}
            <ScrollTabs className={styles.subTabs}>
              <button
                className={`${styles.subTabBtn} ${counterSubTab === 'all' ? styles.subTabActive : ''}`}
                onClick={() => setCounterSubTab('all')}
              >
                {t('tab_all')}
              </button>
              {allPartTypes.map(type => (
                <button
                  key={type}
                  className={`${styles.subTabBtn} ${counterSubTab === type ? styles.subTabActive : ''}`}
                  onClick={() => setCounterSubTab(type)}
                >
                  <span className={styles.subTabColorDot} style={{ backgroundColor: TYPE_COLORS[type] }} />
                  {type}
                </button>
              ))}
            </ScrollTabs>

            {/* List */}
            <div className={styles.analyticsTable}>
              <table className={styles.partTable}>
                <thead>
                  <tr>
                    <th className={styles.tableHeaderPart}>{t('col_part')}</th>
                    <th className={styles.tableHeaderMetric}>{t('col_efficiency_against', { part: t(part.name as any) })}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounters.length > 0 ? filteredCounters.map(p => (
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
          </div>
        )}

        {activeTab === 'combos' && (
          <div className={styles.tabPanelFade}>
            {/* List of full combos */}
            <div className={styles.analyticsTable}>
              <table className={styles.partTable}>
                <thead>
                  <tr>
                    <th className={styles.tableHeaderPart}>{t('col_combo')}</th>
                    <th className={styles.tableHeaderMetric}>{t('col_efficiency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {part.combos && part.combos.length > 0 ? part.combos.map((combo, idx) => (
                    <tr key={idx} className={styles.tableRow}>
                      <td>
                        <div className={styles.comboPartsContainer}>
                          <span className={styles.lineBadge}>{combo.lineName}</span>
                          <div className={styles.comboPartsList}>
                            {combo.parts.map(p => (
                              <Link key={p.id} to={`/stats/parts/${p.id}`} className={styles.comboPartPill}>
                                <span className={p.id === part.id ? styles.comboPartDotActive : styles.comboPartDot} style={{ backgroundColor: TYPE_COLORS[p.type] || '#fff' }} />
                                <span className={p.id === part.id ? styles.comboPartNameActive : styles.comboPartName}>{t(p.name as any)}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className={styles.tableMetricCell}>
                        <span className={styles.metricValue} style={{ color: combo.scoringRate > 55 ? '#4ade80' : combo.scoringRate < 45 ? '#f87171' : '#fbbf24' }}>
                          {combo.scoringRate}%
                        </span>
                        <span className={styles.metricBattles}>{combo.totalMatches} {t('col_battles').toLowerCase()}</span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}><div className={styles.emptyMsg}>{t('no_combos_found')}</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {helpModal && (
        <HelpModal
          title={helpModal.title}
          desc={helpModal.desc}
          dependencies={helpModal.dependencies}
          onClose={() => setHelpModal(null)}
        />
      )}
    </div>
  );
}
