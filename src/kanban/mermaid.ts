import {PRIORITIES, RESERVED_METADATA_KEYS} from './data';
import type {
  KanbanBoard,
  KanbanList,
  MetadataEntry,
  Ticket,
  TicketPriority,
} from './types';

/* ============================================================================
 * Ids
 *
 * Ids end up verbatim in the Mermaid source, where the lexer forbids
 * whitespace and any of ( ) [ ] { } @ inside a node id.
 * ========================================================================== */

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  }
  return Math.random().toString(36).slice(2, 8);
}

export function sanitizeNodeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
}

export function createId(prefix: string): string {
  return `${prefix}_${randomSuffix()}`;
}

export function createBoardId(): string {
  return createId('board');
}

export function createListId(): string {
  return createId('list');
}

export function createTicketNodeId(): string {
  return createId('tkt');
}

/** Keeps an id unique inside one board, since Mermaid needs distinct nodes. */
function uniqueId(
  candidate: string | undefined,
  prefix: string,
  used: Set<string>,
): string {
  const base = sanitizeNodeId(candidate ?? '') || createId(prefix);
  let id = base;
  while (used.has(id)) {
    id = `${base}_${randomSuffix()}`;
  }
  used.add(id);
  return id;
}

export function sanitizeMetadataKey(raw: string): string {
  return raw.trim().replace(/[^A-Za-z0-9_-]/g, '_');
}

export function isReservedMetadataKey(key: string): boolean {
  return RESERVED_METADATA_KEYS.includes(sanitizeMetadataKey(key).toLowerCase());
}

/* ============================================================================
 * Serialization
 * ========================================================================== */

/**
 * Node labels are emitted quoted, so only quotes and newlines need handling.
 * `@{` is broken up as well, since it would otherwise look like the start of a
 * metadata block when the source is read back.
 */
function escapeLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .replace(/@\{/g, '@ {')
    .trim();
}

/**
 * Metadata is parsed by Mermaid as a single-line YAML flow mapping, and its
 * lexer ends the block at the first `}` or `"`. Quoting every value keeps
 * commas and colons safe; braces and double quotes are dropped.
 */
function yamlValue(value: string): string {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/["{}]/g, '')
    .trim()
    .replace(/'/g, "''");
  return `'${cleaned}'`;
}

function ticketMetadataBlock(ticket: Ticket): string {
  const parts: string[] = [];
  if (ticket.ticketId?.trim()) {
    parts.push(`ticket: ${yamlValue(ticket.ticketId)}`);
  }
  if (ticket.assigned?.trim()) {
    parts.push(`assigned: ${yamlValue(ticket.assigned)}`);
  }
  if (ticket.priority) {
    parts.push(`priority: ${yamlValue(ticket.priority)}`);
  }
  for (const entry of ticket.metadata) {
    const key = sanitizeMetadataKey(entry.key);
    if (!key || isReservedMetadataKey(key)) continue;
    parts.push(`${key}: ${yamlValue(entry.value)}`);
  }
  return parts.join(', ');
}

export function boardToMermaid(board: KanbanBoard): string {
  const lines: string[] = [];
  const baseUrl = board.ticketBaseUrl?.trim();

  if (baseUrl) {
    lines.push(
      '---',
      'config:',
      '  kanban:',
      `    ticketBaseUrl: '${baseUrl.replace(/'/g, "''")}'`,
      '---',
    );
  }

  lines.push('kanban');

  for (const list of board.lists) {
    lines.push(`  ${list.id}["${escapeLabel(list.title)}"]`);
    for (const ticket of list.tickets) {
      const meta = ticketMetadataBlock(ticket);
      lines.push(
        `    ${ticket.id}["${escapeLabel(ticket.title)}"]${
          meta ? `@{ ${meta} }` : ''
        }`,
      );
    }
  }

  if (board.lists.length === 0) {
    lines.push('  empty["No lists yet"]');
  }

  return lines.join('\n');
}

/* ============================================================================
 * Parsing (Mermaid source -> board data)
 * ========================================================================== */

function unquote(raw: string): string {
  const text = raw.trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if (first === last && (first === '"' || first === "'" || first === '`')) {
      const inner = text.slice(1, -1);
      return first === "'" ? inner.replace(/''/g, "'") : inner;
    }
  }
  return text;
}

function splitMetadataBlock(raw: string): string[] {
  const parts: string[] = [];
  let buffer = '';
  let quote: string | null = null;

  for (const char of raw) {
    if (quote) {
      if (char === quote) quote = null;
      buffer += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === ',' || char === '\n') {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  parts.push(buffer);

  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseMetadataBlock(raw: string): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  for (const part of splitMetadataBlock(raw)) {
    const separator = part.indexOf(':');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    entries.push({key, value: unquote(part.slice(separator + 1))});
  }
  return entries;
}

interface ParsedNode {
  id?: string;
  label: string;
  metadata: MetadataEntry[];
}

function parseNodeLine(line: string): ParsedNode {
  let head = line;
  let metadata: MetadataEntry[] = [];

  // Metadata always trails the label, so scan from the right.
  const shapeStart = line.lastIndexOf('@{');
  if (shapeStart >= 0) {
    const shapeEnd = line.lastIndexOf('}');
    if (shapeEnd > shapeStart) {
      metadata = parseMetadataBlock(line.slice(shapeStart + 2, shapeEnd));
      head = line.slice(0, shapeStart);
    }
  }

  head = head.trim();
  const bracket = head.search(/[[({]/);
  if (bracket === -1) {
    return {label: unquote(head), metadata};
  }

  const id = head.slice(0, bracket).trim();
  const label = head
    .slice(bracket)
    .replace(/^[[({]+/, '')
    .replace(/[\])}]+$/, '');

  return {id: id || undefined, label: unquote(label), metadata};
}

function matchPriority(value: string): TicketPriority | undefined {
  const normalized = value.trim().toLowerCase();
  return PRIORITIES.find((p) => p.toLowerCase() === normalized);
}

export interface ParsedKanban {
  lists: KanbanList[];
  ticketBaseUrl?: string;
  warnings: string[];
}

/**
 * Reads back the dialect this module writes, and tolerates hand-written
 * diagrams: unquoted labels, `(round)` sections, comments and tab indentation.
 * Throws when the text isn't a kanban diagram at all.
 */
export function parseMermaidKanban(text: string): ParsedKanban {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const warnings: string[] = [];
  const usedIds = new Set<string>();
  const lists: KanbanList[] = [];
  const now = new Date().toISOString();

  let ticketBaseUrl: string | undefined;
  let cursor = 0;

  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end === -1) {
      throw new Error('Front matter is not closed — a trailing `---` is missing.');
    }
    const frontMatter = lines.slice(1, end).join('\n');
    const match = /ticketBaseUrl\s*:\s*(.+)/.exec(frontMatter);
    if (match) ticketBaseUrl = unquote(match[1]);
    cursor = end + 1;
  }

  let headerSeen = false;
  let sectionIndent: number | null = null;

  for (; cursor < lines.length; cursor++) {
    const raw = lines[cursor].replace(/\t/g, '  ');
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!headerSeen) {
      if (trimmed.toLowerCase() !== 'kanban') {
        throw new Error(
          `Line ${cursor + 1}: expected the diagram to start with "kanban".`,
        );
      }
      headerSeen = true;
      continue;
    }

    const indent = raw.length - raw.trimStart().length;
    if (sectionIndent === null) sectionIndent = indent;

    const node = parseNodeLine(trimmed);

    if (indent <= sectionIndent) {
      lists.push({
        id: uniqueId(node.id, 'list', usedIds),
        title: node.label || 'Untitled list',
        tickets: [],
      });
      continue;
    }

    if (lists.length === 0) {
      warnings.push(
        `Line ${cursor + 1}: ticket found before any list — added an "Imported" list.`,
      );
      lists.push({
        id: uniqueId(undefined, 'list', usedIds),
        title: 'Imported',
        tickets: [],
      });
    }

    const ticket: Ticket = {
      id: uniqueId(node.id, 'tkt', usedIds),
      title: node.label || 'Untitled ticket',
      metadata: [],
      createdAt: now,
      updatedAt: now,
    };

    for (const entry of node.metadata) {
      const key = entry.key.toLowerCase();
      if (key === 'ticket') {
        ticket.ticketId = entry.value;
      } else if (key === 'assigned') {
        ticket.assigned = entry.value;
      } else if (key === 'priority') {
        const priority = matchPriority(entry.value);
        if (priority) {
          ticket.priority = priority;
        } else {
          warnings.push(
            `Line ${cursor + 1}: unknown priority "${entry.value}" was dropped.`,
          );
        }
      } else if (isReservedMetadataKey(key)) {
        warnings.push(
          `Line ${cursor + 1}: Mermaid key "${entry.key}" is not editable here and was dropped.`,
        );
      } else {
        ticket.metadata.push({
          key: sanitizeMetadataKey(entry.key),
          value: entry.value,
        });
      }
    }

    lists[lists.length - 1].tickets.push(ticket);
  }

  if (!headerSeen) {
    throw new Error('No `kanban` diagram found in the source.');
  }
  if (lists.length === 0) {
    throw new Error('The diagram has no lists.');
  }

  return {lists, ticketBaseUrl, warnings};
}
