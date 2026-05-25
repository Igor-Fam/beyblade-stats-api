import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { fetchBattleHistory, deleteBattle, fetchStadiums, fetchParts, type BattleHistoryItem, type BattleEntry, type Stadium, type Part } from '../lib/api';
import { type BattleFilterCondition } from '../services/LocalStatsService';
import { useTranslation } from '../lib/i18n';
import styles from './BattleHistoryPage.module.css';

const FINISH_COLORS: Record<string, string> = {
  XTREME: '#f43f5e',
  BURST:   '#fb923c',
  OVER:    '#fbbf24',
  SPIN:    '#38bdf8',
};

const FINISH_LABELS: Record<string, string> = {
  SPIN:    'Spin',
  OVER:    'Over',
  BURST:   'Burst',
  XTREME:  'Xtreme',
};



const FILTER_BATTLE_FIELDS = [
  { id: 'stadium', label: 'filter_stadium', select_placeholder: 'select_placeholder' },
  { id: 'date', label: 'filter_date', select_placeholder: 'select_placeholder' },
  { id: 'finishType', label: 'filter_finish_type', select_placeholder: 'select_placeholder' },
  { id: 'parts', label: 'filter_parts', select_placeholder: 'select_placeholder' }
];

export default function BattleHistoryPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<{ total: number; battles: BattleHistoryItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const [battleFilters, setBattleFilters] = useState<BattleFilterCondition[]>(() => {
    try {
      const saved = localStorage.getItem('history_battle_filters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [isBattleFilterModalOpen, setIsBattleFilterModalOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchStadiums().then(setStadiums).catch(console.error);
    fetchParts().then(setParts).catch(console.error);
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const d = await fetchBattleHistory(battleFilters, page, LIMIT);
      setData(d);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('history_battle_filters', JSON.stringify(battleFilters));
  }, [battleFilters]);

  useEffect(() => {
    loadHistory();
  }, [page, battleFilters]);

  const confirmDeleteAction = async () => {
    if (confirmDelete === null) return;
    const id = confirmDelete;
    setDeleting(id);
    try {
      await deleteBattle(id);
      loadHistory();
      setConfirmDelete(null);
    } catch (e: unknown) {
      alert((e as Error).message);
      setDeleting(null);
    }
  };

  const getComboName = (entry: BattleEntry) => {
    const line = entry.line;
    if (!line) return t('custom');
    
    const pMap: Record<string, { name: string, abbreviation?: string }> = {};
    entry.parts.forEach(ep => {
      pMap[ep.part.partType.name] = { 
        name: ep.part.name, 
        abbreviation: (ep.part as unknown as { abbreviation?: string }).abbreviation 
      };
    });

    const metadata = (line as unknown as { metadata?: { slots?: string[]; nameTemplate?: string } }).metadata;
    const slotList = metadata?.slots || [];
    
    if (metadata?.nameTemplate) {
      let res = metadata.nameTemplate;
      slotList.forEach((s: string) => {
        const p = pMap[s];
        const val = p?.abbreviation || p?.name || '';
        res = res.replace(`{${s}}`, val);
      });
      return res.trim().replace(/\s+/g, ' ').replace(/-/g, '\u2011');
    }

    const lps = slotList.map((s: string) => {
      const p = pMap[s];
      return p?.abbreviation || p?.name || '';
    }).filter(Boolean);
    
    return lps.length > 0 ? lps.join(' ').replace(/-/g, '\u2011') : (line as unknown as { name: string }).name;
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return lang === 'pt' ? 'Hoje' : 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return lang === 'pt' ? 'Ontem' : 'Yesterday';
    }

    return d.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const addBattleFilter = () => {
    setBattleFilters([...battleFilters, { field: 'stadium', operator: 'eq', value: '' } as any]);
    setPage(1);
  };

  const removeBattleFilter = (index: number) => {
    setBattleFilters(battleFilters.filter((_, i) => i !== index));
    setPage(1);
  };

  const updateBattleFilter = (index: number, updates: Partial<BattleFilterCondition>) => {
    setBattleFilters(battleFilters.map((f, i) => i === index ? { ...f, ...updates } : f));
    setPage(1);
  };

  const clearBattleFilters = () => {
    setBattleFilters([]);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;
  const battleFiltersActive = battleFilters.length > 0;

  return (
    <div className={`view ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerControls}>
          <h1>{t('battle_history_title')}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {data && (
              <span className={styles.totalBadge}>{data.total} {t('col_battles').toLowerCase()}</span>
            )}
            
            <div className={styles.filterBtnWrapper}>
              <button
                className={`${styles.filterToggle} ${battleFilters.length > 0 ? styles.activeFilters : ''}`}
                onClick={() => setIsBattleFilterModalOpen(true)}
              >
                <Filter size={16} />
                {t('btn_filter_battles')}
                {battleFilters.length > 0 && <span className={styles.filterBadge}>{battleFilters.length}</span>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {battleFiltersActive && (
        <div className={styles.globalFilterBanner}>
          <Filter size={14} />
          <span>{t('filter_active_full_notice')}</span>
          <button className={styles.clearBannerBtn} onClick={clearBattleFilters}>{t('btn_clear_filters')}</button>
        </div>
      )}

      {loading && page === 1 && <div className={styles.feedback}>{t('stats_loading')}</div>}
      {error && <div className={styles.feedback}>{error}</div>}

      {data && (!loading || page > 1) && data.battles.length === 0 && (
        <div className={styles.feedback}>{t('stats_empty')}</div>
      )}

      {data && (!loading || page > 1) && data.battles.length > 0 && (
        <>
          <div className={styles.listContainer}>
            {(() => {
              let lastDayLabel = '';
              return data.battles.map((battle: BattleHistoryItem) => {
                const [e1, e2] = battle.entries;
                const winner = e1.points > 0 ? e1 : e2;
                const finish = winner.finishType;
                const date = new Date(battle.createdAt);
                const currentDayLabel = getDayLabel(battle.createdAt);
                const showDivider = currentDayLabel !== lastDayLabel;
                lastDayLabel = currentDayLabel;

                const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                return (
                  <Fragment key={battle.id}>
                    {showDivider && (
                      <div className={styles.dayDivider}>
                        <span className={styles.dayLabel}>{currentDayLabel}</span>
                      </div>
                    )}
                    <div 
                      className={styles.card}
                      onClick={() => navigate(`/battles/${battle.id}`)}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.cardStadium}>{battle.stadium.name}</span>
                        <span className={styles.cardDate}>{dateStr} {timeStr}</span>
                      </div>

                      <div className={styles.cardBody}>
                        <div className={styles.battlePill}>
                          <div className={`${styles.comboSide} ${e1.points > 0 ? styles.winnerSide : styles.loserSide}`}>
                            <strong className={styles.comboName}>{getComboName(e1)}</strong>
                            {e1.points > 0 && (
                              <div className={styles.winDetail}>
                                <span className={styles.finishBadge} style={{ 
                                  color: FINISH_COLORS[finish], 
                                  borderColor: `${FINISH_COLORS[finish]}44`, 
                                  background: `${FINISH_COLORS[finish]}12` 
                                }}>
                                  {FINISH_LABELS[finish] ?? finish}
                                </span>
                                <span className={styles.winPoints}>+{e1.points}</span>
                              </div>
                            )}
                          </div>
                          <div className={styles.sideDivider} />
                          <div className={`${styles.comboSide} ${e2.points > 0 ? styles.winnerSide : styles.loserSide}`}>
                            <strong className={styles.comboName}>{getComboName(e2)}</strong>
                            {e2.points > 0 && (
                              <div className={styles.winDetail}>
                                <span className={styles.finishBadge} style={{ 
                                  color: FINISH_COLORS[finish], 
                                  borderColor: `${FINISH_COLORS[finish]}44`, 
                                  background: `${FINISH_COLORS[finish]}12` 
                                }}>
                                  {FINISH_LABELS[finish] ?? finish}
                                </span>
                                <span className={styles.winPoints}>+{e2.points}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          className={styles.trashBtn} 
                          disabled={deleting === battle.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(battle.id);
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </Fragment>
                );
              });
            })()}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={20} />
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button className={styles.pageBtn} onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {isBattleFilterModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsBattleFilterModalOpen(false)}>
          <div className={styles.filterModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <Filter className={styles.modalTitleIcon} size={20} style={{ color: 'var(--accent-bx)' }} />
                <h2>{t('modal_filter_battles_title')}</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsBattleFilterModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.filterList}>
                {battleFilters.map((f, i) => (
                  <div key={i} className={styles.filterRow}>
                    <select
                      value={f.field}
                      onChange={e => updateBattleFilter(i, { field: e.target.value as any, value: '', operator: 'eq' })}
                      className={styles.filterSelect}
                    >
                      {FILTER_BATTLE_FIELDS.map(ff => (
                        <option key={ff.id} value={ff.id}>{t(ff.label as any)}</option>
                      ))}
                    </select>

                    {f.field === 'date' && (
                      <select
                        value={f.operator}
                        onChange={e => updateBattleFilter(i, { operator: e.target.value as any, value: '' })}
                        className={styles.filterOperator}
                      >
                        <option value="eq">{isMobileView ? '=' : t('filter_op_eq')}</option>
                        <option value="gt">{isMobileView ? '>' : t('filter_op_gt')}</option>
                        <option value="lt">{isMobileView ? '<' : t('filter_op_lt')}</option>
                      </select>
                    )}

                    {f.field === 'stadium' ? (
                      <select
                        value={String(f.value)}
                        onChange={e => updateBattleFilter(i, { value: e.target.value })}
                        className={`${styles.filterValueSelect} ${!f.value ? styles.placeholderSelect : ''}`}
                      >
                        <option value="">{t('select_placeholder')}</option>
                        {stadiums.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    ) : f.field === 'finishType' ? (
                      <select
                        value={String(f.value)}
                        onChange={e => updateBattleFilter(i, { value: e.target.value })}
                        className={`${styles.filterValueSelect} ${!f.value ? styles.placeholderSelect : ''}`}
                      >
                        <option value="">{t('select_placeholder')}</option>
                        <option value="SPIN">Spin Finish</option>
                        <option value="OVER">Over Finish</option>
                        <option value="BURST">Burst Finish</option>
                        <option value="XTREME">Xtreme Finish</option>
                      </select>
                    ) : f.field === 'parts' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1.5, gap: '0.25rem', minWidth: '120px' }}>
                        <select
                          value=""
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            const currentSelectedIds = String(f.value || '').split(',').filter(Boolean);
                            if (!currentSelectedIds.includes(val)) {
                              updateBattleFilter(i, { value: [...currentSelectedIds, val].join(',') });
                            }
                          }}
                          className={`${styles.filterValueSelect} ${styles.placeholderSelect}`}
                          style={{ width: '100%' }}
                        >
                          <option value="">{t('select_placeholder')}</option>
                          {parts.map(p => (
                            <option key={p.id} value={p.id}>{t(p.name as any)}</option>
                          ))}
                        </select>
                        <div className={styles.selectedPartsContainer}>
                          {String(f.value || '').split(',').filter(Boolean).map(idStr => {
                            const partObj = parts.find(p => p.id === Number(idStr));
                            return (
                              <span key={idStr} className={styles.partFilterPill}>
                                {partObj ? t(partObj.name as any) : idStr}
                                <button
                                  type="button"
                                  className={styles.removePillBtn}
                                  onClick={() => {
                                    const nextIds = String(f.value || '').split(',').filter(id => id !== idStr && id !== '');
                                    updateBattleFilter(i, { value: nextIds.join(',') });
                                  }}
                                >
                                  &times;
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <input
                        type={f.operator === 'eq' ? 'date' : 'datetime-local'}
                        value={String(f.value)}
                        onChange={e => updateBattleFilter(i, { value: e.target.value })}
                        className={`${styles.filterInput} ${!f.value ? styles.placeholderSelect : ''}`}
                        style={{ flex: 1 }}
                        placeholder={t('select_placeholder')}
                      />
                    )}

                    <button className={styles.removeFilterBtn} onClick={() => removeBattleFilter(i)}>&times;</button>
                  </div>
                ))}
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.addFilterBtn} onClick={addBattleFilter}>
                  + {t('btn_add_filter')}
                </button>
                {battleFilters.length > 0 && (
                  <button className={styles.clearAllBtn} onClick={clearBattleFilters}>
                    {t('btn_clear_filters')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{t('remove')}</h3>
            <p>{t('confirm_delete_battle')}</p>
            <div className={styles.modalActions}>
              <button 
                className={`${styles.btn} ${styles.btnCancel}`} 
                onClick={() => setConfirmDelete(null)}
              >
                {t('cancel')}
              </button>
              <button 
                className={`${styles.btn} ${styles.btnDanger}`} 
                onClick={confirmDeleteAction}
                disabled={deleting === confirmDelete}
              >
                {deleting === confirmDelete ? '...' : t('remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
