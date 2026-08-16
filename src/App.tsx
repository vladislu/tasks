import {useMemo} from 'react';

import {KanbanManager} from './components/KanbanManager';
import {createStorageAdapter, useKanbanStore} from './storage';
import type {SyncStatus} from './storage/types';
import styles from './components/styles.module.scss';

export default function App() {
  // One adapter per session; the hook reloads whenever this identity changes.
  const adapter = useMemo(() => createStorageAdapter(), []);
  const {store, updateStore, loading, loadError, saveState, saveError, retrySave} =
    useKanbanStore(adapter);

  if (loading || !store) {
    return <p className={styles.appLoading}>Loading boards…</p>;
  }

  const sync: SyncStatus = {
    label: adapter.label,
    isLocal: adapter.isLocal,
    state: saveState,
    error: saveError,
    retry: retrySave,
  };

  return (
    <KanbanManager
      store={store}
      updateStore={updateStore}
      sync={sync}
      loadError={loadError}
    />
  );
}
