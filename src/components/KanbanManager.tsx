import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';

import {KANBAN_SEED} from '../kanban/data';
import {
  boardToMermaid,
  createListId,
  createTicketNodeId,
  parseMermaidKanban,
} from '../kanban/mermaid';
import type {ParsedKanban} from '../kanban/mermaid';
import {
  bumpTicketCounter,
  clone,
  countTickets,
  createEmptyBoard,
  duplicateBoard,
  duplicateTicketRefs,
  findTicket,
  moveTicket,
  nextTicketRef,
  normalizeBoard,
  normalizeStore,
  nowIso,
  sanitizeTicketPrefix,
  ticketHaystack,
} from '../kanban/store';
import type {
  KanbanBoard,
  KanbanStore,
  KanbanTheme,
  Ticket,
} from '../kanban/types';
import {
  THEMES,
  VIEWS,
  readTheme,
  readView,
  writeTheme,
  writeView,
} from '../preferences';
import type {SyncStatus} from '../storage/types';
import {BoardView} from './board';
import type {BoardActions} from './board';
import {MermaidDiagram} from './MermaidDiagram';
import {BoardModal, ListModal, TicketModal} from './modals';
import type {BoardDraft, ListDraft, TicketDraft} from './modals';
import {
  IconCopy,
  IconDownload,
  IconLayers,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from './icons';
import styles from './styles.module.scss';

/* ============================================================================
 * Helpers
 * ========================================================================== */

function fallbackCopy(text: string) {
  if (typeof document === 'undefined') return;
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    /* ignore */
  }
  area.remove();
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function downloadFile(content: string, filename: string, type: string) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'board'
  );
}

/**
 * Mermaid carries titles, ticket ids, assignees, priorities and metadata, but
 * not descriptions or WIP limits — those are re-attached from the current board
 * by node id so editing the source doesn't silently drop them.
 */
function mergeParsedIntoBoard(
  board: KanbanBoard,
  parsed: ParsedKanban,
): KanbanBoard {
  const previousTickets = new Map<string, Ticket>();
  for (const list of board.lists) {
    for (const ticket of list.tickets) previousTickets.set(ticket.id, ticket);
  }
  const previousLists = new Map(board.lists.map((list) => [list.id, list]));

  return {
    ...board,
    ticketBaseUrl: parsed.ticketBaseUrl ?? board.ticketBaseUrl,
    lists: parsed.lists.map((list) => ({
      ...list,
      wipLimit: previousLists.get(list.id)?.wipLimit,
      tickets: list.tickets.map((ticket) => {
        const previous = previousTickets.get(ticket.id);
        return previous
          ? {
              ...ticket,
              description: previous.description,
              createdAt: previous.createdAt,
            }
          : ticket;
      }),
    })),
  };
}

function ticketFromDraft(draft: TicketDraft, base?: Ticket): Ticket {
  const timestamp = nowIso();
  return {
    id: base?.id ?? createTicketNodeId(),
    title: draft.title,
    ticketId: draft.ticketId || undefined,
    assigned: draft.assigned || undefined,
    priority: draft.priority || undefined,
    description: draft.description || undefined,
    metadata: draft.metadata,
    createdAt: base?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

/* ============================================================================
 * Toasts
 * ========================================================================== */

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, {id, message, type, visible: false}]);
    requestAnimationFrame(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? {...t, visible: true} : t)),
      );
    });
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? {...t, visible: false} : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 2800);
  }, []);

  return {toasts, showToast};
}

/* ============================================================================
 * Sync indicator
 * ========================================================================== */

const SYNC_CLASS = {
  idle: styles.syncIdle,
  saving: styles.syncSaving,
  saved: styles.syncSaved,
  error: styles.syncError,
} as const;

/** Makes the storage backend and the fate of the last write visible. */
function SyncBadge({sync}: {sync: SyncStatus}) {
  const text =
    sync.state === 'saving'
      ? 'Saving…'
      : sync.state === 'saved'
        ? `Saved to ${sync.label}`
        : sync.state === 'error'
          ? 'Not saved'
          : `Stored in ${sync.label}`;

  return (
    <div
      className={clsx(styles.syncBadge, SYNC_CLASS[sync.state])}
      title={sync.error ?? undefined}
      role="status">
      <span className={styles.syncDot} aria-hidden />
      {text}
      {sync.state === 'error' && (
        <button type="button" className={styles.syncRetry} onClick={sync.retry}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * Panels
 * ========================================================================== */

function DiagramPanel({
  source,
  dark,
  onCopy,
  onDownload,
}: {
  source: string;
  dark: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Mermaid diagram</h2>
        <div className={styles.panelActions}>
          <button type="button" className={styles.btnAction} onClick={onCopy}>
            <IconCopy size={12} /> Copy source
          </button>
          <button
            type="button"
            className={styles.btnAction}
            onClick={onDownload}>
            <IconDownload size={12} /> Download .mmd
          </button>
        </div>
      </div>
      <div className={styles.diagramFrame}>
        {/* Remounting per source keeps a parse error from sticking around. */}
        <MermaidDiagram key={source} source={source} dark={dark} />
      </div>
    </div>
  );
}

function SourcePanel({
  value,
  dirty,
  warnings,
  onChange,
  onApply,
  onRevert,
  onCopy,
  onDownload,
}: {
  value: string;
  dirty: boolean;
  warnings: string[];
  onChange: (next: string) => void;
  onApply: () => void;
  onRevert: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Mermaid source
          {dirty && <span className={styles.dirtyBadge}>edited</span>}
        </h2>
        <div className={styles.panelActions}>
          <button
            type="button"
            className={clsx(styles.btnAction, styles.btnPrimaryAction)}
            onClick={onApply}>
            Apply to board
          </button>
          <button
            type="button"
            className={styles.btnAction}
            onClick={onRevert}
            disabled={!dirty}>
            Revert
          </button>
          <button type="button" className={styles.btnAction} onClick={onCopy}>
            <IconCopy size={12} /> Copy
          </button>
          <button
            type="button"
            className={styles.btnAction}
            onClick={onDownload}>
            <IconDownload size={12} /> Download .mmd
          </button>
        </div>
      </div>

      <textarea
        className={styles.sourceEditor}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Mermaid kanban source"
      />

      {warnings.length > 0 && (
        <ul className={styles.warnings}>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <p className={styles.panelHint}>
        Paste any Mermaid <code>kanban</code> diagram here and apply it to
        replace the lists on this board. Descriptions and WIP limits are not part
        of Mermaid; they are kept for tickets whose node id is unchanged.
      </p>
    </div>
  );
}

/* ============================================================================
 * Modal state
 * ========================================================================== */

type ModalState =
  | {kind: 'board-create'}
  | {kind: 'board-edit'}
  | {kind: 'list-create'}
  | {kind: 'list-edit'; listId: string}
  | {kind: 'ticket-create'; listId: string}
  | {kind: 'ticket-edit'; listId: string; ticketId: string};

/* ============================================================================
 * Main manager
 * ========================================================================== */

export interface KanbanManagerProps {
  store: KanbanStore;
  /** Applies an edit and lets the storage layer persist it. */
  updateStore: (updater: (current: KanbanStore) => KanbanStore) => void;
  sync: SyncStatus;
  /** Set when the backend could not be read on start-up. */
  loadError?: string | null;
}

export function KanbanManager({
  store,
  updateStore: setStore,
  sync,
  loadError,
}: KanbanManagerProps) {
  const [theme, setTheme] = useState<KanbanTheme>(readTheme);
  const [view, setView] = useState(readView);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [sourceDraft, setSourceDraft] = useState('');
  const [sourceDirty, setSourceDirty] = useState(false);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const {toasts, showToast} = useToasts();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const board = useMemo(
    () =>
      store.boards.find((b) => b.id === store.activeBoardId) ?? store.boards[0],
    [store],
  );
  const source = useMemo(() => boardToMermaid(board), [board]);

  /* ---------- Persistence ----------
   * Boards are owned by the storage adapter (see src/storage); only device-local
   * UI preferences are written here. */

  useEffect(() => {
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    writeView(view);
  }, [view]);

  useEffect(() => {
    if (!sourceDirty) setSourceDraft(source);
  }, [source, sourceDirty]);

  /* ---------- Store updates ---------- */

  const updateBoard = useCallback(
    (updater: (current: KanbanBoard) => KanbanBoard) => {
      setStore((prev) => {
        const activeId = prev.boards.some((b) => b.id === prev.activeBoardId)
          ? prev.activeBoardId
          : prev.boards[0]?.id;
        return {
          ...prev,
          boards: prev.boards.map((item) =>
            item.id === activeId
              ? {...updater(item), updatedAt: nowIso()}
              : item,
          ),
        };
      });
    },
    [setStore],
  );

  const handleCopy = useCallback(
    (text: string, label: string) => {
      copyToClipboard(text);
      showToast(`${label} copied`, 'success');
    },
    [showToast],
  );

  /* ---------- Boards ---------- */

  const selectBoard = useCallback(
    (boardId: string) => {
      setStore((prev) => ({...prev, activeBoardId: boardId}));
      setSourceDirty(false);
      setSourceWarnings([]);
    },
    [setStore],
  );

  const createBoard = useCallback(
    (draft: BoardDraft) => {
      const created = createEmptyBoard(draft.name);
      const next: KanbanBoard = {
        ...created,
        description: draft.description || undefined,
        ticketPrefix: sanitizeTicketPrefix(draft.ticketPrefix),
        ticketBaseUrl: draft.ticketBaseUrl || undefined,
      };
      setStore((prev) => ({
        ...prev,
        boards: [...prev.boards, next],
        activeBoardId: next.id,
      }));
      setSourceDirty(false);
      setModal(null);
      showToast(`Board "${next.name}" created`, 'success');
    },
    [setStore, showToast],
  );

  const editBoard = useCallback(
    (draft: BoardDraft) => {
      updateBoard((current) => ({
        ...current,
        name: draft.name,
        description: draft.description || undefined,
        ticketPrefix: sanitizeTicketPrefix(draft.ticketPrefix),
        ticketBaseUrl: draft.ticketBaseUrl || undefined,
      }));
      setModal(null);
      showToast('Board updated', 'success');
    },
    [showToast, updateBoard],
  );

  const copyBoard = useCallback(() => {
    const copy = duplicateBoard(board, `${board.name} (copy)`);
    setStore((prev) => ({
      ...prev,
      boards: [...prev.boards, copy],
      activeBoardId: copy.id,
    }));
    setSourceDirty(false);
    showToast('Board duplicated', 'success');
  }, [board, setStore, showToast]);

  const deleteBoard = useCallback(() => {
    if (
      !window.confirm(
        `Delete board "${board.name}" with ${countTickets(board)} ticket(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    setStore((prev) => {
      const boards = prev.boards.filter((item) => item.id !== board.id);
      if (boards.length === 0) {
        const fresh = createEmptyBoard('New board');
        return {...prev, boards: [fresh], activeBoardId: fresh.id};
      }
      return {...prev, boards, activeBoardId: boards[0].id};
    });
    setSourceDirty(false);
    showToast('Board deleted', 'info');
  }, [board, setStore, showToast]);

  /* ---------- Lists ---------- */

  const createList = useCallback(
    (draft: ListDraft) => {
      updateBoard((current) => ({
        ...current,
        lists: [
          ...current.lists,
          {
            id: createListId(),
            title: draft.title,
            wipLimit: draft.wipLimit ? Number(draft.wipLimit) : undefined,
            tickets: [],
          },
        ],
      }));
      setModal(null);
      showToast('List added', 'success');
    },
    [showToast, updateBoard],
  );

  const editList = useCallback(
    (listId: string, draft: ListDraft) => {
      updateBoard((current) => ({
        ...current,
        lists: current.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                title: draft.title,
                wipLimit: draft.wipLimit ? Number(draft.wipLimit) : undefined,
              }
            : list,
        ),
      }));
      setModal(null);
      showToast('List updated', 'success');
    },
    [showToast, updateBoard],
  );

  const deleteList = useCallback(
    (listId: string) => {
      const list = board.lists.find((item) => item.id === listId);
      if (!list) return;
      if (
        list.tickets.length > 0 &&
        !window.confirm(
          `Delete list "${list.title}" and its ${list.tickets.length} ticket(s)?`,
        )
      ) {
        return;
      }
      updateBoard((current) => ({
        ...current,
        lists: current.lists.filter((item) => item.id !== listId),
      }));
      showToast('List deleted', 'info');
    },
    [board, showToast, updateBoard],
  );

  const moveList = useCallback(
    (listId: string, direction: -1 | 1) => {
      updateBoard((current) => {
        const index = current.lists.findIndex((list) => list.id === listId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= current.lists.length) {
          return current;
        }
        const lists = [...current.lists];
        [lists[index], lists[target]] = [lists[target], lists[index]];
        return {...current, lists};
      });
    },
    [updateBoard],
  );

  /* ---------- Tickets ---------- */

  const createTicket = useCallback(
    (draft: TicketDraft) => {
      updateBoard((current) => {
        const ticket = ticketFromDraft(draft);
        const lists = current.lists.map((list) =>
          list.id === draft.listId
            ? {...list, tickets: [...list.tickets, ticket]}
            : list,
        );
        return bumpTicketCounter({...current, lists}, ticket.ticketId);
      });
      setModal(null);
      showToast('Ticket created', 'success');
    },
    [showToast, updateBoard],
  );

  const editTicket = useCallback(
    (ticketId: string, draft: TicketDraft) => {
      updateBoard((current) => {
        const found = findTicket(current, ticketId);
        if (!found) return current;
        const updated = ticketFromDraft(draft, found.ticket);

        let lists = current.lists;
        if (found.list.id === draft.listId) {
          lists = current.lists.map((list) =>
            list.id === draft.listId
              ? {
                  ...list,
                  tickets: list.tickets.map((item) =>
                    item.id === ticketId ? updated : item,
                  ),
                }
              : list,
          );
        } else {
          lists = current.lists.map((list) => {
            if (list.id === found.list.id) {
              return {
                ...list,
                tickets: list.tickets.filter((item) => item.id !== ticketId),
              };
            }
            if (list.id === draft.listId) {
              return {...list, tickets: [...list.tickets, updated]};
            }
            return list;
          });
        }

        return bumpTicketCounter({...current, lists}, updated.ticketId);
      });
      setModal(null);
      showToast('Ticket updated', 'success');
    },
    [showToast, updateBoard],
  );

  const deleteTicket = useCallback(
    (listId: string, ticketId: string) => {
      const found = findTicket(board, ticketId);
      if (!found) return;
      if (
        !window.confirm(
          `Delete ticket "${found.ticket.ticketId ?? found.ticket.title}"?`,
        )
      ) {
        return;
      }
      updateBoard((current) => ({
        ...current,
        lists: current.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                tickets: list.tickets.filter((item) => item.id !== ticketId),
              }
            : list,
        ),
      }));
      showToast('Ticket deleted', 'info');
    },
    [board, showToast, updateBoard],
  );

  const duplicateTicket = useCallback(
    (listId: string, ticketId: string) => {
      updateBoard((current) => {
        const found = findTicket(current, ticketId);
        if (!found) return current;
        const timestamp = nowIso();
        const copy: Ticket = {
          ...clone(found.ticket),
          id: createTicketNodeId(),
          ticketId: found.ticket.ticketId ? nextTicketRef(current) : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const lists = current.lists.map((list) => {
          if (list.id !== listId) return list;
          const index = list.tickets.findIndex((item) => item.id === ticketId);
          const tickets = [...list.tickets];
          tickets.splice(index + 1, 0, copy);
          return {...list, tickets};
        });
        return bumpTicketCounter({...current, lists}, copy.ticketId);
      });
      showToast('Ticket duplicated', 'success');
    },
    [showToast, updateBoard],
  );

  const shiftTicket = useCallback(
    (ticketId: string, direction: -1 | 1) => {
      updateBoard((current) => {
        const found = findTicket(current, ticketId);
        if (!found) return current;
        const index = current.lists.findIndex(
          (list) => list.id === found.list.id,
        );
        const target = index + direction;
        if (target < 0 || target >= current.lists.length) return current;
        return moveTicket(
          current,
          ticketId,
          current.lists[target].id,
          current.lists[target].tickets.length,
        );
      });
    },
    [updateBoard],
  );

  const dropTicket = useCallback(
    (ticketId: string, listId: string, index: number) => {
      updateBoard((current) => moveTicket(current, ticketId, listId, index));
    },
    [updateBoard],
  );

  /* ---------- Mermaid source ---------- */

  const applySource = useCallback(() => {
    try {
      const parsed = parseMermaidKanban(sourceDraft);
      updateBoard((current) => mergeParsedIntoBoard(current, parsed));
      setSourceWarnings(parsed.warnings);
      setSourceDirty(false);
      const tickets = parsed.lists.reduce(
        (total, list) => total + list.tickets.length,
        0,
      );
      showToast(
        `Applied ${parsed.lists.length} list(s) and ${tickets} ticket(s)`,
        'success',
      );
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }, [showToast, sourceDraft, updateBoard]);

  const downloadSource = useCallback(() => {
    downloadFile(source, `${slugify(board.name)}.mmd`, 'text/plain');
    showToast('Diagram downloaded', 'success');
  }, [board.name, showToast, source]);

  /* ---------- Import / export / reset ---------- */

  const exportStore = useCallback(() => {
    downloadFile(
      JSON.stringify(
        {...store, type: 'tasks-kanban', exportedAt: nowIso()},
        null,
        2,
      ),
      'tasks-kanban.json',
      'application/json',
    );
    showToast(`Exported ${store.boards.length} board(s)`, 'success');
  }, [showToast, store]);

  const handleImportFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loaded) => {
        try {
          const data = JSON.parse(String(loaded.target?.result ?? '')) as
            | Partial<KanbanStore>
            | KanbanBoard;
          const incoming = Array.isArray((data as KanbanStore).boards)
            ? (data as KanbanStore).boards
            : [data as KanbanBoard];

          const boards = incoming
            .map((item) => normalizeBoard(item))
            .filter((item): item is KanbanBoard => item !== null);

          if (boards.length === 0) {
            showToast('No boards found in that file', 'error');
            return;
          }

          setStore((prev) => {
            const merged = normalizeStore({
              ...prev,
              boards: [...prev.boards, ...boards],
            });
            // Ids may have been reassigned to avoid clashes, so jump to the
            // first board by position rather than by the id from the file.
            const firstImported =
              merged.boards[prev.boards.length] ?? merged.boards[0];
            return {...merged, activeBoardId: firstImported.id};
          });
          setSourceDirty(false);
          showToast(`Imported ${boards.length} board(s)`, 'success');
        } catch (error) {
          showToast(`Failed to read file: ${(error as Error).message}`, 'error');
        }
      };
      reader.readAsText(file);
    },
    [setStore, showToast],
  );

  const resetStore = useCallback(() => {
    if (
      !window.confirm(
        `Replace every board stored in ${sync.label} with the starter board? Export first if you want to keep them.`,
      )
    ) {
      return;
    }
    setStore(() => normalizeStore(clone(KANBAN_SEED)));
    setSourceDirty(false);
    setSourceWarnings([]);
    showToast('Boards reset to the starter board', 'info');
  }, [setStore, showToast, sync.label]);

  /* ---------- Search ---------- */

  const query = searchQuery.trim().toLowerCase();
  const haystacks = useMemo(() => {
    const map: Record<string, string> = {};
    for (const list of board.lists) {
      for (const ticket of list.tickets) {
        map[ticket.id] = ticketHaystack(ticket);
      }
    }
    return map;
  }, [board]);

  const matches = useCallback(
    (ticket: Ticket) => {
      if (!query) return true;
      return (haystacks[ticket.id] ?? '').includes(query);
    },
    [haystacks, query],
  );

  const matchCount = useMemo(() => {
    if (!query) return 0;
    return board.lists.reduce(
      (total, list) => total + list.tickets.filter(matches).length,
      0,
    );
  }, [board, matches, query]);

  /* ---------- Keyboard shortcuts ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        if (modal) setModal(null);
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  /* ---------- Derived ---------- */

  const totalTickets = countTickets(board);
  const unassigned = board.lists.reduce(
    (total, list) =>
      total + list.tickets.filter((ticket) => !ticket.assigned).length,
    0,
  );
  const duplicateRefs = useMemo(() => duplicateTicketRefs(board), [board]);

  const actions: BoardActions = {
    onAddList: () => setModal({kind: 'list-create'}),
    onEditList: (listId) => setModal({kind: 'list-edit', listId}),
    onDeleteList: deleteList,
    onMoveList: moveList,
    onAddTicket: (listId) => setModal({kind: 'ticket-create', listId}),
    onEditTicket: (listId, ticketId) =>
      setModal({kind: 'ticket-edit', listId, ticketId}),
    onDeleteTicket: deleteTicket,
    onDuplicateTicket: duplicateTicket,
    onShiftTicket: shiftTicket,
    onDropTicket: dropTicket,
    onCopy: handleCopy,
  };

  /* ---------- Modals ---------- */

  const renderModal = () => {
    if (!modal) return null;

    if (modal.kind === 'board-create') {
      return (
        <BoardModal
          title="New board"
          submitLabel="Create board"
          onSubmit={createBoard}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.kind === 'board-edit') {
      return (
        <BoardModal
          title="Board settings"
          submitLabel="Save board"
          initial={{
            name: board.name,
            description: board.description ?? '',
            ticketPrefix: board.ticketPrefix,
            ticketBaseUrl: board.ticketBaseUrl ?? '',
          }}
          onSubmit={editBoard}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.kind === 'list-create') {
      return (
        <ListModal
          title="New list"
          submitLabel="Add list"
          onSubmit={createList}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.kind === 'list-edit') {
      const list = board.lists.find((item) => item.id === modal.listId);
      if (!list) return null;
      return (
        <ListModal
          title={`Edit list — ${list.title}`}
          submitLabel="Save list"
          initial={{
            title: list.title,
            wipLimit: list.wipLimit ? String(list.wipLimit) : '',
          }}
          onSubmit={(draft) => editList(list.id, draft)}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.kind === 'ticket-create') {
      return (
        <TicketModal
          title="New ticket"
          submitLabel="Create ticket"
          lists={board.lists}
          suggestedTicketId={nextTicketRef(board)}
          initial={{
            listId: modal.listId,
            title: '',
            ticketId: '',
            assigned: '',
            priority: '',
            description: '',
            metadata: [],
          }}
          onSubmit={createTicket}
          onClose={() => setModal(null)}
        />
      );
    }

    const found = findTicket(board, modal.ticketId);
    if (!found) return null;
    return (
      <TicketModal
        title={`Edit ticket — ${found.ticket.ticketId ?? found.ticket.title}`}
        submitLabel="Save ticket"
        lists={board.lists}
        suggestedTicketId={nextTicketRef(board)}
        initial={{
          listId: found.list.id,
          title: found.ticket.title,
          ticketId: found.ticket.ticketId ?? '',
          assigned: found.ticket.assigned ?? '',
          priority: found.ticket.priority ?? '',
          description: found.ticket.description ?? '',
          metadata: found.ticket.metadata.map((entry) => ({...entry})),
        }}
        onSubmit={(draft) => editTicket(found.ticket.id, draft)}
        onClose={() => setModal(null)}
      />
    );
  };

  /* ---------- Render ---------- */

  return (
    <div className={styles.wrapper} data-kanban-theme={theme}>
      <header className={styles.appHeader}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            <span className={styles.logo} aria-hidden>
              🗂️
            </span>
            Tasks
          </h1>

          <SyncBadge sync={sync} />

          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <IconSearch className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search tickets, ids, metadata… (Ctrl+K)"
                autoComplete="off"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClear}
                  title="Clear"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}>
                  <IconX size={14} />
                </button>
              )}
            </div>
            <span className={styles.searchCount}>
              {query ? `${matchCount} found` : ''}
            </span>
          </div>

          <div className={styles.headerActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{display: 'none'}}
              onChange={handleImportFile}
            />
            <button
              type="button"
              className={clsx(styles.btnAction, styles.btnPrimaryAction)}
              onClick={() => fileInputRef.current?.click()}>
              <IconUpload size={14} /> Import JSON
            </button>
            <button
              type="button"
              className={clsx(styles.btnAction, styles.btnSuccessAction)}
              onClick={exportStore}>
              <IconDownload size={14} /> Export JSON
            </button>
            <span className={styles.headerDivider} />
            <button
              type="button"
              className={clsx(styles.btnAction, styles.btnDanger)}
              onClick={resetStore}>
              Reset
            </button>
            <span className={styles.headerDivider} />
            <div className={styles.themePicker}>
              <span className={styles.themePickerLabel}>Theme</span>
              {THEMES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={clsx(
                    styles.themeDot,
                    styles[
                      `themeDot${item.charAt(0).toUpperCase()}${item.slice(1)}` as
                        | 'themeDotPink'
                        | 'themeDotLight'
                        | 'themeDotDark'
                        | 'themeDotContrast'
                    ],
                    item === theme && styles.active,
                  )}
                  title={item.charAt(0).toUpperCase() + item.slice(1)}
                  aria-label={`${item} theme`}
                  onClick={() => setTheme(item)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.boardPicker}>
            <label className={styles.boardPickerLabel} htmlFor="kb-board-select">
              Board
            </label>
            <select
              id="kb-board-select"
              className={styles.boardSelect}
              value={board.id}
              onChange={(event) => selectBoard(event.target.value)}>
              {store.boards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.btnAction}
              title="New board"
              onClick={() => setModal({kind: 'board-create'})}>
              <IconPlus size={12} /> New
            </button>
            <button
              type="button"
              className={styles.btnAction}
              title="Board settings"
              onClick={() => setModal({kind: 'board-edit'})}>
              <IconPencil size={12} /> Settings
            </button>
            <button
              type="button"
              className={styles.btnAction}
              title="Duplicate board"
              onClick={copyBoard}>
              <IconLayers size={12} /> Duplicate
            </button>
            <button
              type="button"
              className={clsx(styles.btnAction, styles.btnDanger)}
              title="Delete board"
              onClick={deleteBoard}>
              <IconTrash size={12} /> Delete
            </button>
          </div>

          <div className={styles.viewTabs} role="tablist" aria-label="View">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={clsx(
                  styles.viewTab,
                  view === item.id && styles.viewTabActive,
                )}
                onClick={() => setView(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.stats}>
            <span>
              <strong>{board.lists.length}</strong> lists
            </span>
            <span>
              <strong>{totalTickets}</strong> tickets
            </span>
            <span>
              <strong>{unassigned}</strong> unassigned
            </span>
            <span className={styles.statsPrefix}>
              next id <code>{nextTicketRef(board)}</code>
            </span>
          </div>
        </div>

        {(board.description || duplicateRefs.length > 0 || loadError) && (
          <div className={styles.boardMeta}>
            {board.description && <span>{board.description}</span>}
            {duplicateRefs.length > 0 && (
              <span className={styles.boardWarning}>
                Duplicate ticket ids: {duplicateRefs.join(', ')}
              </span>
            )}
            {loadError && (
              <span className={styles.boardWarning}>{loadError}</span>
            )}
          </div>
        )}
      </header>

      <div className={styles.content}>
        {view === 'board' && (
          <BoardView
            board={board}
            matches={matches}
            filtering={query.length > 0}
            actions={actions}
          />
        )}

        {view === 'diagram' && (
          <DiagramPanel
            source={source}
            dark={theme === 'dark'}
            onCopy={() => handleCopy(source, 'Mermaid source')}
            onDownload={downloadSource}
          />
        )}

        {view === 'source' && (
          <SourcePanel
            value={sourceDraft}
            dirty={sourceDirty}
            warnings={sourceWarnings}
            onChange={(next) => {
              setSourceDraft(next);
              setSourceDirty(true);
            }}
            onApply={applySource}
            onRevert={() => {
              setSourceDraft(source);
              setSourceDirty(false);
              setSourceWarnings([]);
            }}
            onCopy={() => handleCopy(sourceDraft, 'Mermaid source')}
            onDownload={downloadSource}
          />
        )}
      </div>

      <footer className={styles.appFooter}>
        <p>
          {sync.isLocal ? (
            <>
              Boards are saved in this browser only (
              <code>localStorage</code>) — export JSON to move them to another
              device, or copy the Mermaid source into a doc.
            </>
          ) : (
            <>
              Boards are saved to <code>{sync.label}</code> — export JSON for a
              backup, or copy the Mermaid source into a doc.
            </>
          )}
        </p>
      </footer>

      {renderModal()}

      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              styles.toast,
              styles[toast.type],
              toast.visible && styles.show,
            )}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
