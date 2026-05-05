import React, { useState, useEffect } from 'react';
import { CloudSync, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import styles from './SyncConflictModal.module.css';

interface SyncConflictModalProps {
  isOpen: boolean;
  battleCount: number;
  onSync: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  battleCount,
  onSync,
  onDelete
}) => {
  const [timer, setTimer] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let interval: number;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000) as any;
    }
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  if (!isOpen) return null;

  const handleAction = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={32} />
        </div>
        
        <h2 className={styles.title}>Dados Locais Encontrados</h2>
        
        <p className={styles.description}>
          Você possui <span className={styles.battleCount}>{battleCount}</span> batalhas gravadas 
          neste dispositivo sem estar logado. O que deseja fazer?
        </p>

        <div className={styles.actions}>
          <button 
            className={styles.syncBtn}
            onClick={() => handleAction(onSync)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <CloudSync size={20} />}
            Sincronizar com a Nuvem
          </button>

          <button 
            className={styles.deleteBtn}
            onClick={() => handleAction(onDelete)}
            disabled={timer > 0 || isProcessing}
          >
            <Trash2 size={20} />
            {timer > 0 ? (
              <span>Aguarde <span className={styles.timer}>{timer}s</span> para deletar</span>
            ) : (
              'Deletar dados locais'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
