export type KanbanTheme = 'pink' | 'light' | 'dark' | 'contrast';

export type KanbanView = 'board' | 'diagram' | 'source';

/** Shape of the ticket form: `split` moves the description into its own column. */
export type TicketFormLayout = 'classic' | 'split';

/**
 * Priorities understood by Mermaid's kanban renderer. Anything else is dropped
 * on render, so the editor only offers these values.
 */
export type TicketPriority =
  | 'Very High'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Very Low';

export interface MetadataEntry {
  key: string;
  value: string;
}

export interface Ticket {
  /** Mermaid node id: unique per board, may not contain whitespace or ()[]{}@ */
  id: string;
  title: string;
  /** Ticket reference (SCA-1234) rendered by Mermaid as `ticket:`. */
  ticketId?: string;
  assigned?: string;
  priority?: TicketPriority;
  /** Kept in the board only — Mermaid has no field for it. */
  description?: string;
  /** Free-form pairs written into the Mermaid `@{ ... }` block. */
  metadata: MetadataEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanList {
  /** Mermaid section node id. */
  id: string;
  title: string;
  /** Soft limit; the column header warns when the ticket count exceeds it. */
  wipLimit?: number;
  tickets: Ticket[];
}

export interface KanbanBoard {
  id: string;
  name: string;
  description?: string;
  /** Prefix for generated ticket references, e.g. `SCA` -> `SCA-42`. */
  ticketPrefix: string;
  /** Next number handed out for a generated ticket reference. */
  ticketCounter: number;
  /** Mermaid `kanban.ticketBaseUrl`; `#TICKET#` is replaced by the ticket id. */
  ticketBaseUrl?: string;
  lists: KanbanList[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanStore {
  version: string;
  activeBoardId: string | null;
  boards: KanbanBoard[];
}
