interface Progress {
  type: 'movie' | 'series';
  id: string;
  position: number;
  duration: number;
  timestamp: number;
}

export class Database {
  private readonly STORAGE_KEY = 'tabarek_iptv_progress';
  private readonly MAX_ENTRIES = 100;
  
  constructor() {
    // Initialize storage and prune old entries on startup
    this.pruneOldEntries().catch(error => 
      console.error('Failed to prune old entries:', error)
    );
  }

  private async getAll(): Promise<Progress[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];

      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.error('Invalid storage data format');
        return [];
      }

      return parsed;
    } catch (error) {
      console.error('Failed to read from storage:', error);
      return [];
    }
  }

  private async saveAll(data: Progress[]): Promise<void> {
    try {
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format');
      }

      // Keep only the latest MAX_ENTRIES
      const trimmed = data.slice(-this.MAX_ENTRIES);
      
      // Validate data before saving
      const validated = trimmed.filter(item => 
        item && 
        typeof item.id === 'string' &&
        typeof item.position === 'number' &&
        typeof item.duration === 'number' &&
        typeof item.timestamp === 'number' &&
        (item.type === 'movie' || item.type === 'series')
      );

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated));
    } catch (error) {
      console.error('Failed to write to storage:', error);
      throw error; // Re-throw to allow error handling by caller
    }
  }

  async saveProgress(type: 'movie' | 'series', id: string, position: number, duration: number): Promise<void> {
    if (typeof position !== 'number' || typeof duration !== 'number') {
      throw new Error('Invalid position or duration');
    }

    const data = await this.getAll();
    
    // Remove existing entry if exists
    const index = data.findIndex(item => item.type === type && item.id === id);
    if (index !== -1) {
      data.splice(index, 1);
    }

    // Add new entry
    data.push({
      type,
      id,
      position: Math.max(0, position),
      duration: Math.max(0, duration),
      timestamp: Date.now()
    });

    await this.saveAll(data);
  }

  async getProgress(type: 'movie' | 'series', id: string): Promise<number> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID');
      }

      const data = await this.getAll();
      const entry = data.find(item => item.type === type && item.id === id);
      return entry ? Math.max(0, entry.position) : 0;
    } catch (error) {
      console.error('Failed to get progress:', error);
      return 0;
    }
  }

  async clearProgress(type: 'movie' | 'series', id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID');
      }

      const data = await this.getAll();
      const filtered = data.filter(item => !(item.type === type && item.id === id));
      await this.saveAll(filtered);
    } catch (error) {
      console.error('Failed to clear progress:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  async pruneOldEntries(maxAgeDays: number = 30): Promise<void> {
    try {
      if (typeof maxAgeDays !== 'number' || maxAgeDays <= 0) {
        throw new Error('Invalid maxAgeDays value');
      }

      const data = await this.getAll();
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      
      const filtered = data.filter(item => {
        const age = now - item.timestamp;
        return age <= maxAge && age >= 0; // Ensure timestamp is valid
      });

      await this.saveAll(filtered);
    } catch (error) {
      console.error('Failed to prune entries:', error);
      throw error;
    }
  }
}