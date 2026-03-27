import { useState, useEffect, useRef, useMemo } from 'react';
import type { Line, Part } from '../lib/api';
import { History, Star, Bookmark, Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import styles from './ComboCard.module.css';

export interface ComboSnapshot {
  id: number;
  label: string;
  lineId: number;
  parts: Record<string, number>;
}

interface Props {
  playerId: 0 | 1;
  lines: Line[];
  parts: Part[];
  selectedLineId: number | null;
  selectedParts: Record<string, number>;
  onLineChange: (lineId: number) => void;
  onPartChange: (slot: string, partId: number) => void;
}

const arePartsEqual = (p1: Record<string, number>, p2: Record<string, number>) => {
  if (!p1 || !p2) return false;
  const k1 = Object.keys(p1);
  if (k1.length !== Object.keys(p2).length) return false;
  return k1.every(k => p1[k] === p2[k]);
};

export default function ComboCard({ 
  playerId, lines, parts, selectedLineId, selectedParts, 
  onLineChange, onPartChange 
}: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<ComboSnapshot[]>([]);
  const [favorites, setFavorites] = useState<ComboSnapshot[]>([]);
  
  const [dropdownType, setDropdownType] = useState<'history' | 'favs' | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchMemory = () => {
    const savedH = localStorage.getItem('comboHistory');
    const savedF = localStorage.getItem('favCombos');
    if (savedH) setHistory(JSON.parse(savedH));
    if (savedF) setFavorites(JSON.parse(savedF));
  };

  useEffect(() => {
    fetchMemory();
    
    // Listen for cross-component storage pushes (like BattleLogger saving history)
    const handleStorage = () => fetchMemory();
    window.addEventListener('combomemory', handleStorage);

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownType(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('combomemory', handleStorage);
    };
  }, [playerId]);

  const activeLine = lines.find(l => l.id === selectedLineId);
  const slots = activeLine?.metadata?.slots || [];

  const { disabledSlots, allowedRatchetHeights } = useMemo(() => {
    const disabled = new Map<string, string>();
    let allowedHeights: string[] = [];

    slots.forEach(slot => {
      const partId = selectedParts[slot];
      if (!partId || disabled.has(slot)) return;
      
      const part = parts.find(p => p.id === partId);
      if (!part?.metadata) return;
      
      if (part.metadata.consumesSlots) {
         part.metadata.consumesSlots.forEach((s: string) => {
           if (!disabled.has(s)) disabled.set(s, slot);
         });
      }
      if (part.metadata.allowedRatchetHeights?.length > 0) {
         allowedHeights = part.metadata.allowedRatchetHeights.map(String);
      }
    });

    return { disabledSlots: disabled, allowedRatchetHeights: allowedHeights };
  }, [selectedParts, parts, slots]);

  useEffect(() => {
    // Auto-remove invalid slots instantly via native lifecycle
    Object.keys(selectedParts).forEach(slot => {
      const currentPartId = selectedParts[slot];
      if (!currentPartId) return;

      let invalid = false;
      if (disabledSlots.has(slot)) {
        invalid = true;
      } else {
        const p = parts.find(x => x.id === currentPartId);
        if (p) {
          if (p.metadata?.consumesSlots?.some((s: string) => disabledSlots.has(s) && disabledSlots.get(s) !== slot)) invalid = true;
          if (p.metadata?.consumesSlots?.includes('RATCHET') && allowedRatchetHeights.length > 0) invalid = true;
          if (slot === 'RATCHET' && allowedRatchetHeights.length > 0) {
            const nameParts = p.name.split('-');
            const height = nameParts.length > 1 ? nameParts[1] : '';
            if (!allowedRatchetHeights.some(h => height.endsWith(h))) invalid = true;
          }
        }
      }

      if (invalid) {
        onPartChange(slot, 0); // Trigger delete
      }
    });
  }, [selectedParts, disabledSlots, allowedRatchetHeights, parts, onPartChange]);

  const isCurrentFav = useMemo(() => {
    if (!selectedLineId) return false;
    return favorites.some(f => f.lineId === selectedLineId && arePartsEqual(f.parts, selectedParts));
  }, [selectedLineId, selectedParts, favorites]);

  const toggleFavorite = () => {
    if (!selectedLineId) return alert(t('fav_alert'));
    
    if (isCurrentFav) {
      const updated = favorites.filter(f => !(f.lineId === selectedLineId && arePartsEqual(f.parts, selectedParts)));
      setFavorites(updated);
      localStorage.setItem('favCombos', JSON.stringify(updated));
      window.dispatchEvent(new Event('combomemory'));
    } else {
      let label = '';
      if (activeLine?.metadata?.nameTemplate) {
        label = activeLine.metadata.nameTemplate;
        slots.forEach(s => {
          const p = parts.find(part => part.id === selectedParts[s]);
          const val = p?.abbreviation || p?.name || '';
          label = label.replace(`{${s}}`, val);
        });
        label = label.trim().replace(/\s+/g, ' ');
      } else {
        const labelParts = slots.map(s => {
          const p = parts.find(p => p.id === selectedParts[s]);
          return p?.abbreviation || p?.name || '';
        }).filter(Boolean);
        label = labelParts.length > 0 ? labelParts.join(' ') : (activeLine?.name || t('custom_combo'));
      }

      const newFaV: ComboSnapshot = {
        id: Date.now(),
        label,
        lineId: selectedLineId,
        parts: { ...selectedParts }
      };

      const updated = [newFaV, ...favorites];
      setFavorites(updated);
      localStorage.setItem('favCombos', JSON.stringify(updated));
      window.dispatchEvent(new Event('combomemory'));
    }
  };

  const handleLoad = (snap: ComboSnapshot) => {
    onLineChange(snap.lineId);
    setTimeout(() => {
      Object.entries(snap.parts).forEach(([slot, partId]) => {
        onPartChange(slot, partId as number);
      });
    }, 50);
    setDropdownType(null);
  };
  const removeListItem = (e: React.MouseEvent, id: number, type: 'history'|'favs') => {
    e.stopPropagation();
    if (type === 'history') {
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('comboHistory', JSON.stringify(updated));
      window.dispatchEvent(new Event('combomemory'));
    } else {
      const updated = favorites.filter(f => f.id !== id);
      setFavorites(updated);
      localStorage.setItem('favCombos', JSON.stringify(updated));
      window.dispatchEvent(new Event('combomemory'));
    }
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowClearModal(true);
  };

  const confirmClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('comboHistory');
    window.dispatchEvent(new Event('combomemory'));
    setShowClearModal(false);
    setDropdownType(null);
  };

  const currentList = dropdownType === 'history' ? history : favorites;
  const listName = dropdownType === 'history' ? t('load_history') : t('load_favs');

  return (
    <div className={`${styles['combo-card']} ${styles['player-' + playerId]} ${dropdownType ? styles['dropdown-open'] : ''}`}>
      <div className={styles['combo-header']}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
          <h2>{t('combo_title', { id: playerId === 0 ? 'A' : 'B' })}</h2>
          
          <div className={styles['history-container']} ref={dropdownRef} style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className={styles['fav-action-btn']} title={isCurrentFav ? t('unfav_tooltip') : t('fav_tooltip')} onClick={toggleFavorite} style={{ color: isCurrentFav ? 'var(--accent-ux)' : 'inherit' }}>
              <Star size={18} fill={isCurrentFav ? 'currentColor' : 'none'} />
            </button>
            <button className={styles['history-btn']} title={t('load_favs')} onClick={() => setDropdownType(dropdownType === 'favs' ? null : 'favs')}>
              <Bookmark size={18} />
            </button>
            <button className={styles['history-btn']} title={t('load_history')} onClick={() => setDropdownType(dropdownType === 'history' ? null : 'history')}>
              <History size={18} />
            </button>

            {dropdownType && (
              <div className={styles['history-dropdown']} style={{ display: 'flex' }}>
                <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', fontWeight: 'bold' }}>{listName}</div>
                {currentList.length === 0 ? (
                  <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>{t('no_combos')}</div>
                ) : (
                  currentList.map(snap => (
                    <div key={snap.id} className={styles['history-item']} onClick={() => handleLoad(snap)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{flex: 1}}>{snap.label}</span>
                      <button 
                        onClick={(e) => removeListItem(e, snap.id, dropdownType)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.2rem' }}
                        title={t('remove')}
                      >×</button>
                    </div>
                  ))
                )}
                {currentList.length > 0 && dropdownType === 'history' && (
                  <button className={styles['clear-history-btn']} onClick={handleClearHistory}>
                    <Trash2 size={14} />
                    {t('clear_history')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className={styles.field}>
        <label className={styles.label}>{t('line_label')}</label>
        <select 
          className={!selectedLineId ? styles['is-placeholder'] : ''}
          value={selectedLineId || ''} 
          onChange={e => onLineChange(parseInt(e.target.value))}
        >
          <option value="">{t('select_line')}</option>
          {lines.slice().sort((a, b) => a.name.localeCompare(b.name)).map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
        </select>
      </div>
      <hr className={styles['field-divider']} />
      <div className={styles['parts-container']}>
        {slots.map(slot => {
          const isSlotDisabled = disabledSlots.has(slot);
          
          const availableParts = parts.filter(p => {
            if (p.partType.name !== slot) return false;
            if (p.lineId && p.lineId !== selectedLineId) return false;
            
            if (p.metadata?.consumesSlots) {
              const conflicts = p.metadata.consumesSlots.some((s: string) => disabledSlots.has(s) && disabledSlots.get(s) !== slot);
              if (conflicts) return false;
              if (p.metadata.consumesSlots.includes('RATCHET') && allowedRatchetHeights.length > 0) return false;
            }
            
            if (slot === 'RATCHET' && allowedRatchetHeights.length > 0) {
              const nameParts = p.name.split('-');
              const height = nameParts.length > 1 ? nameParts[1] : '';
              if (!allowedRatchetHeights.some(h => height.endsWith(h))) return false;
            }
            return true;
          });

          return (
            <div key={slot} className={styles.field}>
              <label className={styles.label}>{slot.replace('_', ' ')}</label>
              <select 
                className={!selectedParts[slot] ? styles['is-placeholder'] : ''}
                value={selectedParts[slot] || ''} 
                onChange={e => onPartChange(slot, parseInt(e.target.value))}
                disabled={isSlotDisabled}
                style={{ opacity: isSlotDisabled ? 0.5 : 1 }}
              >
                <option value="">{slot.replace('_', ' ')}</option>
                {!isSlotDisabled && availableParts.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name} {p.abbreviation ? `(${p.abbreviation})` : ''}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {showClearModal && (
        <div className={styles.modal}>
          <div className={styles['modal-content']}>
            <h3>{t('clear_history_confirm_title')}</h3>
            <p>{t('clear_history_confirm_desc')}</p>
            <div className={styles['modal-actions']}>
              <button className="btn" style={{ flex: 1, background: 'var(--surface-light)' }} onClick={() => setShowClearModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={confirmClearHistory}>{t('btn_clear')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
