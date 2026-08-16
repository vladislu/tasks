# Architecture

A single-page React app with no backend requirement. Vite builds it to static files, so it can be hosted anywhere that serves a directory — GitHub Pages in this repo's case.

## Layout

```
src/
  main.tsx                 mounts App
  App.tsx                  picks a storage adapter, owns load/save state
  preferences.ts           device-local UI prefs (theme, active view)
  index.scss               global reset and page background
  kanban/                  domain logic — no React, no DOM
    types.ts               KanbanStore -> KanbanBoard -> KanbanList -> Ticket
    data.ts                constants and the first-run seed board
    store.ts               normalisation, ids, ticket refs, move/search helpers
    mermaid.ts             board <-> Mermaid kanban source
  storage/                 persistence — no React except the hook
    types.ts               StorageAdapter, SaveState, SyncStatus
    localStorageAdapter.ts default backend
    restAdapter.ts         backend for a future database
    useKanbanStore.ts      load once, debounce and serialise writes
    index.ts               createStorageAdapter() from build-time config
  components/              UI
    KanbanManager.tsx      all interaction state, toolbar, modals, toasts
    board.tsx              lists, cards, drag and drop
    modals.tsx             board/list/ticket forms and validation
    MermaidDiagram.tsx     lazy Mermaid renderer
    icons.tsx              inline SVGs
    styles.module.scss     every style, themed via [data-kanban-theme]
```

The dependency direction is one-way: `components` → `storage` → `kanban`. Nothing in `kanban/` imports React, which is what makes that logic testable and reusable outside this UI.

## Data flow

1. `App` creates one adapter for the session via `createStorageAdapter()`.
2. `useKanbanStore(adapter)` loads once, runs the result through `normalizeStore`, and falls back to `KANBAN_SEED` when the backend is empty.
3. `App` renders `KanbanManager` with `store`, `updateStore` and a `sync` status object.
4. Every edit calls `updateStore(prev => next)`: React state updates immediately and a save is scheduled.
5. Writes are debounced by 400 ms and never overlap. A save in flight defers the newest state until it finishes; a failed save keeps its payload so the badge's **Retry** can resend it.

The in-memory store is always authoritative. A slow or broken backend degrades to a visible "Not saved" badge rather than blocked editing or lost input, which is the property to preserve when adding a real database.

`normalizeStore` runs on everything entering the app — stored data, imported files, parsed Mermaid — so a schema change or a hand-edited file cannot put an invalid board into state. It fills defaults, drops junk and re-generates colliding ids.

## Mermaid as a serialisation format

`boardToMermaid` and `parseMermaidKanban` in `kanban/mermaid.ts` are near-inverses, which is what makes the source view editable rather than read-only.

Mermaid carries titles, ticket ids, assignees, priorities and arbitrary metadata (through its `@{...}` shape-data block). It has nowhere to put **ticket descriptions** or **list WIP limits**, so `mergeParsedIntoBoard` in `KanbanManager.tsx` re-attaches those from the current board by node id after a parse. Renaming a node id in the source therefore drops its description — that trade-off is documented for users rather than hidden.

Escaping matters in both directions: `escapeLabel` keeps quotes and `@{` out of labels, and metadata values are single-quoted YAML with `''` for embedded quotes. Node ids are sanitised to `[A-Za-z0-9_]` because Mermaid requires unique, simple ids.

Reserved metadata keys (`ticket`, `assigned`, `priority`, `label`, `icon`, `shape`) are rejected in the ticket form because Mermaid interprets them itself.

## Rendering the diagram

`MermaidDiagram` imports `mermaid` dynamically, so its ~700 kB of chunks download only when the Diagram tab is opened. It renders to an SVG string with `securityLevel: 'strict'`, injects it, removes the stray error node Mermaid leaves behind on failure, and shows the parse error instead of an empty frame. Each source change remounts the component via `key`, so a previous error never lingers.

## Styling and theming

All styles live in one SCSS module and are driven by CSS custom properties. Themes are selected by `[data-kanban-theme]` on the component's own wrapper, not on `<html>`, so the app can be dropped into a host page without fighting that page's theming. `--app-header-offset` is the one hook a host can set to reserve room for its own fixed header.

## Conventions

- TypeScript `strict`, no `any` in application code; unknown input is typed `unknown` and narrowed in `normalize*`.
- Domain state is plain, serialisable JSON — no class instances, no `Map` in stored data, so `JSON.stringify` is always a valid write.
- Immutable updates only; `updateStore` receives a function of the previous store.
- Ids are generated once (`createListId`, `createTicketNodeId`) and never derived from titles, so renaming never breaks references.
- Comments explain constraints and trade-offs, not what the next line does.
