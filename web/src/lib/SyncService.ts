import { db, type LocalBattle } from './db';
import { syncBattlesCloud, restoreBattlesCloud } from './api';

export const SyncService = {
  /**
   * Synchronizes a local database with the cloud using Last Write Wins (LWW).
   */
  async syncDatabase(databaseId: string, token: string) {
    // 1. Fetch remote state
    // Note: In a real multi-db scenario, the API would filter by databaseId.
    // For now, restoreBattlesCloud returns all user battles.
    const { battles: remoteBattles } = await restoreBattlesCloud(token);
    
    // 2. Fetch local state
    const localBattles = await db.battles.where('databaseId').equals(databaseId).toArray();
    
    const localMap = new Map(localBattles.map(b => [b.id, b]));
    const remoteMap = new Map(remoteBattles.map(b => [b.id, b]));

    const toUpload: LocalBattle[] = [];
    const toUpdateLocal: LocalBattle[] = [];

    // Check local battles against remote
    for (const local of localBattles) {
      const remote = remoteMap.get(local.id);
      
      if (!remote) {
        // Local only: needs upload
        toUpload.push(local);
      } else {
        // Conflict check: LWW
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();
        
        if (localTime > remoteTime) {
          toUpload.push(local);
        } else if (remoteTime > localTime) {
          toUpdateLocal.push(remote);
        }
      }
    }

    // Check for remote battles that don't exist locally
    for (const remote of remoteBattles) {
      if (!localMap.has(remote.id)) {
        toUpdateLocal.push(remote);
      }
    }

    // 3. Execute updates
    if (toUpdateLocal.length > 0) {
      await db.battles.bulkPut(toUpdateLocal);
    }

    if (toUpload.length > 0) {
      await syncBattlesCloud(toUpload, token);
    }

    return {
      uploaded: toUpload.length,
      downloaded: toUpdateLocal.length
    };
  }
};
