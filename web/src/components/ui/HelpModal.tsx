import { X, HelpCircle } from 'lucide-react';
import type { Dependency } from '../../lib/api';
import { useTranslation } from '../../lib/i18n';
import styles from './HelpModal.module.css';

const TYPE_COLORS: Record<string, string> = {
  Blade: '#38bdf8',
  Ratchet: '#fb923c',
  Bit: '#4ade80',
  'Lock Chip': '#a78bfa',
  'Metal Blade': '#facc15',
  'Assist Blade': '#f472b6',
};

export interface HelpModalProps {
  title: string;
  desc: string;
  dependencies?: Dependency[];
  onClose: () => void;
}

export function HelpModal({ title, desc, dependencies, onClose }: HelpModalProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <HelpCircle className={styles.modalTitleIcon} size={20} />
            <h2>{title}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.helpDesc}>{desc}</p>
          {dependencies && dependencies.length > 0 && (
            <div className={styles.dependencyList}>
              {dependencies.map(dep => (
                <div key={dep.id} className={styles.dependencyCard}>
                  <div className={styles.depHeader}>
                    <div className={styles.depTitleLeft}>
                      <span className={styles.depName}>{dep.name}</span>
                      <span className={styles.typeBadge} style={{ color: TYPE_COLORS[dep.type] ?? '#94a3b8' }}>{dep.type}</span>
                    </div>
                    <span className={styles.depHeaderRight}>{t('col_scoring_rate')}</span>
                  </div>
                  <div className={styles.depStats}>
                    <div className={styles.depStatRow}>
                      <span className={styles.depStatLabel}>{t('dep_with', { part: dep.name })}</span>
                      <span className={styles.depStatValueGood}>{dep.scoringRateWith}%</span>
                    </div>
                    <div className={styles.depStatRow}>
                      <span className={styles.depStatLabel}>{t('dep_without', { part: dep.name })}</span>
                      <span className={styles.depStatValueBad}>{dep.scoringRateWithout}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
