import type {KanbanTheme, KanbanView} from './kanban/types';

/**
 * UI preferences stay on the device even when boards move to a database —
 * a theme choice is not shared data.
 */
const THEME_KEY = 'tasks-kanban-theme';
const VIEW_KEY = 'tasks-kanban-view';

export const THEMES: KanbanTheme[] = ['pink', 'light', 'dark', 'contrast'];

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
