import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { fetchLinesRemote, fetchPartsRemote, fetchStadiumsRemote } from '../lib/api';

export function useSyncCatalog() {
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    async function sync() {
      try {
        setIsSyncing(true);
        
        // Attempt to fetch fresh catalog from the backend API
        const [lines, parts, stadiums] = await Promise.all([
          fetchLinesRemote(),
          fetchPartsRemote(),
          fetchStadiumsRemote()
        ]);

        // Upsert into IndexedDB (bulkPut replaces items with same ID, adds new ones)
        await Promise.all([
          db.lines.bulkPut(lines),
          db.parts.bulkPut(parts),
          db.stadiums.bulkPut(stadiums)
        ]);

        console.log('Catalog synced successfully with Dexie.');
      } catch (err) {
        console.warn('Network error during catalog sync. Using local offline catalog.', err);
      } finally {
        setIsSyncing(false);
      }
    }

    sync();
  }, []);

  return { isSyncing };
}
