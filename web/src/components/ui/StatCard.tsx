import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  icon: ReactNode;
  iconColor: string;
  label: string;
  children: ReactNode;
}

export function StatCard({ icon, iconColor, label, children }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ color: iconColor }}>{icon}</div>
      <div className={styles.statContent}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{children}</span>
      </div>
    </div>
  );
}

interface StatsGridProps {
  children: ReactNode;
  className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <section className={`${styles.statsGrid} ${className ?? ''}`}>
      {children}
    </section>
  );
}
