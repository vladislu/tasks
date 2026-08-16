import {KANBAN_SEED, PRIORITIES, STORE_VERSION} from './data';
import {
  createBoardId,
  createListId,
  createTicketNodeId,
  sanitizeMetadataKey,
  sanitizeNodeId,
} from './mermaid';
import type {
  KanbanBoard,
  KanbanList,
  KanbanStore,
  MetadataEntry,
  Ticket,
  TicketPriority,
} from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Prefixes are interpolated into a RegExp and into ticket ids, so keep them tame. */
export function sanitizeTicketPrefix(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'TASK';
}

/* ============================================================================
 * Normalization
 *
 * Everything comes from localStorage or an imported file, so nothing is
 * trusted: unknown shapes are repaired or dropped rather than crashing the UI.
 * ========================================================================== */

function normalizeMetadata(raw: unknown): MetadataEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const entries: MetadataEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = sanitizeMetadataKey(String((item as MetadataEntry).key ?? ''));
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    entries.push({key, value: String((item as MetadataEntry).value ?? '')});
  }
  return entries;
}

function normalizePriority(raw: unknown): TicketPriority | undefined {
  return PRIORITIES.find((p) => p === raw);
}

function normalizeTicket(raw: unknown, used: Set<string>): Ticket | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<Ticket>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;

  let id = sanitizeNodeId(String(input.id ?? '')) || createTicketNodeId();
  while (used.has(id)) id = createTicketNodeId();
  used.add(id);

  const created = optionalString(input.createdAt) ?? nowIso();
  return {
    id,
    title,
    ticketId: optionalString(input.ticketId),
    assigned: optionalString(input.assigned),
    priority: normalizePriority(input.priority),
    description: optionalString(input.description),
    metadata: normalizeMetadata(input.metadata),
    createdAt: created,
    updatedAt: optionalString(input.updatedAt) ?? created,
  };
}

function normalizeList(raw: unknown, used: Set<string>): KanbanList | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<KanbanList>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;

  let id = sanitizeNodeId(String(input.id ?? '')) || createListId();
  while (used.has(id)) id = createListId();
  used.add(id);

  const wipLimit =
    typeof input.wipLimit === 'number' && input.wipLimit > 0
      ? Math.floor(input.wipLimit)
      : undefined;

  const tickets = Array.isArray(input.tickets)
    ? input.tickets
        .map((t) => normalizeTicket(t, used))
        .filter((t): t is Ticket => t !== null)
    : [];

  return {id, title, wipLimit, tickets};
}

export function normalizeBoard(raw: unknown): KanbanBoard | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<KanbanBoard>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return null;

  const used = new Set<string>();
  const lists = Array.isArray(input.lists)
    ? input.lists
        .map((l) => normalizeList(l, used))
        .filter((l): l is KanbanList => l !== null)
    : [];

  const created = optionalString(input.createdAt) ?? nowIso();
  return {
    id: sanitizeNodeId(String(input.id ?? '')) || createBoardId(),
    name,
    description: optionalString(input.description),
    ticketPrefix: sanitizeTicketPrefix(optionalString(input.ticketPrefix) ?? ''),
    ticketCounter:
      typeof input.ticketCounter === 'number' && input.ticketCounter > 0
        ? Math.floor(input.ticketCounter)
        : 1,
    ticketBaseUrl: optionalString(input.ticketBaseUrl),
    lists,
    createdAt: created,
    updatedAt: optionalString(input.updatedAt) ?? created,
  };
}

export function normalizeStore(raw: unknown): KanbanStore {
  const input = (raw ?? {}) as Partial<KanbanStore>;
  const boards = Array.isArray(input.boards)
    ? input.boards
        .map((b) => normalizeBoard(b))
        .filter((b): b is KanbanBoard => b !== null)
    : [];

  const deduped: KanbanBoard[] = [];
  const usedBoardIds = new Set<string>();
  for (const board of boards) {
    let id = board.id;
    while (usedBoardIds.has(id)) id = createBoardId();
    usedBoardIds.add(id);
    deduped.push({...board, id});
  }

  if (deduped.length === 0) {
    return clone(KANBAN_SEED);
  }

  const activeBoardId = deduped.some((b) => b.id === input.activeBoardId)
    ? (input.activeBoardId as string)
    : deduped[0].id;

  return {version: STORE_VERSION, activeBoardId, boards: deduped};
}

/* ============================================================================
 * Board factories and updates
 * ========================================================================== */

export function createEmptyBoard(name: string): KanbanBoard {
  const created = nowIso();
  return {
    id: createBoardId(),
    name,
    ticketPrefix: 'TASK',
    ticketCounter: 1,
    createdAt: created,
    updatedAt: created,
    lists: [
      {id: createListId(), title: 'To Do', tickets: []},
      {id: createListId(), title: 'In Progress', wipLimit: 3, tickets: []},
      {id: createListId(), title: 'Done', tickets: []},
    ],
  };
}

/** Copies a board under a new name, refreshing every node id. */
export function duplicateBoard(board: KanbanBoard, name: string): KanbanBoard {
  const created = nowIso();
  return {
    ...clone(board),
    id: createBoardId(),
    name,
    createdAt: created,
    updatedAt: created,
    lists: board.lists.map((list) => ({
      ...clone(list),
      id: createListId(),
      tickets: list.tickets.map((ticket) => ({
        ...clone(ticket),
        id: createTicketNodeId(),
      })),
    })),
  };
}

export function nextTicketRef(board: KanbanBoard): string {
  const prefix = board.ticketPrefix || 'TASK';
  return `${prefix}-${board.ticketCounter}`;
}

/**
 * Keeps the generator ahead of manually typed references so it never suggests
 * an id that is already on the board.
 */
export function bumpTicketCounter(
  board: KanbanBoard,
  ref?: string,
): KanbanBoard {
  if (!ref) return board;
  const prefix = board.ticketPrefix || 'TASK';
  const match = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(ref.trim());
  if (!match) return board;
  const used = Number(match[1]);
  if (!Number.isFinite(used) || used < board.ticketCounter) return board;
  return {...board, ticketCounter: used + 1};
}

export function findTicket(
  board: KanbanBoard,
  ticketId: string,
): {list: KanbanList; ticket: Ticket} | null {
  for (const list of board.lists) {
    const ticket = list.tickets.find((t) => t.id === ticketId);
    if (ticket) return {list, ticket};
  }
  return null;
}

export function countTickets(board: KanbanBoard): number {
  return board.lists.reduce((total, list) => total + list.tickets.length, 0);
}

export function duplicateTicketRefs(board: KanbanBoard): string[] {
  const counts: Record<string, number> = {};
  for (const list of board.lists) {
    for (const ticket of list.tickets) {
      const ref = ticket.ticketId?.trim();
      if (!ref) continue;
      counts[ref] = (counts[ref] ?? 0) + 1;
    }
  }
  return Object.keys(counts).filter((ref) => counts[ref] > 1);
}

/** Moves a ticket to `toIndex` of `toListId`, accounting for its own removal. */
export function moveTicket(
  board: KanbanBoard,
  ticketId: string,
  toListId: string,
  toIndex: number,
): KanbanBoard {
  const found = findTicket(board, ticketId);
  if (!found) return board;

  const fromIndex = found.list.tickets.findIndex((t) => t.id === ticketId);
  let targetIndex = toIndex;
  if (found.list.id === toListId && fromIndex < toIndex) {
    targetIndex -= 1;
  }

  const lists = board.lists.map((list) => ({
    ...list,
    tickets: list.tickets.filter((t) => t.id !== ticketId),
  }));

  const target = lists.find((l) => l.id === toListId);
  if (!target) return board;

  const bounded = Math.max(0, Math.min(targetIndex, target.tickets.length));
  target.tickets = [
    ...target.tickets.slice(0, bounded),
    found.ticket,
    ...target.tickets.slice(bounded),
  ];

  return {...board, lists};
}

export function ticketHaystack(ticket: Ticket): string {
  return [
    ticket.title,
    ticket.ticketId,
    ticket.assigned,
    ticket.priority,
    ticket.description,
    ...ticket.metadata.flatMap((m) => [m.key, m.value]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function ticketUrl(
  board: KanbanBoard,
  ticket: Ticket,
): string | undefined {
  const base = board.ticketBaseUrl?.trim();
  const ref = ticket.ticketId?.trim();
  if (!base || !ref || !base.includes('#TICKET#')) return undefined;
  return base.replace('#TICKET#', encodeURIComponent(ref));
}
