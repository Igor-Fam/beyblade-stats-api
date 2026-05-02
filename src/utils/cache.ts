export class AppCache {
    private static cache = new Map<string, { timestamp: number, data: any }>();
    private static TTL = 10 * 60 * 1000; // 10 minutes

    static get(key: string): any | null {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.TTL) {
            return item.data;
        }
        return null;
    }

    static set(key: string, data: any): void {
        this.cache.set(key, { timestamp: Date.now(), data });
    }

    static clear(): void {
        this.cache.clear();
    }
}
