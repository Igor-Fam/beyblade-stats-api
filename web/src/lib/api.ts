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
export async function fetchPartsList(): Promise<PartStats[]> {
  const res = await fetch(`${API_URL}/stats/parts`);
  if (!res.ok) throw new Error('Failed to fetch parts stats');
  return res.json();
}

export interface PartDetails extends PartStats {
  bestPartners: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
  bestCounters: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
  winFinishes: Record<string, number>;
  lossFinishes: Record<string, number>;
}

export async function fetchPartDetails(id: number): Promise<PartDetails> {
  const res = await fetch(`${API_URL}/stats/parts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch part details');
  return res.json();
}
