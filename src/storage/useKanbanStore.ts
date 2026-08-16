import {useCallback, useEffect, useRef, useState} from 'react';

import {KANBAN_SEED} from '../kanban/data';
import {clone, normalizeStore} from '../kanban/store';
import type {KanbanStore} from '../kanban/types';
import type {SaveState, StorageAdapter} from './types';

/** Edits arrive in bursts (typing, dragging), so writes are coalesced. */
const SAVE_DEBOUNCE_MS = 400;

export interface KanbanStoreController {
  store: KanbanStore | null;
  /** Applies an update in memory and schedules a save. */
  updateStore: (updater: (current: KanbanStore) => KanbanStore) => void;
  loading: boolean;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  retrySave: () => void;
}

/**
 * Owns persistence for the whole app: loads once, then writes through the
 * adapter in the background. The in-memory board is always authoritative, so a
 * backend that is slow or down degrades to "unsaved changes" instead of losing
 * edits.
 */
export function useKanbanStore(adapter: StorageAdapter): KanbanStoreController {
  const [store, setStore] = useState<KanbanStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs mirror state so updates stay pure and can be batched safely.
  const storeRef = useRef<KanbanStore | null>(null);
  const pendingRef = useRef<KanbanStore | null>(null);
  const savingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const next = pendingRef.current;
    if (!next) return;

    savingRef.current = true;
    setSaveState('saving');
    let failed = false;
    try {
      await adapter.save(next);
      // Only clear it when no newer edit landed while the save was running.
      if (pendingRef.current === next) pendingRef.current = null;
      setSaveError(null);
      setSaveState('saved');
    } catch (error) {
      // The payload stays pending so retrySave can pick it up.
      failed = true;
      setSaveError((error as Error).message);
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }

    if (!failed && pendingRef.current) void flush();
  }, [adapter]);

  const schedule = useCallback(
    (next: KanbanStore) => {
      pendingRef.current = next;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const updateStore = useCallback(
    (updater: (current: KanbanStore) => KanbanStore) => {
      const current = storeRef.current;
      if (!current) return;
      const next = updater(current);
      storeRef.current = next;
      setStore(next);
      schedule(next);
    },
    [schedule],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let loaded: KanbanStore | null = null;
      let message: string | null = null;
      try {
        loaded = await adapter.load();
      } catch (error) {
        message = (error as Error).message;
      }
      if (cancelled) return;

      const initial = normalizeStore(loaded ?? clone(KANBAN_SEED));
      storeRef.current = initial;
      setStore(initial);
      setLoadError(message);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  // A tab can be closed inside the debounce window; take one last chance to write.
  useEffect(() => {
    const onHide = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [flush]);

  const retrySave = useCallback(() => {
    if (!pendingRef.current) pendingRef.current = storeRef.current;
    void flush();
  }, [flush]);

  return {
    store,
    updateStore,
    loading,
    loadError,
    saveState,
    saveError,
    retrySave,
  };
}
