import type {KanbanStore, TicketPriority} from './types';

export const STORE_VERSION = '1.0';

export const PRIORITIES: TicketPriority[] = [
  'Very High',
  'High',
  'Medium',
  'Low',
  'Very Low',
];

/** Keys Mermaid consumes itself, so they can't be reused as custom metadata. */
export const RESERVED_METADATA_KEYS = [
  'ticket',
  'assigned',
  'priority',
  'label',
  'icon',
  'shape',
];

const SEED_DATE = '2026-01-01T09:00:00.000Z';

/**
 * Board created on first run. It doubles as a tour of the app, so the tickets
 * describe the features they demonstrate. Delete or rename it freely — nothing
 * else depends on it except the Reset action.
 */
export const KANBAN_SEED: KanbanStore = {
  version: STORE_VERSION,
  activeBoardId: 'board_getting_started',
  boards: [
    {
      id: 'board_getting_started',
      name: 'Getting Started',
      description: 'A sample board — rename it, or create your own and delete this one.',
      ticketPrefix: 'TASK',
      ticketCounter: 5,
      createdAt: SEED_DATE,
      updatedAt: SEED_DATE,
      lists: [
        {
          id: 'list_backlog',
          title: 'Backlog',
          tickets: [
            {
              id: 'tkt_welcome_1',
              title: 'Drag me into another list',
              ticketId: 'TASK-1',
              priority: 'Low',
              description:
                'Cards can be dragged between and within lists. The arrow buttons do the same thing from the keyboard.',
              metadata: [{key: 'area', value: 'board'}],
              createdAt: SEED_DATE,
              updatedAt: SEED_DATE,
            },
            {
              id: 'tkt_welcome_2',
              title: 'Add custom metadata to a ticket',
              ticketId: 'TASK-2',
              priority: 'Medium',
              description:
                'Open a ticket and add key/value fields. They travel with the Mermaid source, so export and re-import keep them.',
              metadata: [
                {key: 'area', value: 'metadata'},
                {key: 'example', value: 'any key you like'},
              ],
              createdAt: SEED_DATE,
              updatedAt: SEED_DATE,
            },
          ],
        },
        {
          id: 'list_in_progress',
          title: 'In Progress',
          wipLimit: 3,
          tickets: [
            {
              id: 'tkt_welcome_3',
              title: 'Switch to the Diagram tab',
              ticketId: 'TASK-3',
              assigned: 'you',
              priority: 'High',
              description:
                'The same board rendered as a Mermaid kanban diagram. Copy the source into any Markdown file that supports Mermaid.',
              metadata: [{key: 'area', value: 'mermaid'}],
              createdAt: SEED_DATE,
              updatedAt: SEED_DATE,
            },
          ],
        },
        {
          id: 'list_review',
          title: 'In Review',
          wipLimit: 2,
          tickets: [
            {
              id: 'tkt_welcome_4',
              title: 'Set a ticket link template in Board settings',
              ticketId: 'TASK-4',
              priority: 'Very Low',
              description:
                'A template such as https://your-tracker/browse/#TICKET# turns every ticket id into a link, on the card and in the diagram.',
              metadata: [{key: 'area', value: 'settings'}],
              createdAt: SEED_DATE,
              updatedAt: SEED_DATE,
            },
          ],
        },
        {
          id: 'list_done',
          title: 'Done',
          tickets: [],
        },
      ],
    },
  ],
};
