import { useState, useEffect } from 'react';
import { RotateCcw, Smartphone, Trash2, X } from 'lucide-react';
import type { Line, Part, Stadium } from '../lib/api';
import { fetchLines, fetchParts, fetchStadiums, registerBattle, deleteBattle } from '../lib/api';
import ComboCard from './ComboCard';
import { useTranslation } from '../lib/i18n';
import styles from './BattleLogger.module.css';

export default function BattleLogger() {
  const [lines, setLines] = useState<Line[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);

  const [lineA, setLineA] = useState<number | null>(null);
  const [lineB, setLineB] = useState<number | null>(null);
  const [partsA, setPartsA] = useState<Record<string, number>>({});
  const [partsB, setPartsB] = useState<Record<string, number>>({});

  const [stadiumId, setStadiumId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [status, setStatus] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [sessionBattles, setSessionBattles] = useState<any[]>([]);
  const { t } = useTranslation();
  const [scoreResetAt, setScoreResetAt] = useState<number>(() => {
    return parseInt(localStorage.getItem('scoreResetAt') || Date.now().toString());
  });

  useEffect(() => {
    Promise.all([fetchLines(), fetchParts(), fetchStadiums()]).then(([l, p, s]) => {
      setLines(l); setParts(p); setStadiums(s);
    });
  }, []);

  const { scoreA, scoreB } = sessionBattles.reduce((acc, battle) => {
    if (battle.createdAt < scoreResetAt) return acc;
    if (battle.winner === 0) acc.scoreA = Math.min(99, acc.scoreA + battle.points);
    else acc.scoreB = Math.min(99, acc.scoreB + battle.points);
    return acc;
  }, { scoreA: 0, scoreB: 0 });

  const handlePartChange = (player: 0 | 1, slot: string, partId: number) => {
    const updateRecord = (prev: Record<string, number>) => {
      if (!partId) {
        const next = { ...prev };
        delete next[slot];
        return next;
      }
      return { ...prev, [slot]: partId };
    };
    if (player === 0) setPartsA(updateRecord);
    else setPartsB(updateRecord);
  };

  const handleReset = () => {
    const now = Date.now();
    setScoreResetAt(now);
    localStorage.setItem('scoreResetAt', now.toString());
    setShowResetModal(false);
  };

  const handleRemoveOne = async (battleId: number) => {
    setLoading(true);
    try {
      await deleteBattle(battleId);
      setSessionBattles(prev => prev.filter(b => b.id !== battleId));
    } catch (err: any) {
      setStatus({ msg: t('status_remove_error') + err.message, type: 'error' });
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (sessionBattles.length === 0) return;
    const lastBattle = sessionBattles[0];
    setLoading(true);
    try {
      await deleteBattle(lastBattle.id);
      setSessionBattles(prev => prev.slice(1));
      setStatus({ msg: t('status_undo_success'), type: 'success' });
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      setStatus({ msg: t('status_undo_error') + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (winnerIndex: number, finishType: string) => {
    if (!stadiumId) return setStatus({ msg: t('status_select_stadium'), type: 'error' });
    if (!lineA || !lineB) return setStatus({ msg: t('status_select_lines'), type: 'error' });

    setLoading(true);
    try {
      const { battleId } = await registerBattle({
        stadiumId,
        finishType,
        winner: winnerIndex,
        entries: [
          { lineId: lineA, partsIds: Object.values(partsA) },
          { lineId: lineB, partsIds: Object.values(partsB) }
        ]
      });

      const makeLabel = (lId: number, pMap: Record<string, number>) => {
        const line = lines.find(l => l.id === lId);
        if (!line) return t('custom');
        const lps = (line.metadata?.slots || []).map(s => {
          const p = parts.find(px => px.id === pMap[s]);
          return p?.abbreviation || p?.name || '';
        }).filter(Boolean);
        return lps.length > 0 ? lps.join(' ') : line.name;
      };

      const labelA = makeLabel(lineA, partsA);
      const labelB = makeLabel(lineB, partsB);

      // ---- Save Shared History Snapshots ----
      const saveCombosToStorage = () => {
        const arePartsEqual = (p1: Record<string, number>, p2: Record<string, number>) => {
          if (!p1 || !p2) return false;
          const k1 = Object.keys(p1);
          if (k1.length !== Object.keys(p2).length) return false;
          return k1.every(k => p1[k] === p2[k]);
        };

        let existing = JSON.parse(localStorage.getItem('comboHistory') || '[]');

        const processPush = (lId: number, pMap: Record<string, number>, label: string) => {
          existing = existing.filter((c: any) => !(c.lineId === lId && arePartsEqual(c.parts, pMap)));
          const snap = { id: Date.now() + Math.random(), label, lineId: lId, parts: pMap };
          existing.unshift(snap);
        };

        // Push Player A
        processPush(lineA, partsA, labelA);
        // Push Player B (skip if identical Mirror Match)
        if (!(lineA === lineB && arePartsEqual(partsA, partsB))) {
          processPush(lineB, partsB, labelB);
        }

        localStorage.setItem('comboHistory', JSON.stringify(existing.slice(0, 20)));
        window.dispatchEvent(new Event('combomemory'));
      };
      saveCombosToStorage();
      // --------------------------------

      const points = { 'SPIN': 1, 'OVER': 2, 'BURST': 2, 'XTREME': 3 }[finishType] || 1;
      const battleRecord = {
        id: battleId,
        winner: winnerIndex,
        finishType,
        points,
        labelA,
        labelB,
        createdAt: Date.now()
      };
      setSessionBattles(prev => [battleRecord, ...prev]);

      setStatus({ msg: t('status_battle_logged', { winner: winnerIndex === 0 ? 'A' : 'B', type: finishType }), type: 'success' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ msg: err.message || t('status_save_error'), type: 'error' });
      setTimeout(() => setStatus(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleLineChange = (player: 0 | 1, lineId: number) => {
    if (player === 0) {
      setLineA(lineId);
      setPartsA({});
    } else {
      setLineB(lineId);
      setPartsB({});
    }
  };

  return (
    <div className="view">
      <div className={styles['portrait-lock-overlay']}>
        <Smartphone size={64} style={{ marginBottom: '1rem' }} />
        <h2>{t('rotate_device')}</h2>
        <p>{t('rotate_desc')}</p>
      </div>

      <div className={styles['battle-logger-container']}>
        <div className={styles['view-header']}>
          <h1>{t('logger_title')}</h1>
        </div>

        <div className={styles['battle-grid']}>
          {/* Left Column: Combo A */}
          <div className={`${styles['combo-column']} ${styles['a-side']}`}>
            <ComboCard playerId={0} lines={lines} parts={parts} selectedLineId={lineA} selectedParts={partsA} onLineChange={(id) => handleLineChange(0, id)} onPartChange={(slot, id) => handlePartChange(0, slot, id)} />
          </div>

          {/* Center Column: Score & Actions */}
          <div className={styles['action-column']}>
            <div className={styles['stadium-selector']}>
              <select value={stadiumId || ''} onChange={e => setStadiumId(parseInt(e.target.value))}>
                <option value="">{t('stadium_placeholder')}</option>
                {stadiums.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className={styles['score-display']}>
              <div className={styles['score-numbers']}>
                <span className={styles['score-blue']}>{scoreA}</span>
                <div className={styles['score-middle-column']}>
                  <button className={styles['reset-score-icon']} title={t('reset_score_title')} onClick={() => setShowResetModal(true)}>
                    <RotateCcw size={20} />
                  </button>
                  <div className={styles['score-vertical-divider']}></div>
                </div>
                <span className={styles['score-orange']}>{scoreB}</span>
              </div>
            </div>

            <div className={styles['finish-buttons-grid']}>
              <button className={`${styles['finish-btn']} ${styles.blue}`} disabled={loading} onClick={() => handleFinish(0, 'SPIN')}>Spin</button>
              <button className={`${styles['finish-btn']} ${styles.orange}`} disabled={loading} onClick={() => handleFinish(1, 'SPIN')}>Spin</button>
              <button className={`${styles['finish-btn']} ${styles.blue}`} disabled={loading} onClick={() => handleFinish(0, 'OVER')}>Over</button>
              <button className={`${styles['finish-btn']} ${styles.orange}`} disabled={loading} onClick={() => handleFinish(1, 'OVER')}>Over</button>
              <button className={`${styles['finish-btn']} ${styles.blue}`} disabled={loading} onClick={() => handleFinish(0, 'BURST')}>Burst</button>
              <button className={`${styles['finish-btn']} ${styles.orange}`} disabled={loading} onClick={() => handleFinish(1, 'BURST')}>Burst</button>
              <button className={`${styles['finish-btn']} ${styles.blue}`} disabled={loading} onClick={() => handleFinish(0, 'XTREME')}>Xtreme</button>
              <button className={`${styles['finish-btn']} ${styles.orange}`} disabled={loading} onClick={() => handleFinish(1, 'XTREME')}>Xtreme</button>
            </div>

            <div className={styles['history-actions']}>
              <button className={styles['undo-btn']} disabled={loading || sessionBattles.length === 0} onClick={handleUndo}>
                {t('undo_last')}
              </button>
              <button className={styles['history-btn']} onClick={() => setShowHistoryModal(true)}>{t('battle_history')}</button>
            </div>
          </div>

          {/* Right Column: Combo B */}
          <div className={`${styles['combo-column']} ${styles['b-side']}`}>
            <ComboCard playerId={1} lines={lines} parts={parts} selectedLineId={lineB} selectedParts={partsB} onLineChange={(id) => handleLineChange(1, id)} onPartChange={(slot, id) => handlePartChange(1, slot, id)} />
          </div>
        </div>

        {status && (
          <div id={styles.status} style={{ display: 'block', background: status.type === 'success' ? 'var(--success)' : 'var(--error)', color: '#0f172a' }}>
            {status.msg}
          </div>
        )}

        {showHistoryModal && (
          <div className={styles.modal}>
            <div className={`${styles['modal-content']} ${styles['history-modal-content']}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>{t('history_title')}</h3>
                <button className={styles['reset-score-icon']} onClick={() => setShowHistoryModal(false)}><X size={24} /></button>
              </div>

              <div className={styles['history-list']}>
                {sessionBattles.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('history_empty')}</p>}

                {sessionBattles.map((b, idx) => {
                  const nextB = sessionBattles[idx - 1]; // We are in descending order
                  const isFirstAfterReset = b.createdAt < scoreResetAt && (!nextB || nextB.createdAt >= scoreResetAt);

                  return (
                    <div key={b.id}>
                      {isFirstAfterReset && (
                        <div className={styles['history-reset-divider']}>
                          <span>{t('history_reset_label')}</span>
                        </div>
                      )}
                      <div className={styles['history-row-container']}>
                        <div className={styles['history-battle-pill']}>
                          <div className={`${styles['combo-side']} ${styles['side-0']} ${b.winner === 0 ? styles.winner : ''}`}>
                            <strong>{b.labelA}</strong>
                            {b.winner === 0 && <span className={styles['win-detail']}>{b.finishType}! +{b.points}</span>}
                          </div>
                          <div className={styles['side-divider']} />
                          <div className={`${styles['combo-side']} ${styles['side-1']} ${b.winner === 1 ? styles.winner : ''}`}>
                            <strong>{b.labelB}</strong>
                            {b.winner === 1 && <span className={styles['win-detail']}>{b.finishType}! +{b.points}</span>}
                          </div>
                        </div>
                        <button className={styles['trash-btn-box']} disabled={loading} onClick={() => handleRemoveOne(b.id)}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showResetModal && (
          <div className={styles.modal}>
            <div className={styles['modal-content']}>
              <h3>{t('reset_modal_title')}</h3>
              <p>{t('reset_modal_desc')}</p>
              <div className={styles['modal-actions']}>
                <button className="btn" style={{ flex: 1, background: 'var(--surface-light)' }} onClick={() => setShowResetModal(false)}>{t('cancel')}</button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={handleReset}>{t('reset')}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
