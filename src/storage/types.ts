import type {KanbanStore} from '../kanban/types';

/**
 * The only contract the UI knows about. Every backend — localStorage today, a
 * REST API in front of a database later — implements these two calls, so
 * swapping persistence never touches component code.
 *
 * Implementations may throw; callers surface the message and keep the in-memory
 * board usable so a failing backend never loses the user's work.
 */
export interface StorageAdapter {
  /** Short human label, shown in the UI so it is obvious where data lives. */
  readonly label: string;

  /** True when data is only on this device and worth exporting. */
  readonly isLocal: boolean;

  /** Resolves to null when the backend holds nothing yet (first run). */
  load(): Promise<KanbanStore | null>;

  save(store: KanbanStore): Promise<void>;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** What the UI needs to tell the user where data goes and whether it got there. */
export interface SyncStatus {
  label: string;
  isLocal: boolean;
  state: SaveState;
  error: string | null;
  retry: () => void;
}
