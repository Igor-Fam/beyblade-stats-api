const API_URL = '/api';

export interface Line { id: number; name: string; metadata?: { slots: string[], nameTemplate: string } }
export interface Part { id: number; name: string; abbreviation: string; partTypeId: number; partType: { id: number, name: string }, metadata?: any, lineId?: number | null }
export interface Stadium { id: number; name: string; }

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
