import React, {useState} from 'react';
import clsx from 'clsx';

import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconExternal,
  IconGrip,
  IconLayers,
  IconPencil,
  IconPlus,
  IconTrash,
} from './icons';
import {ticketUrl} from '../kanban/store';
import type {
  KanbanBoard,
  KanbanList,
  Ticket,
  TicketPriority,
} from '../kanban/types';
import styles from './styles.module.scss';

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  'Very High': styles.priorityVeryHigh,
  High: styles.priorityHigh,
  Medium: styles.priorityMedium,
  Low: styles.priorityLow,
  'Very Low': styles.priorityVeryLow,
};

interface DropTarget {
  listId: string;
  index: number;
}

export interface BoardActions {
  onAddList: () => void;
  onEditList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onMoveList: (listId: string, direction: -1 | 1) => void;
  onAddTicket: (listId: string) => void;
  onEditTicket: (listId: string, ticketId: string) => void;
  onDeleteTicket: (listId: string, ticketId: string) => void;
  onDuplicateTicket: (listId: string, ticketId: string) => void;
  onShiftTicket: (ticketId: string, direction: -1 | 1) => void;
  onDropTicket: (ticketId: string, listId: string, index: number) => void;
  onCopy: (text: string, label: string) => void;
}

/* ============================================================================
 * Ticket card
 * ========================================================================== */

function TicketCard({
  board,
  ticket,
  listId,
  isFirstList,
  isLastList,
  hidden,
  dragging,
  actions,
  onDragStart,
  onDragEnd,
  onDragOverCard,
}: {
  board: KanbanBoard;
  ticket: Ticket;
  listId: string;
  isFirstList: boolean;
  isLastList: boolean;
  hidden: boolean;
  dragging: boolean;
  actions: BoardActions;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: (event: React.DragEvent<HTMLElement>) => void;
}) {
  const url = ticketUrl(board, ticket);

  return (
    <article
      className={clsx(
        styles.card,
        hidden && styles.hidden,
        dragging && styles.cardDragging,
      )}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', ticket.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      data-ticket-id={ticket.id}
      data-priority={ticket.priority}>
      <div className={styles.cardTop}>
        <span className={styles.cardGrip} aria-hidden>
          <IconGrip size={12} />
        </span>

        {ticket.ticketId ? (
          <span className={styles.ticketRef}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {ticket.ticketId}
                <IconExternal size={10} />
              </a>
            ) : (
              ticket.ticketId
            )}
            <button
              type="button"
              className={clsx(styles.btnIcon, styles.btnCopy)}
              title="Copy ticket id"
              onClick={() => actions.onCopy(ticket.ticketId!, 'Ticket id')}>
              <IconCopy size={10} />
            </button>
          </span>
        ) : (
          <span className={styles.ticketRefEmpty}>no id</span>
        )}

        {ticket.priority && (
          <span
            className={clsx(styles.priorityChip, PRIORITY_CLASS[ticket.priority])}
            title={`Priority: ${ticket.priority}`}>
            {ticket.priority}
          </span>
        )}

        <span className={styles.cardActions}>
          <button
            type="button"
            className={styles.btnIcon}
            title="Move to previous list"
            disabled={isFirstList}
            onClick={() => actions.onShiftTicket(ticket.id, -1)}>
            <IconChevronLeft size={12} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Move to next list"
            disabled={isLastList}
            onClick={() => actions.onShiftTicket(ticket.id, 1)}>
            <IconChevronRight size={12} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Edit ticket"
            onClick={() => actions.onEditTicket(listId, ticket.id)}>
            <IconPencil size={12} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Duplicate ticket"
            onClick={() => actions.onDuplicateTicket(listId, ticket.id)}>
            <IconLayers size={12} />
          </button>
          <button
            type="button"
            className={clsx(styles.btnIcon, styles.btnDelete)}
            title="Delete ticket"
            onClick={() => actions.onDeleteTicket(listId, ticket.id)}>
            <IconTrash size={12} />
          </button>
        </span>
      </div>

      <button
        type="button"
        className={styles.cardTitle}
        title="Edit ticket"
        onClick={() => actions.onEditTicket(listId, ticket.id)}>
        {ticket.title}
      </button>

      {ticket.description && (
        <p className={styles.cardDescription}>{ticket.description}</p>
      )}

      {(ticket.assigned || ticket.metadata.length > 0) && (
        <div className={styles.cardFooter}>
          {ticket.assigned && (
            <span className={styles.assignedChip} title="Assigned">
              {ticket.assigned}
            </span>
          )}
          {ticket.metadata.map((entry) => (
            <span
              key={entry.key}
              className={styles.metaChip}
              title={`${entry.key}: ${entry.value}`}>
              <span className={styles.metaChipKey}>{entry.key}</span>
              {entry.value}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

/* ============================================================================
 * Column
 * ========================================================================== */

function ListColumn({
  board,
  list,
  index,
  matches,
  filtering,
  actions,
  draggingTicketId,
  dropTarget,
  setDropTarget,
  setDraggingTicketId,
}: {
  board: KanbanBoard;
  list: KanbanList;
  index: number;
  matches: (ticket: Ticket) => boolean;
  filtering: boolean;
  actions: BoardActions;
  draggingTicketId: string | null;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
  setDraggingTicketId: (ticketId: string | null) => void;
}) {
  const visible = list.tickets.filter(matches).length;
  const overLimit = list.wipLimit !== undefined && list.tickets.length > list.wipLimit;
  const isFirstList = index === 0;
  const isLastList = index === board.lists.length - 1;

  const finishDrop = (targetIndex: number) => {
    if (draggingTicketId) {
      actions.onDropTicket(draggingTicketId, list.id, targetIndex);
    }
    setDraggingTicketId(null);
    setDropTarget(null);
  };

  const indicator = (position: number) =>
    dropTarget?.listId === list.id && dropTarget.index === position ? (
      <div className={styles.dropIndicator} />
    ) : null;

  return (
    <section className={styles.column} data-list-id={list.id}>
      <header className={styles.columnHeader}>
        <div className={styles.columnTitleRow}>
          <h3 className={styles.columnTitle} title={list.title}>
            {list.title}
          </h3>
          <span className={styles.columnCount}>
            {filtering ? `${visible}/${list.tickets.length}` : list.tickets.length}
          </span>
          {list.wipLimit !== undefined && (
            <span
              className={clsx(styles.wipBadge, overLimit && styles.wipBadgeOver)}
              title={
                overLimit
                  ? `Over the WIP limit of ${list.wipLimit}`
                  : `WIP limit ${list.wipLimit}`
              }>
              WIP {list.wipLimit}
            </span>
          )}
        </div>
        <div className={styles.columnActions}>
          <button
            type="button"
            className={styles.btnIcon}
            title="Move list left"
            disabled={isFirstList}
            onClick={() => actions.onMoveList(list.id, -1)}>
            <IconChevronLeft size={12} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Move list right"
            disabled={isLastList}
            onClick={() => actions.onMoveList(list.id, 1)}>
            <IconChevronRight size={12} />
          </button>
          <button
            type="button"
            className={styles.btnIcon}
            title="Edit list"
            onClick={() => actions.onEditList(list.id)}>
            <IconPencil size={12} />
          </button>
          <button
            type="button"
            className={clsx(styles.btnIcon, styles.btnDelete)}
            title="Delete list"
            onClick={() => actions.onDeleteList(list.id)}>
            <IconTrash size={12} />
          </button>
        </div>
      </header>

      <div
        className={clsx(
          styles.columnBody,
          dropTarget?.listId === list.id && styles.columnBodyActive,
        )}
        onDragOver={(event) => {
          if (!draggingTicketId) return;
          event.preventDefault();
          if (event.target === event.currentTarget) {
            setDropTarget({listId: list.id, index: list.tickets.length});
          }
        }}
        onDrop={(event) => {
          if (!draggingTicketId) return;
          event.preventDefault();
          finishDrop(
            dropTarget?.listId === list.id
              ? dropTarget.index
              : list.tickets.length,
          );
        }}>
        {list.tickets.map((ticket, ticketIndex) => (
          <React.Fragment key={ticket.id}>
            {indicator(ticketIndex)}
            <TicketCard
              board={board}
              ticket={ticket}
              listId={list.id}
              isFirstList={isFirstList}
              isLastList={isLastList}
              hidden={!matches(ticket)}
              dragging={draggingTicketId === ticket.id}
              actions={actions}
              onDragStart={() => setDraggingTicketId(ticket.id)}
              onDragEnd={() => {
                setDraggingTicketId(null);
                setDropTarget(null);
              }}
              onDragOverCard={(event) => {
                if (!draggingTicketId) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const after = event.clientY > rect.top + rect.height / 2;
                setDropTarget({
                  listId: list.id,
                  index: ticketIndex + (after ? 1 : 0),
                });
              }}
            />
          </React.Fragment>
        ))}
        {indicator(list.tickets.length)}

        {list.tickets.length === 0 && (
          <p className={styles.columnEmpty}>Drop tickets here</p>
        )}
        {list.tickets.length > 0 && visible === 0 && (
          <p className={styles.columnEmpty}>No tickets match the search</p>
        )}
      </div>

      <button
        type="button"
        className={styles.btnAddTicket}
        onClick={() => actions.onAddTicket(list.id)}>
        <IconPlus size={12} /> Add ticket
      </button>
    </section>
  );
}

/* ============================================================================
 * Board view
 * ========================================================================== */

export function BoardView({
  board,
  matches,
  filtering,
  actions,
}: {
  board: KanbanBoard;
  matches: (ticket: Ticket) => boolean;
  filtering: boolean;
  actions: BoardActions;
}) {
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  return (
    <div className={styles.board}>
      {board.lists.map((list, index) => (
        <ListColumn
          key={list.id}
          board={board}
          list={list}
          index={index}
          matches={matches}
          filtering={filtering}
          actions={actions}
          draggingTicketId={draggingTicketId}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
          setDraggingTicketId={setDraggingTicketId}
        />
      ))}

      <div className={styles.addColumn}>
        <button
          type="button"
          className={styles.btnAddList}
          onClick={actions.onAddList}>
          <IconPlus size={14} /> Add list
        </button>
      </div>
    </div>
  );
}
