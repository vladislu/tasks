import type {KanbanStore} from '../kanban/types';
import type {StorageAdapter} from './types';

export const LOCAL_STORAGE_KEY = 'tasks-kanban-store';

/**
 * Default backend: no server, no account, works offline and on GitHub Pages.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly label = 'this browser';
  readonly isLocal = true;

  constructor(private readonly key: string = LOCAL_STORAGE_KEY) {}

  async load(): Promise<KanbanStore | null> {
    const raw = window.localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as KanbanStore;
    } catch {
      // Corrupt payloads are kept aside instead of thrown away, so a bad write
      // never silently destroys someone's boards.
      window.localStorage.setItem(`${this.key}-corrupt-backup`, raw);
      throw new Error(
        'Saved boards could not be read and were moved to a backup key. Starting from the sample board.',
      );
    }
  }

  async save(store: KanbanStore): Promise<void> {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(store));
    } catch (error) {
      throw new Error(
        `Could not save to this browser (${(error as Error).name}). Storage may be full or blocked.`,
      );
    }
  }
}
