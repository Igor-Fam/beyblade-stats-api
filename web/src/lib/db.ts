import Dexie, { type EntityTable } from 'dexie';
import type { Line, Part, Stadium } from './api';

export interface LocalBattleEntry {
  lineId: number;
  finishType: string;
  points: number;
  partIds: number[];
}

export interface LocalBattle {
  id?: number;
  createdAt: string;
  stadiumId?: number;
  entries: LocalBattleEntry[];
}

// Create the local database for offline-first architecture
const db = new Dexie('BeybladeStatsDB') as Dexie & {
  battles: EntityTable<LocalBattle, 'id'>;
  parts: EntityTable<Part, 'id'>;
  lines: EntityTable<Line, 'id'>;
  stadiums: EntityTable<Stadium, 'id'>;
};

// Define tables and indices
// We only need to index fields we plan to query against (like createdAt for sorting)
db.version(1).stores({
  battles: '++id, createdAt', // ++id allows auto-increment for offline battles
  parts: 'id, name, partTypeId',
  lines: 'id, name',
  stadiums: 'id, name'
});

export { db };
