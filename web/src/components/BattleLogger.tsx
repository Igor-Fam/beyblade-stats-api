import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Smartphone, Trash2, X } from 'lucide-react';
import type { Line, Part, Stadium } from '../lib/api';
import { fetchLines, fetchParts, fetchStadiums, registerBattle, fetchDatabaseHealth, deleteBattle } from '../lib/api';
import ComboCard from './ComboCard';

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
  const [dbEnv, setDbEnv] = useState<'production' | 'sandbox' | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [status, setStatus] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [sessionBattles, setSessionBattles] = useState<any[]>([]);
  const [scoreResetAt, setScoreResetAt] = useState<number>(() => {
    return parseInt(localStorage.getItem('scoreResetAt') || Date.now().toString());
  });

  useEffect(() => {
    Promise.all([fetchLines(), fetchParts(), fetchStadiums(), fetchDatabaseHealth()]).then(([l, p, s, h]) => {
      setLines(l); setParts(p); setStadiums(s); setDbEnv(h.env);
    });
  }, []);

  const { scoreA, scoreB } = sessionBattles.reduce((acc, battle) => {
    if (battle.createdAt < scoreResetAt) return acc;
    if (battle.winner === 0) acc.scoreA += battle.points;
    else acc.scoreB += battle.points;
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
      setStatus({ msg: 'Failed to remove: ' + err.message, type: 'error' });
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
      setStatus({ msg: 'Last battle undone!', type: 'success' });
      setTimeout(() => setStatus(null), 2000);
    } catch (err: any) {
      setStatus({ msg: 'Failed to undo: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (winnerIndex: number, finishType: string) => {
    if (!stadiumId) return setStatus({ msg: 'Please select a stadium!', type: 'error' });
    if (!lineA || !lineB) return setStatus({ msg: 'Please select a line for both combos!', type: 'error' });

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

      const points = { 'SPIN': 1, 'OVER': 2, 'BURST': 2, 'XTREME': 3 }[finishType] || 1;
      const battleRecord = {
        id: battleId,
        winner: winnerIndex,
        finishType,
        points,
        createdAt: Date.now()
      };
      setSessionBattles(prev => [battleRecord, ...prev]);

      const makeLabel = (lId: number, pMap: Record<string, number>) => {
        const line = lines.find(l => l.id === lId);
        if (!line) return 'Custom';
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

      setStatus({ msg: `Battle Logged: Combo ${winnerIndex === 0 ? 'A' : 'B'} won by ${finishType}!`, type: 'success' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ msg: err.message || 'Error saving battle', type: 'error' });
      setTimeout(() => setStatus(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <div className="portrait-lock-overlay">
        <Smartphone size={64} style={{ marginBottom: '1rem' }} />
        <h2>Gire seu dispositivo</h2>
        <p>O Battle Logger exige o modo horizontal para enquadrar perfeitamente a arena e evitar rolagens cegas de tela.</p>
      </div>

      <div className="battle-logger-container">
        <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link to="/" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.5rem 1rem' }}>
            <ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Hub
          </Link>
          {dbEnv && (
            <span className={`db-env-badge ${dbEnv}`} title={`Connected to ${dbEnv} database`}>
              {dbEnv.toUpperCase()}
            </span>
          )}
          <h1 style={{ margin: 0 }}>Battle Logger</h1>
        </div>

        <div className="battle-grid">
          {/* Left Column: Combo A */}
          <div className="combo-column a-side">
            <ComboCard playerId={0} lines={lines} parts={parts} selectedLineId={lineA} selectedParts={partsA} onLineChange={setLineA} onPartChange={(slot, id) => handlePartChange(0, slot, id)} />
          </div>

          {/* Center Column: Score & Actions */}
          <div className="action-column">
            <div className="stadium-selector">
              <select value={stadiumId || ''} onChange={e => setStadiumId(parseInt(e.target.value))}>
                <option value="">-- Stadium --</option>
                {stadiums.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="score-display">
              <button className="reset-score-icon" title="Reset Score" onClick={() => setShowResetModal(true)}>
                <RotateCcw size={20} />
              </button>
              <div className="score-numbers">
                <span className="score-blue">{scoreA}</span>
                <div className="score-vertical-divider"></div>
                <span className="score-orange">{scoreB}</span>
              </div>
            </div>

            <div className="finish-buttons-grid">
              <button className="finish-btn blue" disabled={loading} onClick={() => handleFinish(0, 'SPIN')}>Spin</button>
              <button className="finish-btn orange" disabled={loading} onClick={() => handleFinish(1, 'SPIN')}>Spin</button>
              <button className="finish-btn blue" disabled={loading} onClick={() => handleFinish(0, 'OVER')}>Over</button>
              <button className="finish-btn orange" disabled={loading} onClick={() => handleFinish(1, 'OVER')}>Over</button>
              <button className="finish-btn blue" disabled={loading} onClick={() => handleFinish(0, 'BURST')}>Burst</button>
              <button className="finish-btn orange" disabled={loading} onClick={() => handleFinish(1, 'BURST')}>Burst</button>
              <button className="finish-btn blue" disabled={loading} onClick={() => handleFinish(0, 'XTREME')}>Xtreme</button>
              <button className="finish-btn orange" disabled={loading} onClick={() => handleFinish(1, 'XTREME')}>Xtreme</button>
            </div>

            <div className="history-actions">
              <button className="undo-btn" disabled={loading || sessionBattles.length === 0} onClick={handleUndo}>
                Undo last battle
              </button>
              <button className="history-btn" onClick={() => setShowHistoryModal(true)}>Battle history</button>
            </div>
          </div>

          {/* Right Column: Combo B */}
          <div className="combo-column b-side">
            <ComboCard playerId={1} lines={lines} parts={parts} selectedLineId={lineB} selectedParts={partsB} onLineChange={setLineB} onPartChange={(slot, id) => handlePartChange(1, slot, id)} />
          </div>
        </div>

        {status && (
          <div id="status" style={{ display: 'block', background: status.type === 'success' ? 'var(--success)' : 'var(--error)', color: '#0f172a' }}>
            {status.msg}
          </div>
        )}

        {showHistoryModal && (
          <div className="modal">
            <div className="modal-content history-modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Session Battles</h3>
                <button className="reset-score-icon" onClick={() => setShowHistoryModal(false)}><X size={24} /></button>
              </div>

              <div className="history-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {sessionBattles.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No battles this session</p>}

                {sessionBattles.map((b, idx) => {
                  const nextB = sessionBattles[idx - 1]; // We are in descending order
                  const isFirstAfterReset = b.createdAt < scoreResetAt && (!nextB || nextB.createdAt >= scoreResetAt);

                  return (
                    <div key={b.id}>
                      {isFirstAfterReset && (
                        <div className="history-reset-divider">
                          <span>LATEST SCORE RESET</span>
                        </div>
                      )}
                      <div className="history-table-row">
                        <div className="history-info">
                          <strong>Combo {b.winner === 0 ? 'A' : 'B'} won</strong>
                          <span className="history-sub">by {b.finishType} (+{b.points} pts)</span>
                        </div>
                        <button className="trash-btn" disabled={loading} onClick={() => handleRemoveOne(b.id)}>
                          <Trash2 size={16} />
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
          <div className="modal">
            <div className="modal-content">
              <h3>Reset Scoreboard</h3>
              <p>Are you sure you want to reset both scores to 0?</p>
              <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn" style={{ flex: 1, background: 'var(--surface-light)' }} onClick={() => setShowResetModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={handleReset}>Reset</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
