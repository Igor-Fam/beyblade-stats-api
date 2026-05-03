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
  id: number;
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
  // winner gets positive points, loser gets negative (e.g. +2/-2 for OVER)
  const pointValues: Record<string, number> = { SPIN: 1, OVER: 2, BURST: 2, XTREME: 3 };
  const pts = pointValues[payload.finishType] ?? 1;
  const winnerIdx: number = payload.winner;

  const newBattle: LocalBattle = {
    createdAt: new Date().toISOString(),
    stadiumId: payload.stadiumId,
    entries: payload.entries.map((e: any, idx: number) => ({
      lineId: e.lineId,
      finishType: payload.finishType,
      points: idx === winnerIdx ? pts : -pts,
      // BattleLogger uses 'partsIds'; normalize to 'partIds'
      partIds: e.partsIds ?? e.partIds ?? []
    }))
  };

  const id = await db.battles.add(newBattle);
  return { success: true, battleId: id as number };
}

export async function deleteBattle(id: number): Promise<void> {
  await db.battles.delete(id);
}

export async function fetchPartsList(filters?: BattleFilterCondition[]): Promise<PartStats[]> {
  const tz = new Date().getTimezoneOffset();
  return localStatsService.getPartsList(filters, tz);
}

export async function fetchPartDetails(id: number, filters?: BattleFilterCondition[]): Promise<PartDetails> {
  const tz = new Date().getTimezoneOffset();
  return localStatsService.getPartDetails(id, filters, tz);
}

export async function fetchBattleHistory(page = 1, limit = 50): Promise<BattleHistoryResponse> {
  const battles = await db.battles.reverse().offset((page - 1) * limit).limit(limit).toArray();
  const total = await db.battles.count();
  
  const stadiums = new Map((await db.stadiums.toArray()).map(s => [s.id, s]));
  const lines = new Map((await db.lines.toArray()).map(l => [l.id, l]));
  const parts = new Map((await db.parts.toArray()).map(p => [p.id, p]));

  const mappedBattles: BattleHistoryItem[] = battles.map(b => ({
    id: b.id!,
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

export async function fetchBattleDetails(id: number): Promise<BattleHistoryItem> {
  const b = await db.battles.get(id);
  if (!b) throw new Error('Battle not found');

  const stadiums = new Map((await db.stadiums.toArray()).map(s => [s.id, s]));
  const lines = new Map((await db.lines.toArray()).map(l => [l.id, l]));
  const parts = new Map((await db.parts.toArray()).map(p => [p.id, p]));

  return {
    id: b.id!,
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
export { type BattleFilterCondition };
