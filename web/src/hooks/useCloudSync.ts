import { db } from '../lib/db';
import { syncBattlesCloud, restoreBattlesCloud } from '../lib/api';
import type { LocalBattle } from '../lib/db';

/**
 * Sends all local IndexedDB battles to the cloud sync endpoint.
 * Only called for premium users. Idempotent — the backend deduplicates by createdAt.
 */
export async function syncToCloud(token: string): Promise<{ synced: number }> {
    const battles = await db.battles.toArray();
    if (battles.length === 0) return { synced: 0 };

    const payload: LocalBattle[] = battles.map(b => ({
        createdAt: b.createdAt,
        stadiumId: b.stadiumId,
        entries: b.entries
    }));

    return syncBattlesCloud(payload, token);
}

/**
 * Downloads all cloud battles for the current user and merges them into IndexedDB.
 * Deduplicates by createdAt to avoid storing the same battle twice.
 */
export async function restoreFromCloud(token: string): Promise<{ restored: number }> {
    const { battles } = await restoreBattlesCloud(token);
    if (battles.length === 0) return { restored: 0 };

    // Fetch existing createdAt timestamps to avoid duplicates
    const existing = await db.battles.toArray();
    const existingTimestamps = new Set(existing.map(b => b.createdAt));

    const newBattles = battles.filter(b => !existingTimestamps.has(b.createdAt));
    if (newBattles.length > 0) {
        await db.battles.bulkAdd(newBattles);
    }

    return { restored: newBattles.length };
}
