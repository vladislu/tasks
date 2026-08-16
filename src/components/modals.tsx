import React, {useState} from 'react';
import clsx from 'clsx';

import {PRIORITIES, RESERVED_METADATA_KEYS} from '../kanban/data';
import {isReservedMetadataKey, sanitizeMetadataKey} from '../kanban/mermaid';
import {IconPlus, IconTrash, IconX} from './icons';
import type {
  KanbanList,
  MetadataEntry,
  TicketPriority,
} from '../kanban/types';
import styles from './styles.module.scss';

/* ============================================================================
 * Shell
 * ========================================================================== */

interface ModalShellProps {
  title: string;
  subtitle?: string;
  submitLabel?: string;
  wide?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalShell({
  title,
  subtitle,
  submitLabel = 'Save',
  wide,
  error,
  onSubmit,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <div className={styles.modalContainer}>
      <button
        type="button"
        aria-label="Close dialog"
        className={styles.modalBackdrop}
        onClick={onClose}
      />
      <form
        className={clsx(styles.modalContent, wide && styles.modalWide)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}>
        <div className={styles.modalHeader}>
          <div>
            <h3>{title}</h3>
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.btnIcon}
            onClick={onClose}
            aria-label="Close">
            <IconX size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={styles.formError}>{error}</div>}
          {children}
        </div>
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
 * Board
 * ========================================================================== */

export interface BoardDraft {
  name: string;
  description: string;
  ticketPrefix: string;
  ticketBaseUrl: string;
}

export function BoardModal({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: BoardDraft;
  onSubmit: (draft: BoardDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ticketPrefix, setTicketPrefix] = useState(
    initial?.ticketPrefix ?? 'TASK',
  );
  const [ticketBaseUrl, setTicketBaseUrl] = useState(
    initial?.ticketBaseUrl ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('Board name is required.');
      return;
    }
    if (ticketBaseUrl.trim() && !ticketBaseUrl.includes('#TICKET#')) {
      setError('Ticket link template must contain the #TICKET# placeholder.');
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      ticketPrefix: ticketPrefix.trim(),
      ticketBaseUrl: ticketBaseUrl.trim(),
    });
  };

  return (
    <ModalShell
      title={title}
      submitLabel={submitLabel}
      error={error}
      onSubmit={submit}
      onClose={onClose}>
      <div className={styles.formGroup}>
        <label htmlFor="kb-board-name">Board name</label>
        <input
          id="kb-board-name"
          type="text"
          value={name}
          autoFocus
          placeholder="e.g. SCA Portal Delivery"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="kb-board-description">Description (optional)</label>
        <input
          id="kb-board-description"
          type="text"
          value={description}
          placeholder="What this board tracks"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="kb-board-prefix">Ticket prefix</label>
          <input
            id="kb-board-prefix"
            type="text"
            value={ticketPrefix}
            placeholder="SCA"
            onChange={(event) => setTicketPrefix(event.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="kb-board-url">Ticket link template (optional)</label>
          <input
            id="kb-board-url"
            type="text"
            value={ticketBaseUrl}
            placeholder="https://jira.example.com/browse/#TICKET#"
            onChange={(event) => setTicketBaseUrl(event.target.value)}
          />
        </div>
      </div>
      <p className={styles.formHint}>
        The prefix drives generated ticket ids (<code>SCA-42</code>). The link
        template becomes Mermaid&apos;s <code>kanban.ticketBaseUrl</code>, which
        turns ticket ids in the diagram into links.
      </p>
    </ModalShell>
  );
}

/* ============================================================================
 * List
 * ========================================================================== */

export interface ListDraft {
  title: string;
  wipLimit: string;
}

export function ListModal({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: ListDraft;
  onSubmit: (draft: ListDraft) => void;
  onClose: () => void;
}) {
  const [listTitle, setListTitle] = useState(initial?.title ?? '');
  const [wipLimit, setWipLimit] = useState(initial?.wipLimit ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!listTitle.trim()) {
      setError('List title is required.');
      return;
    }
    if (wipLimit.trim() && !/^\d+$/.test(wipLimit.trim())) {
      setError('WIP limit must be a whole number.');
      return;
    }
    onSubmit({title: listTitle.trim(), wipLimit: wipLimit.trim()});
  };

  return (
    <ModalShell
      title={title}
      submitLabel={submitLabel}
      error={error}
      onSubmit={submit}
      onClose={onClose}>
      <div className={styles.formGroup}>
        <label htmlFor="kb-list-title">List title</label>
        <input
          id="kb-list-title"
          type="text"
          value={listTitle}
          autoFocus
          placeholder="e.g. In Review"
          onChange={(event) => setListTitle(event.target.value)}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="kb-list-wip">WIP limit (optional)</label>
        <input
          id="kb-list-wip"
          type="number"
          min={1}
          value={wipLimit}
          placeholder="e.g. 3"
          onChange={(event) => setWipLimit(event.target.value)}
        />
      </div>
      <p className={styles.formHint}>
        The WIP limit only warns on the board — Mermaid has no field for it, so
        it lives in the board JSON.
      </p>
    </ModalShell>
  );
}

/* ============================================================================
 * Ticket
 * ========================================================================== */

export interface TicketDraft {
  listId: string;
  title: string;
  ticketId: string;
  assigned: string;
  priority: TicketPriority | '';
  description: string;
  metadata: MetadataEntry[];
}

export function TicketModal({
  title,
  submitLabel,
  initial,
  lists,
  suggestedTicketId,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial: TicketDraft;
  lists: KanbanList[];
  suggestedTicketId: string;
  onSubmit: (draft: TicketDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TicketDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof TicketDraft>(
    key: K,
    value: TicketDraft[K],
  ) => {
    setDraft((prev) => ({...prev, [key]: value}));
  };

  const updateMetadata = (index: number, entry: Partial<MetadataEntry>) => {
    setDraft((prev) => ({
      ...prev,
      metadata: prev.metadata.map((item, i) =>
        i === index ? {...item, ...entry} : item,
      ),
    }));
  };

  const submit = () => {
    if (!draft.title.trim()) {
      setError('Title is required.');
      return;
    }

    const metadata: MetadataEntry[] = [];
    const seen = new Set<string>();
    for (const entry of draft.metadata) {
      const key = sanitizeMetadataKey(entry.key);
      if (!key) continue;
      if (isReservedMetadataKey(key)) {
        setError(
          `"${key}" is set by the fields above. Reserved keys: ${RESERVED_METADATA_KEYS.join(', ')}.`,
        );
        return;
      }
      if (seen.has(key.toLowerCase())) {
        setError(`Duplicate metadata key "${key}".`);
        return;
      }
      seen.add(key.toLowerCase());
      metadata.push({key, value: entry.value.trim()});
    }

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      ticketId: draft.ticketId.trim(),
      assigned: draft.assigned.trim(),
      description: draft.description.trim(),
      metadata,
    });
  };

  return (
    <ModalShell
      title={title}
      submitLabel={submitLabel}
      wide
      error={error}
      onSubmit={submit}
      onClose={onClose}>
      <div className={styles.formGroup}>
        <label htmlFor="kb-ticket-title">Title</label>
        <input
          id="kb-ticket-title"
          type="text"
          value={draft.title}
          autoFocus
          placeholder="What needs to be done"
          onChange={(event) => update('title', event.target.value)}
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="kb-ticket-id">Ticket id</label>
          <div className={styles.inputWithButton}>
            <input
              id="kb-ticket-id"
              type="text"
              value={draft.ticketId}
              placeholder={suggestedTicketId}
              onChange={(event) => update('ticketId', event.target.value)}
            />
            <button
              type="button"
              className={styles.btnInline}
              onClick={() => update('ticketId', suggestedTicketId)}>
              Generate
            </button>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="kb-ticket-list">List</label>
          <select
            id="kb-ticket-list"
            value={draft.listId}
            onChange={(event) => update('listId', event.target.value)}>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="kb-ticket-assigned">Assigned (optional)</label>
          <input
            id="kb-ticket-assigned"
            type="text"
            value={draft.assigned}
            placeholder="e.g. v.sludaeve"
            onChange={(event) => update('assigned', event.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="kb-ticket-priority">Priority (optional)</label>
          <select
            id="kb-ticket-priority"
            value={draft.priority}
            onChange={(event) =>
              update('priority', event.target.value as TicketPriority | '')
            }>
            <option value="">None</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="kb-ticket-description">Description (optional)</label>
        <textarea
          id="kb-ticket-description"
          rows={3}
          value={draft.description}
          placeholder="Context, links, acceptance criteria…"
          onChange={(event) => update('description', event.target.value)}
        />
      </div>

      <div className={styles.metadataEditor}>
        <div className={styles.metadataHeader}>
          <span>Metadata</span>
          <button
            type="button"
            className={styles.btnInline}
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                metadata: [...prev.metadata, {key: '', value: ''}],
              }))
            }>
            <IconPlus size={12} /> Add field
          </button>
        </div>

        {draft.metadata.length === 0 && (
          <p className={styles.metadataEmpty}>No custom fields yet.</p>
        )}

        {draft.metadata.map((entry, index) => (
          <div key={index} className={styles.metadataRow}>
            <input
              type="text"
              value={entry.key}
              aria-label={`Metadata key ${index + 1}`}
              placeholder="key"
              onChange={(event) =>
                updateMetadata(index, {key: event.target.value})
              }
            />
            <input
              type="text"
              value={entry.value}
              aria-label={`Metadata value ${index + 1}`}
              placeholder="value"
              onChange={(event) =>
                updateMetadata(index, {value: event.target.value})
              }
            />
            <button
              type="button"
              className={clsx(styles.btnIcon, styles.btnDelete)}
              aria-label={`Remove metadata field ${index + 1}`}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  metadata: prev.metadata.filter((_, i) => i !== index),
                }))
              }>
              <IconTrash size={12} />
            </button>
          </div>
        ))}
      </div>

      <p className={styles.formHint}>
        Ticket id, assigned and priority are drawn by Mermaid. Custom metadata
        is written into the same <code>@{'{ … }'}</code> block, so it survives
        copy, export and re-import even though Mermaid does not draw it.
      </p>
    </ModalShell>
  );
}
