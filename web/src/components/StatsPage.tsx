import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Filter, X } from 'lucide-react';
import { type PartStats, fetchPartsList } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import styles from './StatsPage.module.css';

type RankingMode = 'elo' | 'bp';
type SortKey = keyof Pick<PartStats, 'elo' | 'bp' | 'scoringRate' | 'winRate' | 'wins' | 'losses' | 'totalMatches'>;
type SortDir = 'asc' | 'desc';

interface Filter {
  id: string;
  field: string;
  operator: string;
  value: string | number;
}

const OPERATORS = [
  { id: 'eq', label: 'filter_op_eq', symbol: '=' },
  { id: 'gt', label: 'filter_op_gt', symbol: '>' },
  { id: 'gte', label: 'filter_op_gte', symbol: '>=' },
  { id: 'lt', label: 'filter_op_lt', symbol: '<' },
  { id: 'lte', label: 'filter_op_lte', symbol: '<=' },
];

const FILTER_FIELDS = [
  { id: 'type', label: 'col_type', type: 'categorical' },
  { id: 'bp', label: 'col_bp', type: 'numeric' },
  { id: 'scoringRate', label: 'col_scoring_rate', type: 'numeric' },
  { id: 'winRate', label: 'col_winrate', type: 'numeric' },
  { id: 'wins', label: 'col_wins', type: 'numeric' },
  { id: 'losses', label: 'col_losses', type: 'numeric' },
  { id: 'totalMatches', label: 'col_battles', type: 'numeric' },
];

const TYPE_COLORS: Record<string, string> = {
  Blade: '#38bdf8',
  Ratchet: '#fb923c',
  Bit: '#4ade80',
  'Lock Chip': '#a78bfa',
  'Metal Blade': '#facc15',
  'Assist Blade': '#f472b6',
};

export default function StatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [parts, setParts] = useState<PartStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingMode, setRankingMode] = useState<RankingMode>('bp');
  const [sortKey, setSortKey] = useState<SortKey>('bp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [helpModal, setHelpModal] = useState<{ title: string; desc: string } | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Sync horizontal scroll between separate header and body tables
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
    }
  };
  const [filters, setFilters] = useState<Filter[]>(() => {
    try {
      const saved = localStorage.getItem('parts_filters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('parts_filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    fetchPartsList()
      .then(setParts)
      .finally(() => setLoading(false));
  }, []);

  // When the user switches ranking mode, reset the primary sort to that mode
  const handleModeToggle = (mode: RankingMode) => {
    setRankingMode(mode);
    setSortKey(mode);
    setSortDir('desc');
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const availableTypes = useMemo(() => {
    const types = new Set(parts.map(p => p.type));
    return Array.from(types).sort();
  }, [parts]);

  const filteredAndSorted = useMemo(() => {
    let result = [...parts];

    // Apply filters
    filters.forEach(f => {
      if (f.value === '' || f.value === undefined) return;

      result = result.filter((p: PartStats) => {
        const fieldInfo = FILTER_FIELDS.find(ff => ff.id === f.field);
        const rawValue = p[f.field as keyof PartStats];
        
        if (fieldInfo?.type === 'categorical') {
          return String(rawValue) === String(f.value);
        }

        // Numeric comparison
        const pValue = f.field === 'winRate' 
          ? parseFloat(String(rawValue)) 
          : Number(rawValue);
        const fValue = Number(f.value);

        switch (f.operator) {
          case 'eq': return pValue === fValue;
          case 'gt': return pValue > fValue;
          case 'gte': return pValue >= fValue;
          case 'lt': return pValue < fValue;
          case 'lte': return pValue <= fValue;
          default: return true;
        }
      });
    });

    // Apply sorting
    return result.sort((a, b) => {
      // Parts with no battles always sink to the bottom
      if (a.totalMatches === 0 && b.totalMatches === 0) return 0;
      if (a.totalMatches === 0) return 1;
      if (b.totalMatches === 0) return -1;

      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [parts, sortKey, sortDir, filters]);

  const addFilter = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setFilters([...filters, { id, field: 'type', operator: 'eq', value: '' }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const clearFilters = () => setFilters([]);

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className={styles.sortIcon}>↕</span>;
    return <span className={`${styles.sortIcon} ${styles.active}`}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const rankLabel = rankingMode === 'bp' ? t('col_bp') : t('col_elo');
  const rankDesc = rankingMode === 'bp'
    ? 'Colley — order-independent, strength-aware'
    : 'Batch Elo — sequential, strength-aware';

  const exportCsv = () => {
    const headers = ['Name', 'Type', 'Elo', 'BP', 'Scoring Rate', 'Win Rate', 'Wins', 'Losses', 'Battles'];
    const rows = filteredAndSorted.map(p => [
      p.name, p.type, p.elo, p.bp, p.scoringRate, p.winRate, p.wins, p.losses, p.totalMatches
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parts_stats.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`view ${styles.page}`}>
      <div className={styles.header}>
        <h1>{t('stats_title')}</h1>

        <div className={styles.controls}>
          <span className={styles.modeLabel}>{t('stats_ranking_mode')}</span>
          <div className={styles.toggle}>
            <button
              id="toggle-elo"
              className={`${styles.toggleBtn} ${rankingMode === 'elo' ? styles.active : ''}`}
              onClick={() => handleModeToggle('elo')}
            >
              {t('col_elo')}
            </button>
            <button
              id="toggle-bp"
              className={`${styles.toggleBtn} ${rankingMode === 'bp' ? styles.active : ''}`}
              onClick={() => handleModeToggle('bp')}
            >
              {t('col_bp')}
            </button>
          </div>
          <span className={styles.modeDesc}>{rankDesc}</span>
          
          <button 
            className={`${styles.filterToggle} ${filters.length > 0 ? styles.activeFilters : ''}`}
            onClick={() => setIsFilterModalOpen(true)}
          >
            <Filter size={16} />
            {t('btn_filters')}
            {filters.length > 0 && <span className={styles.filterBadge}>{filters.length}</span>}
          </button>
        </div>

        {isFilterModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsFilterModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitleRow}>
                  <Filter className={styles.modalTitleIcon} size={20} />
                  <h2>{t('modal_filter_title')}</h2>
                </div>
                <button className={styles.closeBtn} onClick={() => setIsFilterModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.filterList}>
                  {filters.map(f => {
                    const fieldInfo = FILTER_FIELDS.find(ff => ff.id === f.field);
                    return (
                      <div key={f.id} className={styles.filterRow}>
                        <select 
                          value={f.field} 
                          onChange={e => updateFilter(f.id, { field: e.target.value, value: '', operator: 'eq' })}
                          className={styles.filterSelect}
                        >
                          {FILTER_FIELDS.map(ff => (
                            <option key={ff.id} value={ff.id}>{t(ff.label as any)}</option>
                          ))}
                        </select>

                        {fieldInfo?.type === 'numeric' && (
                          <select 
                            value={f.operator} 
                            onChange={e => updateFilter(f.id, { operator: e.target.value })}
                            className={styles.filterOperator}
                          >
                            {OPERATORS.map(op => (
                              <option key={op.id} value={op.id}>{t(op.label as any)}</option>
                            ))}
                          </select>
                        )}

                        {fieldInfo?.type === 'categorical' ? (
                          <select 
                            value={String(f.value)} 
                            onChange={e => updateFilter(f.id, { value: e.target.value })}
                            className={styles.filterValueSelect}
                          >
                            <option value="">-- {t('col_type')} --</option>
                            {availableTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type="number" 
                            value={f.value} 
                            onChange={e => updateFilter(f.id, { value: e.target.value })}
                            placeholder="0"
                            className={styles.filterInput}
                          />
                        )}

                        <button className={styles.removeFilterBtn} onClick={() => removeFilter(f.id)}>&times;</button>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.addFilterBtn} onClick={addFilter}>
                    + {t('btn_add_filter')}
                  </button>
                  {filters.length > 0 && (
                    <button className={styles.clearAllBtn} onClick={clearFilters}>
                      {t('btn_clear_filters')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {helpModal && (
          <div className={styles.modalOverlay} onClick={() => setHelpModal(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitleRow}>
                  <HelpCircle className={styles.modalTitleIcon} size={20} />
                  <h2>{helpModal.title}</h2>
                </div>
                <button className={styles.closeBtn} onClick={() => setHelpModal(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.helpDesc}>{helpModal.desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* DEV-ONLY: remove before release */}
        {filteredAndSorted.length > 0 && (
          <button onClick={exportCsv} style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: '#334155', border: '1px dashed #475569', color: '#94a3b8', borderRadius: '0.4rem', cursor: 'pointer' }}>
            ⬇ Export CSV (dev)
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.feedback}>{t('stats_loading')}</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className={styles.feedback}>{t('stats_empty')}</div>
      ) : (
        <div className={styles.tableWrapper}>
          {/* Separate Sticky Header Table */}
          <div className={styles.headerWrapper} ref={headerRef}>
            <div className={styles.sidebarSafeZone} />
            <table className={styles.tableHeader}>
              <thead className={styles.thead}>
                <tr className={styles.headerRow}>
                  <th className={styles.thPart}>{t('col_part')}</th>
                  <th className={styles.thTag}></th>
                  <th
                    className={`${styles.th} ${styles.rankCellHeader} ${sortKey === rankingMode ? styles.activeCol : ''}`}
                    onClick={() => handleSort(rankingMode)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {rankLabel} <SortIndicator col={rankingMode} />
                      <button 
                        className={styles.helpIconBtn} 
                        onClick={(e) => { e.stopPropagation(); setHelpModal({ title: t('modal_help_bp_title'), desc: t('modal_help_bp_desc') }); }}
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  </th>
                  <th className={`${styles.th} ${styles.scoringCellHeader}`} onClick={() => handleSort('scoringRate')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {t('col_scoring_rate')} <SortIndicator col="scoringRate" />
                      <button 
                        className={styles.helpIconBtn} 
                        onClick={(e) => { e.stopPropagation(); setHelpModal({ title: t('modal_help_scoring_title'), desc: t('modal_help_scoring_desc') }); }}
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  </th>
                  <th className={styles.th} onClick={() => handleSort('winRate')}>
                    {t('col_winrate')} <SortIndicator col="winRate" />
                  </th>
                  <th className={styles.th} onClick={() => handleSort('wins')}>
                    {t('col_wins')} <SortIndicator col="wins" />
                  </th>
                  <th className={styles.th} onClick={() => handleSort('losses')}>
                    {t('col_losses')} <SortIndicator col="losses" />
                  </th>
                  <th className={styles.th} onClick={() => handleSort('totalMatches')}>
                    {t('col_battles')} <SortIndicator col="totalMatches" />
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable Body Table */}
          <div className={styles.bodyWrapper} ref={bodyRef} onScroll={handleScroll}>
            <table className={styles.tableBody}>
              <tbody className={styles.tbody}>
                {filteredAndSorted.map((part, i) => {
                  const noData = part.totalMatches === 0;
                  const rankValue = rankingMode === 'bp' ? part.bp : part.elo;
                  const typeColor = TYPE_COLORS[part.type] ?? '#94a3b8';
                  return (
                    <tr 
                      key={part.id} 
                      className={`${styles.row} ${i % 2 === 0 ? styles.even : ''}`}
                      onClick={() => navigate(`/stats/parts/${part.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className={styles.tdPart}>
                        <div className={styles.partContent}>
                          <div className={styles.partNameRow}>
                            <span className={styles.partName}>{part.name}</span>
                          </div>
                          <span className={styles.typeBadge} style={{ color: typeColor }}>{part.type}</span>
                        </div>
                      </td>
                      <td className={styles.tdTag}>
                        {part.isDependent && (
                          <button 
                            className="dependent-tag" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/stats/parts/${part.id}?showDependencies=true`);
                            }}
                          >
                            <HelpCircle size={10} style={{ marginRight: '3px' }} />
                            <span className="tag-full">{t('tag_dependent')}</span>
                            <span className="tag-short">{t('tag_dependent_short')}</span>
                          </button>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.rankCell}`}>
                        {noData ? <span className={styles.dash}>—</span> : (
                          <span className={styles.rankValue}>{rankValue}</span>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.scoringCell}`}>{noData ? <span className={styles.dash}>—</span> : `${part.scoringRate}%`}</td>
                      <td className={styles.td}>{noData ? <span className={styles.dash}>—</span> : part.winRate}</td>
                      <td className={`${styles.td} ${styles.win}`}>{noData ? <span className={styles.dash}>—</span> : part.wins}</td>
                      <td className={`${styles.td} ${styles.loss}`}>{noData ? <span className={styles.dash}>—</span> : part.losses}</td>
                      <td className={styles.td}>{part.totalMatches || <span className={styles.dash}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
