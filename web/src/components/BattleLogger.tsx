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
  const [winnerIndex, setWinnerIndex] = useState<number>(0);
  const [finishType, setFinishType] = useState<string>('SPIN');
  
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
    if (player === 0) setPartsA(prev => ({ ...prev, [slot]: partId }));
    else setPartsB(prev => ({ ...prev, [slot]: partId }));
  };

  const handleReset = () => {
    setScoreA(0); setScoreB(0);
    localStorage.setItem('scoreA', '0');
    localStorage.setItem('scoreB', '0');
    setShowResetModal(false);
  };

  const submitBattle = async () => {
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

      // Update Session Score
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

      setStatus({ msg: 'Battle registered successfully!', type: 'success' });
      setTimeout(() => setStatus(null), 4000);
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

      <div className="scoreboard">
        <div className="score-player p0">
          <span className="score-value">{scoreA}</span>
        </div>
        <div className="score-divider">-</div>
        <div className="score-player p1">
          <span className="score-value">{scoreB}</span>
        </div>
        <button className="reset-score-btn" title="Reset Score" onClick={() => setShowResetModal(true)}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="battle-setup">
        <ComboCard playerId={0} lines={lines} parts={parts} selectedLineId={lineA} selectedParts={partsA} onLineChange={setLineA} onPartChange={(slot, id) => handlePartChange(0, slot, id)} />
        <ComboCard playerId={1} lines={lines} parts={parts} selectedLineId={lineB} selectedParts={partsB} onLineChange={setLineB} onPartChange={(slot, id) => handlePartChange(1, slot, id)} />
      </div>

      <div className="result-section">
        <h2>Match Details</h2>
        
        <label>Stadium</label>
        <div className="field" style={{ marginBottom: '1.5rem' }}>
          <select value={stadiumId || ''} onChange={e => setStadiumId(parseInt(e.target.value))}>
            <option value="">-- Select Stadium --</option>
            {stadiums.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <label>Who won?</label>
        <div className="winner-toggle">
          <button className={`winner-btn p0 ${winnerIndex === 0 ? 'active' : ''}`} onClick={() => setWinnerIndex(0)}>Combo A</button>
          <button className={`winner-btn p1 ${winnerIndex === 1 ? 'active' : ''}`} onClick={() => setWinnerIndex(1)}>Combo B</button>
        </div>

        <label style={{ marginTop: '1.5rem', display: 'block' }}>Finish Type</label>
        <div className="finish-types">
          {['SPIN', 'OVER', 'BURST', 'XTREME'].map(type => (
            <button key={type} className={`finish-btn ${finishType === type ? 'active' : ''} ${finishType === type ? type.toLowerCase() : ''}`} onClick={() => setFinishType(type)}>
              {type}
            </button>
          ))}
        </div>

        <button className="btn btn-primary" onClick={submitBattle} disabled={loading}>
          {loading ? 'Saving...' : 'Register Battle'}
        </button>
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
