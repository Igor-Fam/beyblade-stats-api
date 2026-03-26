import { useState, useEffect, useMemo } from 'react';
import { type PartStats, fetchPartsList } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import styles from './StatsPage.module.css';

type RankingMode = 'elo' | 'bp';
type SortKey = keyof Pick<PartStats, 'elo' | 'bp' | 'avgPoints' | 'totalMatches' | 'wins' | 'losses' | 'winRate'>;
type SortDir = 'asc' | 'desc';

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
  const [parts, setParts] = useState<PartStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingMode, setRankingMode] = useState<RankingMode>('bp');
  const [sortKey, setSortKey] = useState<SortKey>('bp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const sorted = useMemo(() => {
    return [...parts].sort((a, b) => {
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
  }, [parts, sortKey, sortDir]);

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className={styles.sortIcon}>↕</span>;
    return <span className={`${styles.sortIcon} ${styles.active}`}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const rankLabel = rankingMode === 'bp' ? t('col_bp') : t('col_elo');
  const rankDesc = rankingMode === 'bp'
    ? 'Colley — order-independent, strength-aware'
    : 'Batch Elo — sequential, strength-aware';

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
        </div>
      </div>

      {loading ? (
        <div className={styles.feedback}>{t('stats_loading')}</div>
      ) : sorted.length === 0 ? (
        <div className={styles.feedback}>{t('stats_empty')}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thPart}>{t('col_part')}</th>
                <th
                  className={`${styles.th} ${sortKey === rankingMode ? styles.activeCol : ''}`}
                  onClick={() => handleSort(rankingMode)}
                  title={rankDesc}
                >
                  {rankLabel} <SortIndicator col={rankingMode} />
                </th>
                <th className={styles.th} onClick={() => handleSort('avgPoints')}>
                  {t('col_avg_pts')} <SortIndicator col="avgPoints" />
                </th>
                <th className={styles.th} onClick={() => handleSort('totalMatches')}>
                  {t('col_battles')} <SortIndicator col="totalMatches" />
                </th>
                <th className={styles.th} onClick={() => handleSort('wins')}>
                  {t('col_wins')} <SortIndicator col="wins" />
                </th>
                <th className={styles.th} onClick={() => handleSort('losses')}>
                  {t('col_losses')} <SortIndicator col="losses" />
                </th>
                <th className={styles.th} onClick={() => handleSort('winRate')}>
                  {t('col_winrate')} <SortIndicator col="winRate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((part, i) => {
                const noData = part.totalMatches === 0;
                const rankValue = rankingMode === 'bp' ? part.bp : part.elo;
                const typeColor = TYPE_COLORS[part.type] ?? '#94a3b8';
                return (
                  <tr key={part.id} className={`${styles.row} ${i % 2 === 0 ? styles.even : ''}`}>
                    <td className={styles.tdPart}>
                      <span className={styles.partName}>{part.name}</span>
                      <span className={styles.typeBadge} style={{ color: typeColor }}>{part.type}</span>
                    </td>
                    <td className={`${styles.td} ${styles.rankCell}`}>
                      {noData ? <span className={styles.dash}>—</span> : (
                        <span className={styles.rankValue}>{rankValue}</span>
                      )}
                    </td>
                    <td className={styles.td}>{noData ? <span className={styles.dash}>—</span> : part.avgPoints}</td>
                    <td className={styles.td}>{part.totalMatches || <span className={styles.dash}>—</span>}</td>
                    <td className={`${styles.td} ${styles.win}`}>{noData ? <span className={styles.dash}>—</span> : part.wins}</td>
                    <td className={`${styles.td} ${styles.loss}`}>{noData ? <span className={styles.dash}>—</span> : part.losses}</td>
                    <td className={styles.td}>{noData ? <span className={styles.dash}>—</span> : part.winRate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
