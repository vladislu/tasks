import {LocalStorageAdapter} from './localStorageAdapter';
import {RestAdapter} from './restAdapter';
import type {StorageAdapter} from './types';

export {LocalStorageAdapter} from './localStorageAdapter';
export {RestAdapter} from './restAdapter';
export type {StorageAdapter, SaveState} from './types';
export {useKanbanStore} from './useKanbanStore';

/**
 * Picks the backend from build-time configuration: a REST API when
 * VITE_API_BASE_URL is set, otherwise this browser's localStorage.
 */
export function createStorageAdapter(): StorageAdapter {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return new LocalStorageAdapter();

  return new RestAdapter({
    baseUrl,
    token: import.meta.env.VITE_API_TOKEN?.trim() || undefined,
  });
}
