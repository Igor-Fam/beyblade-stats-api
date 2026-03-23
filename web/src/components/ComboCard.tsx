import type { Line, Part } from '../lib/api';

interface Props {
  playerId: 0 | 1;
  lines: Line[];
  parts: Part[];
  selectedLineId: number | null;
  selectedParts: Record<string, number>;
  onLineChange: (lineId: number) => void;
  onPartChange: (slot: string, partId: number) => void;
  onToggleFavorite?: () => void;
  onLoadFavorite?: () => void;
  onLoadHistory?: () => void;
}

export default function ComboCard({ 
  playerId, lines, parts, selectedLineId, selectedParts, 
  onLineChange, onPartChange 
}: Props) {
  const activeLine = lines.find(l => l.id === selectedLineId);
  const slots = activeLine?.metadata?.slots || [];

  return (
    <div className={`combo-card player-${playerId}`}>
      <div className="combo-header">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <h2>Combo {playerId === 0 ? 'A' : 'B'}</h2>
        </div>
      </div>
      
      <div className="field">
        <label>Line</label>
        <select 
          value={selectedLineId || ''} 
          onChange={e => onLineChange(parseInt(e.target.value))}
        >
          <option value="">-- Select Line --</option>
          {lines.map(line => (
            <option key={line.id} value={line.id}>{line.name}</option>
          ))}
        </select>
      </div>

      <div className="parts-container">
        {slots.map(slot => {
          const availableParts = parts.filter(p => p.partType.name === slot);
          return (
            <div key={slot} className="field">
              <label>{slot.replace('_', ' ')}</label>
              <select 
                value={selectedParts[slot] || ''}
                onChange={e => onPartChange(slot, parseInt(e.target.value))}
              >
                <option value="">-- Select {slot} --</option>
                {availableParts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.abbreviation ? `(${p.abbreviation})` : ''}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
