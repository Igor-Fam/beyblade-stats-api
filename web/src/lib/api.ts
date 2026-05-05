import { db, type LocalBattle } from './db';
import { LocalStatsService, type BattleFilterCondition } from '../services/LocalStatsService';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const localStatsService = new LocalStatsService();

export interface Line { id: number; name: string; metadata?: { slots: string[], nameTemplate: string } }
export interface Part { id: number; name: string; abbreviation: string; partTypeId: number; partType: { id: number, name: string }, metadata?: any, lineId?: number | null }
export interface Stadium { id: number; name: string; }

export interface PartStats {
  id: number;
  name: string;
  type: string;
  bp: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: string;
  avgPoints: number;
  scoringRate: number;
  pointsGained: number;
  pointsConceded: number;
  isDependent: boolean;
  isInaccurate?: boolean;
  dependencies?: Dependency[];
}

export interface Dependency {
  id: number;
  name: string;
  type: string;
  pointsGained?: number;
  share?: number;
  scoringRateWith: number;
  scoringRateWithout: number;
}

export interface PartDetails extends PartStats {
  totalGained: number;
  totalConceded: number;
  bestPartners: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
  bestCounters: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
  winFinishes: Record<string, number>;
  lossFinishes: Record<string, number>;
  dependencies: Dependency[];
}

export interface BattleEntryPart {
  partId: number;
  part: { name: string; partType: { name: string } };
}

export interface BattleEntry {
  id: number;
  points: number;
  finishType: string;
  line: { name: string; metadata?: { slots: string[] } };
  parts: BattleEntryPart[];
}

export interface BattleHistoryItem {
  id: string; // UUID
  createdAt: string;
  stadium: { name: string };
  entries: BattleEntry[];
}

export interface BattleHistoryResponse {
  total: number;
  page: number;
  limit: number;
  battles: BattleHistoryItem[];
}

// ==========================================
// REMOTE ENDPOINTS (For useSyncCatalog)
// ==========================================
export async function fetchLinesRemote(): Promise<Line[]> {
  const res = await fetch(`${API_URL}/lines`);
  return res.json();
}
export async function fetchPartsRemote(): Promise<Part[]> {
  const res = await fetch(`${API_URL}/parts`);
  return res.json();
}
export async function fetchStadiumsRemote(): Promise<Stadium[]> {
  const res = await fetch(`${API_URL}/stadiums`);
  return res.json();
}

export async function fetchDatabaseHealth(): Promise<{ status: string, env: 'production' | 'sandbox' }> {
  // In a local-first model, health is essentially always OK if the browser works
  return { status: 'ok', env: 'production' };
}

// ==========================================
// LOCAL ENDPOINTS (Replaces standard fetch calls)
// ==========================================
export async function fetchLines(): Promise<Line[]> {
  return db.lines.toArray();
}
export async function fetchParts(): Promise<Part[]> {
  return db.parts.toArray();
}
export async function fetchStadiums(): Promise<Stadium[]> {
  return db.stadiums.toArray();
}

export async function registerBattle(payload: any) {
  // Replicate the backend's Zero-Sum scoring:
  const pointValues: Record<string, number> = { SPIN: 1, OVER: 2, BURST: 2, XTREME: 3 };
  const pts = pointValues[payload.finishType] ?? 1;
  const winnerIdx: number = payload.winner;
  const now = new Date().toISOString();

  const newBattle: LocalBattle = {
    id: crypto.randomUUID(),
    databaseId: payload.databaseId, // Must be provided by the caller
    createdAt: now,
    updatedAt: now,
    stadiumId: payload.stadiumId,
    entries: payload.entries.map((e: any, idx: number) => ({
      lineId: e.lineId,
      finishType: payload.finishType,
      points: idx === winnerIdx ? pts : -pts,
      partIds: e.partsIds ?? e.partIds ?? []
    }))
  };

  await db.battles.add(newBattle);
  return { success: true, battleId: newBattle.id };
}

export async function deleteBattle(id: string): Promise<void> {
  await db.battles.delete(id);
}

export async function fetchPartsList(databaseId: string, filters?: BattleFilterCondition[]): Promise<PartStats[]> {
  const tz = new Date().getTimezoneOffset();
  return localStatsService.getPartsList(databaseId, filters, tz);
}

export async function fetchPartDetails(databaseId: string, id: number, filters?: BattleFilterCondition[]): Promise<PartDetails> {
  const tz = new Date().getTimezoneOffset();
  return localStatsService.getPartDetails(databaseId, id, filters, tz);
}

export async function fetchBattleHistory(databaseId: string, page = 1, limit = 50): Promise<BattleHistoryResponse> {
  const battles = await db.battles
    .where('databaseId')
    .equals(databaseId)
    .reverse()
    .offset((page - 1) * limit)
    .limit(limit)
    .toArray();
  const total = await db.battles.where('databaseId').equals(databaseId).count();
  
  const stadiums = new Map((await db.stadiums.toArray()).map(s => [s.id, s]));
  const lines = new Map((await db.lines.toArray()).map(l => [l.id, l]));
  const parts = new Map((await db.parts.toArray()).map(p => [p.id, p]));

  const mappedBattles: BattleHistoryItem[] = battles.map(b => ({
    id: b.id,
    createdAt: b.createdAt,
    stadium: { name: b.stadiumId ? (stadiums.get(b.stadiumId)?.name || 'Unknown') : 'Unknown' },
    entries: b.entries.map((e, idx) => ({
      id: idx,
      points: e.points,
      finishType: e.finishType,
      line: { name: lines.get(e.lineId)?.name || 'Unknown', metadata: lines.get(e.lineId)?.metadata },
      parts: e.partIds.map(pid => ({
        partId: pid,
        part: {
          name: parts.get(pid)?.name || 'Unknown',
          partType: { name: parts.get(pid)?.partType?.name || 'Unknown' }
        }
      }))
    }))
  }));

  return { total, page, limit, battles: mappedBattles };
}

export async function fetchBattleDetails(databaseId: string, id: string): Promise<BattleHistoryItem> {
  const b = await db.battles.where({ id, databaseId }).first();
  if (!b) throw new Error('Battle not found');

  const stadiums = new Map((await db.stadiums.toArray()).map(s => [s.id, s]));
  const lines = new Map((await db.lines.toArray()).map(l => [l.id, l]));
  const parts = new Map((await db.parts.toArray()).map(p => [p.id, p]));

  return {
    id: b.id,
    createdAt: b.createdAt,
    stadium: { name: b.stadiumId ? (stadiums.get(b.stadiumId)?.name || 'Unknown') : 'Unknown' },
    entries: b.entries.map((e, idx) => ({
      id: idx,
      points: e.points,
      finishType: e.finishType,
      line: { name: lines.get(e.lineId)?.name || 'Unknown', metadata: lines.get(e.lineId)?.metadata },
      parts: e.partIds.map(pid => ({
        partId: pid,
        part: {
          name: parts.get(pid)?.name || 'Unknown',
          partType: { name: parts.get(pid)?.partType?.name || 'Unknown' }
        }
      }))
    }))
  };
}

// ==========================================
// CLOUD SYNC ENDPOINTS (Premium)
// ==========================================

/**
 * Pushes local battles to the cloud for premium users.
 */
export async function syncBattlesCloud(battles: LocalBattle[], token: string): Promise<{ synced: number }> {
  const res = await fetch(`${API_URL}/battles/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ battles })
  });

  if (!res.ok) throw new Error('Cloud sync failed.');
  return res.json();
}

/**
 * Fetches cloud battles for the current user.
 */
export async function restoreBattlesCloud(token: string): Promise<{ battles: LocalBattle[] }> {
  const res = await fetch(`${API_URL}/battles/restore`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    const error: any = new Error('Cloud restore failed.');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export { type BattleFilterCondition };
