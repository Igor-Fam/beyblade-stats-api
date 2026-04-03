import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import styles from './PartLinkCard.module.css';

const TYPE_COLORS: Record<string, string> = {
  Blade: '#38bdf8',
  Ratchet: '#fb923c',
  Bit: '#4ade80',
  'Lock Chip': '#a78bfa',
  'Metal Blade': '#facc15',
  'Assist Blade': '#f472b6',
};

interface PartLinkCardProps {
  partId: number;
  name: string;
  typeName: string;
}

export function PartLinkCard({ partId, name, typeName }: PartLinkCardProps) {
  const { t } = useTranslation();
  const typeColor = TYPE_COLORS[typeName] ?? '#94a3b8';

  return (
    <Link to={`/stats/parts/${partId}`} className={styles.partItem}>
      <div className={styles.partInfo}>
        <span className={styles.partName}>{t(name as any)}</span>
        <span className={styles.partType} style={{ color: typeColor }}>
          {typeName}
        </span>
      </div>
      <ChevronRight size={16} className={styles.chevron} />
    </Link>
  );
}

export { TYPE_COLORS };
