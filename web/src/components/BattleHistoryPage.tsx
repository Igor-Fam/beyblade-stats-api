import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBattleHistory, deleteBattle, type BattleHistoryItem, type BattleEntry } from '../lib/api';
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

export default function BattleHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<{ total: number; battles: BattleHistoryItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // removed scroll refs for card layout

  const loadHistory = async () => {
    setLoading(true);
    try {
      const d = await fetchBattleHistory(page, LIMIT);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page]);

  const confirmDeleteAction = async () => {
    if (confirmDelete === null) return;
    const id = confirmDelete;
    setDeleting(id);
    try {
      await deleteBattle(id);
      loadHistory();
      setConfirmDelete(null);
    } catch (e: any) {
      alert(e.message);
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
        abbreviation: (ep.part as any).abbreviation 
      };
    });

    const metadata = (line as any).metadata;
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
    
    return lps.length > 0 ? lps.join(' ').replace(/-/g, '\u2011') : (line as any).name;
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;
  // removed colWidths for table

  return (
    <div className={`view ${styles.page}`}>
      <header className={styles.header}>
        <h1>{t('battle_history_title')}</h1>
        {data && (
          <span className={styles.totalBadge}>{data.total} {t('col_battles').toLowerCase()}</span>
        )}
      </header>

      {loading && page === 1 && <div className={styles.feedback}>{t('stats_loading')}</div>}
      {error && <div className={styles.feedback}>{error}</div>}

      {data && (!loading || page > 1) && (
        <>
          <div className={styles.listContainer}>
            {data.battles.map((battle: BattleHistoryItem) => {
              const [e1, e2] = battle.entries;
              const winner = e1.points > 0 ? e1 : e2;
              const finish = winner.finishType;
              const date = new Date(battle.createdAt);
              const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
              const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={battle.id}
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
              );
            })}
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
