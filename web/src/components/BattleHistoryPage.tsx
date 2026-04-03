import { useState, useEffect, useRef } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Refs for scroll syncing
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

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

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_battle'))) return;
    setDeleting(id);
    try {
      await deleteBattle(id);
      loadHistory();
    } catch (e: any) {
      alert(e.message);
    } finally {
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
      return res.trim().replace(/\s+/g, ' ');
    }

    const lps = slotList.map((s: string) => {
      const p = pMap[s];
      return p?.abbreviation || p?.name || '';
    }).filter(Boolean);
    
    return lps.length > 0 ? lps.join(' ') : (line as any).name;
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;
  const colWidths = ['22%', '22%', '14%', '18%', '16%', '8%'];

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
          <div className={styles.tableWrapper}>
            <div className={styles.headerWrapper} ref={headerRef}>
              <table className={styles.tableHeader}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.thWinner}`}>{t('col_winner_fixed')}</th>
                    <th className={styles.th}>{t('col_loser_fixed')}</th>
                    <th className={`${styles.th} ${styles.thType}`}>{t('filter_finish_type')}</th>
                    <th className={styles.th}>{t('filter_stadium')}</th>
                    <th className={`${styles.th} ${styles.thDate}`}>{t('filter_date')}</th>
                    <th className={`${styles.th} ${styles.thRemove}`}></th>
                  </tr>
                </thead>
              </table>
            </div>

            <div className={styles.bodyWrapper} ref={bodyRef} onScroll={handleScroll}>
              <table className={styles.tableBody}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead className={styles.theadHidden}>
                  <tr className={styles.headerRowHidden}>
                    <th className={`${styles.th} ${styles.thWinner} ${styles.thHidden}`}>{t('col_winner_fixed')}</th>
                    <th className={`${styles.th} ${styles.thHidden}`}>{t('col_loser_fixed')}</th>
                    <th className={`${styles.th} ${styles.thType} ${styles.thHidden}`}>{t('filter_finish_type')}</th>
                    <th className={`${styles.th} ${styles.thHidden}`}>{t('filter_stadium')}</th>
                    <th className={`${styles.th} ${styles.thDate} ${styles.thHidden}`}>{t('filter_date')}</th>
                    <th className={`${styles.thRemove} ${styles.thHidden}`}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.battles.map((battle: BattleHistoryItem, idx: number) => {
                    const [e1, e2] = battle.entries;
                    const winner = e1.points > 0 ? e1 : e2;
                    const loser = e1.points > 0 ? e2 : e1;
                    const finish = winner.finishType;
                    const date = new Date(battle.createdAt);
                    const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr 
                        key={battle.id} 
                        className={`${styles.row} ${idx % 2 === 0 ? styles.even : ''} ${styles.clickableRow}`}
                        onClick={() => navigate(`/battles/${battle.id}`)}
                      >

                        <td className={`${styles.td} ${styles.tdWinner}`}>
                          {getComboName(winner)}
                        </td>
                        <td className={`${styles.td} ${styles.tdLoser}`}>
                          {getComboName(loser)}
                        </td>
                        <td className={`${styles.td} ${styles.tdType}`}>
                          <span className={styles.finishBadge} style={{ 
                            color: FINISH_COLORS[finish], 
                            borderColor: `${FINISH_COLORS[finish]}44`, 
                            background: `${FINISH_COLORS[finish]}12` 
                          }}>
                            {FINISH_LABELS[finish] ?? finish}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.tdArena}`}>{battle.stadium.name}</td>
                        <td className={`${styles.td} ${styles.tdDate}`}>
                          <span className={styles.dateMain}>{dateStr}</span>
                          <span className={styles.dateTime}>{timeStr}</span>
                        </td>
                        <td className={`${styles.td} ${styles.tdRemove}`}>
                          <button 
                            className={styles['trash-btn-box']} 
                            disabled={deleting === battle.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(battle.id);
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
