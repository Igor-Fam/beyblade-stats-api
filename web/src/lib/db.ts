import Dexie, { type EntityTable } from 'dexie';
import type { Line, Part, Stadium } from './api';

export interface LocalDatabase {
  id: string; // UUID
  ownerId?: string; // null for anonymous
  name: string;
  createdAt: string;
}

export interface LocalBattleEntry {
  lineId: number;
  finishType: string;
  points: number;
  partIds: number[];
}

export interface LocalBattle {
  id: string; // UUID
  databaseId: string;
  createdAt: string;
  updatedAt: string;
  stadiumId?: number;
  entries: LocalBattleEntry[];
}

// Create the local database for offline-first architecture
const db = new Dexie('BeybladeStatsDB') as Dexie & {
  battles: EntityTable<LocalBattle, 'id'>;
  databases: EntityTable<LocalDatabase, 'id'>;
  parts: EntityTable<Part, 'id'>;
  lines: EntityTable<Line, 'id'>;
  stadiums: EntityTable<Stadium, 'id'>;
};

// Define tables and indices
db.version(1).stores({
  battles: '++id, createdAt',
  parts: 'id, name, partTypeId',
  lines: 'id, name',
  stadiums: 'id, name'
});

db.version(2).stores({
  battles: 'id, databaseId, createdAt, updatedAt',
  databases: 'id, ownerId',
  parts: 'id, name, partTypeId',
  lines: 'id, name',
  stadiums: 'id, name'
}).upgrade(async (tx) => {
  // 1. Create a default Guest Database if it doesn't exist
  const guestDbId = 'guest-db';
  const now = new Date().toISOString();
  
  await tx.table('databases').add({
    id: guestDbId,
    name: 'Guest Database',
    createdAt: now
  });

  // 2. Migrate existing battles to Version 2
  return tx.table('battles').toCollection().modify(battle => {
    // If it's an old battle (numeric ID), convert it
    if (typeof battle.id === 'number') {
      battle.id = crypto.randomUUID();
    }
    // Ensure databaseId is set
    if (!battle.databaseId) {
      battle.databaseId = guestDbId;
    }
    // Add updatedAt if missing
    if (!battle.updatedAt) {
      battle.updatedAt = battle.createdAt || now;
    }
  });
});

export { db };
