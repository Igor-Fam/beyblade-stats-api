const API_URL = '/api';

export interface Line { id: number; name: string; metadata?: { slots: string[], nameTemplate: string } }
export interface Part { id: number; name: string; abbreviation: string; partTypeId: number; partType: { id: number, name: string }, metadata?: any, lineId?: number | null }
export interface Stadium { id: number; name: string; }
export interface PartStats {
  id: number;
  name: string;
  type: string;
  elo: number;
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

export async function fetchLines(): Promise<Line[]> {
  const res = await fetch(`${API_URL}/lines`);
  return res.json();
}
export async function fetchParts(): Promise<Part[]> {
  const res = await fetch(`${API_URL}/parts`);
  return res.json();
}
export async function fetchStadiums(): Promise<Stadium[]> {
  const res = await fetch(`${API_URL}/stadiums`);
  return res.json();
}
export async function registerBattle(payload: any) {
  const res = await fetch(`${API_URL}/battles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to register battle');
  return res.json();
}

export async function fetchDatabaseHealth(): Promise<{ status: string, env: 'production' | 'sandbox' }> {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
}

export async function deleteBattle(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/battles/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete battle');
}
export interface BattleFilterCondition {
  field: 'stadium' | 'date' | 'finishType';
  operator: 'eq' | 'gt' | 'lt';
  value: string | number;
}

export async function fetchPartsList(filters?: BattleFilterCondition[]): Promise<PartStats[]> {
  const tz = new Date().getTimezoneOffset();
  const queryParts = [];
  if (filters?.length) queryParts.push(`filters=${encodeURIComponent(JSON.stringify(filters))}`);
  queryParts.push(`tz=${tz}`);
  
  const res = await fetch(`${API_URL}/stats/parts?${queryParts.join('&')}`);
  if (!res.ok) throw new Error('Failed to fetch parts stats');
  return res.json();
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

export async function fetchPartDetails(id: number, filters?: BattleFilterCondition[]): Promise<PartDetails> {
  const tz = new Date().getTimezoneOffset();
  const queryParts = [];
  if (filters?.length) queryParts.push(`filters=${encodeURIComponent(JSON.stringify(filters))}`);
  queryParts.push(`tz=${tz}`);

  const res = await fetch(`${API_URL}/stats/parts/${id}?${queryParts.join('&')}`);
  if (!res.ok) throw new Error('Failed to fetch part details');
  return res.json();
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

export async function fetchBattleHistory(page = 1, limit = 50): Promise<BattleHistoryResponse> {
  const res = await fetch(`${API_URL}/battles?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch battle history');
  return res.json();
}

export async function fetchBattleDetails(id: number): Promise<BattleHistoryItem> {
  const res = await fetch(`${API_URL}/battles/${id}`);
  if (!res.ok) throw new Error('Failed to fetch battle details');
  return res.json();
}


