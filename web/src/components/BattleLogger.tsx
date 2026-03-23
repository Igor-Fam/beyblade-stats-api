import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { Line, Part, Stadium } from '../lib/api';
import { fetchLines, fetchParts, fetchStadiums, registerBattle } from '../lib/api';
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
  
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [status, setStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchLines(), fetchParts(), fetchStadiums()]).then(([l, p, s]) => {
      setLines(l); setParts(p); setStadiums(s);
    });
    const sA = localStorage.getItem('scoreA');
    const sB = localStorage.getItem('scoreB');
    if (sA) setScoreA(parseInt(sA));
    if (sB) setScoreB(parseInt(sB));
  }, []);

  const handlePartChange = (player: 0|1, slot: string, partId: number) => {
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
    setScoreA(0); setScoreB(0);
    localStorage.setItem('scoreA', '0');
    localStorage.setItem('scoreB', '0');
    setShowResetModal(false);
  };

  const handleFinish = async (winnerIndex: number, finishType: string) => {
    if (!stadiumId) return setStatus({ msg: 'Please select a stadium!', type: 'error' });
    if (!lineA || !lineB) return setStatus({ msg: 'Please select a line for both combos!', type: 'error' });

    setLoading(true);
    try {
      await registerBattle({
        stadiumId,
        finishType,
        winner: winnerIndex,
        entries: [
          { lineId: lineA, partsIds: Object.values(partsA) },
          { lineId: lineB, partsIds: Object.values(partsB) }
        ]
      });

      // ---- Save Shared History Snapshots ----
      const saveCombosToStorage = () => {
        const arePartsEqual = (p1: Record<string, number>, p2: Record<string, number>) => {
          if (!p1 || !p2) return false;
          const k1 = Object.keys(p1);
          if (k1.length !== Object.keys(p2).length) return false;
          return k1.every(k => p1[k] === p2[k]);
        };

        const makeLabel = (lId: number, pMap: Record<string, number>) => {
          const line = lines.find(l => l.id === lId);
          if (!line) return 'Custom';
          const lps = (line.metadata?.slots || []).map(s => {
            const p = parts.find(px => px.id === pMap[s]);
            return p?.abbreviation || p?.name || '';
          }).filter(Boolean);
          return lps.length > 0 ? lps.join(' ') : line.name;
        };

        let existing = JSON.parse(localStorage.getItem('comboHistory') || '[]');
        
        const processPush = (lId: number, pMap: Record<string, number>) => {
          existing = existing.filter((c: any) => !(c.lineId === lId && arePartsEqual(c.parts, pMap)));
          const snap = { id: Date.now() + Math.random(), label: makeLabel(lId, pMap), lineId: lId, parts: pMap };
          existing.unshift(snap);
        };

        // Push Player A
        processPush(lineA, partsA);
        // Push Player B (skip if identical Mirror Match)
        if (!(lineA === lineB && arePartsEqual(partsA, partsB))) {
          processPush(lineB, partsB);
        }
        
        localStorage.setItem('comboHistory', JSON.stringify(existing.slice(0, 20)));
        window.dispatchEvent(new Event('combomemory'));
      };
      saveCombosToStorage();
      // --------------------------------

      // Update App Score
      const points = { 'SPIN': 1, 'OVER': 2, 'BURST': 2, 'XTREME': 3 }[finishType] || 1;
      if (winnerIndex === 0) {
        const newScore = scoreA + points;
        setScoreA(newScore);
        localStorage.setItem('scoreA', newScore.toString());
      } else {
        const newScore = scoreB + points;
        setScoreB(newScore);
        localStorage.setItem('scoreB', newScore.toString());
      }

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
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.5rem 1rem' }}>
          <ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Hub
        </Link>
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
            <button className="undo-btn" onClick={() => alert('Undo functionality coming next!')}>Undo last battle</button>
            <button className="history-btn" onClick={() => alert('History Modal coming next!')}>Battle history</button>
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
  );
}
