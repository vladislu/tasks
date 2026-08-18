import type {
  KanbanTheme,
  KanbanView,
  TicketFormLayout,
} from './kanban/types';

/**
 * UI preferences stay on the device even when boards move to a database —
 * a theme choice is not shared data.
 */
const THEME_KEY = 'tasks-kanban-theme';
const VIEW_KEY = 'tasks-kanban-view';
const TICKET_FORM_LAYOUT_KEY = 'tasks-kanban-ticket-form-layout';

export const THEMES: KanbanTheme[] = ['pink', 'light', 'dark', 'contrast'];

export const TICKET_FORM_LAYOUTS: TicketFormLayout[] = ['classic', 'split'];

export const VIEWS: {id: KanbanView; label: string}[] = [
  {id: 'board', label: 'Board'},
  {id: 'diagram', label: 'Diagram'},
  {id: 'source', label: 'Mermaid source'},
];

export function readTheme(): KanbanTheme {
  const raw = window.localStorage.getItem(THEME_KEY);
  return THEMES.find((theme) => theme === raw) ?? 'pink';
}

export function writeTheme(theme: KanbanTheme): void {
  window.localStorage.setItem(THEME_KEY, theme);
}

export function readView(): KanbanView {
  const raw = window.localStorage.getItem(VIEW_KEY);
  return VIEWS.find((view) => view.id === raw)?.id ?? 'board';
}

export function writeView(view: KanbanView): void {
  window.localStorage.setItem(VIEW_KEY, view);
}

export function readTicketFormLayout(): TicketFormLayout {
  const raw = window.localStorage.getItem(TICKET_FORM_LAYOUT_KEY);
  return TICKET_FORM_LAYOUTS.find((layout) => layout === raw) ?? 'classic';
}

export function writeTicketFormLayout(layout: TicketFormLayout): void {
  window.localStorage.setItem(TICKET_FORM_LAYOUT_KEY, layout);
}
