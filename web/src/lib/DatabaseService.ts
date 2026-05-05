import { db, type LocalDatabase } from './db';

export const GUEST_DB_ID = 'guest-db';

export const DatabaseService = {
  /**
   * Ensures the guest database exists in Dexie.
   */
  async ensureGuestDatabase() {
    const guest = await db.databases.get(GUEST_DB_ID);
    if (!guest) {
      await db.databases.add({
        id: GUEST_DB_ID,
        name: 'Guest Database',
        createdAt: new Date().toISOString()
      });
    }
  },

  /**
   * Gets the count of battles in the guest database.
   */
  async getGuestBattleCount(): Promise<number> {
    return await db.battles.where('databaseId').equals(GUEST_DB_ID).count();
  },

  /**
   * Transfers all battles from guest database to a new user database.
   * Used for FREE users onboarding.
   */
  async transferGuestDataToUser(userId: string, userName: string) {
    const userDbId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Create the user's primary database
    await db.databases.add({
      id: userDbId,
      ownerId: userId,
      name: `${userName}'s Database`,
      createdAt: now
    });

    // 2. Move all guest battles to this new database
    await db.battles.where('databaseId').equals(GUEST_DB_ID).modify({
      databaseId: userDbId,
      updatedAt: now
    });

    // 3. Clear the guest database entry (optional, but keeps it clean)
    // We keep the guest-db record but it should be empty now
    return userDbId;
  },

  /**
   * Deletes all local guest data.
   * Used for PREMIUM users who choose not to sync.
   */
  async deleteGuestData() {
    await db.battles.where('databaseId').equals(GUEST_DB_ID).delete();
  },

  /**
   * Gets all databases for a specific user.
   */
  async getUserDatabases(userId: string): Promise<LocalDatabase[]> {
    return await db.databases.where('ownerId').equals(userId).toArray();
  },

  /**
   * Gets the primary database ID for a user.
   * Creates one if it doesn't exist.
   */
  async getOrCreateUserDatabase(userId: string, userName: string): Promise<string> {
    const userDbs = await this.getUserDatabases(userId);
    if (userDbs.length > 0) {
      return userDbs[0].id;
    }

    const newDbId = crypto.randomUUID();
    await db.databases.add({
      id: newDbId,
      ownerId: userId,
      name: `${userName}'s Database`,
      createdAt: new Date().toISOString()
    });
    return newDbId;
  }
};
