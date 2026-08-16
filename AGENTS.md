# AGENTS.md

Instructions for AI coding agents working in this repository. Read this before changing code. `docs/architecture.md` has the detail behind the rules below; `docs/database.md` covers persistence.

## What this project is

A static React + TypeScript single-page app: a Kanban board that serialises itself to a Mermaid `kanban` diagram. No backend is required, it is deployed to GitHub Pages, and persistence sits behind a swappable adapter so a database can be added later.

Stack: Vite, React 18, TypeScript (`strict`), SCSS modules, Mermaid 11. No state library, no router, no UI framework — do not add one without being asked.

## Before you finish

Both must pass, and both are cheap:

```bash
npm run typecheck   # tsc --noEmit, strict
npm run build       # typecheck + vite build
```

There is no test runner configured yet. If you add tests, use Vitest, put them next to the code as `*.test.ts`, and start with `src/kanban/` — it is pure and needs no DOM.

## Rules that are easy to get wrong

**Keep the dependency direction.** `components/` → `storage/` → `kanban/`. Nothing in `src/kanban/` may import React, a component, or an adapter. Domain logic stays pure and serialisable.

**Never persist directly.** Board data is written only through `StorageAdapter` (`src/storage/`). Do not call `localStorage` from a component for anything that belongs to a board. Device-local UI preferences are the sole exception and live in `src/preferences.ts`.

**Every edit goes through `updateStore(prev => next)`** and must be immutable. Never mutate `store`, a board, a list or a ticket in place; the storage layer compares object identity to decide what to write.

**Normalise anything entering the app.** Data from storage, JSON import, or a parsed Mermaid source goes through `normalizeStore` / `normalizeBoard` in `src/kanban/store.ts`. Type external input as `unknown` and narrow it there — do not cast.

**Ids are generated, never derived.** Use `createBoardId`, `createListId`, `createTicketNodeId`. Ids must stay `[A-Za-z0-9_]` because they are Mermaid node ids, and they must be stable: the Mermaid round trip re-attaches descriptions and WIP limits by id.

**`boardToMermaid` and `parseMermaidKanban` must stay inverses.** If you touch either, update both, and re-check escaping for `"`, `'`, `:`, `,`, `{}`, `@{` and newlines in titles and metadata values. Mermaid cannot express ticket descriptions or list WIP limits; those are merged back in `mergeParsedIntoBoard`. Do not invent a Mermaid syntax extension to carry them.

**Reserved metadata keys** are `ticket`, `assigned`, `priority`, `label`, `icon`, `shape` (`RESERVED_METADATA_KEYS` in `src/kanban/data.ts`). Mermaid consumes them itself, so the ticket form rejects them. Keep client and any server validation in sync.

**Mermaid is dynamically imported** in `src/components/MermaidDiagram.tsx` to keep it out of the initial bundle. Do not add a static `import mermaid from 'mermaid'` anywhere.

**Styling goes in `src/components/styles.module.scss`** using the existing CSS custom properties, and must work in all four themes (`pink`, `light`, `dark`, `contrast`). Themes are scoped to `[data-kanban-theme]` on the app's own wrapper — never style `html` or `body` from the module, and never hard-code a colour that a theme should control.

**The app must keep working with no backend.** GitHub Pages serves static files only: no server-side rendering, no API assumed at runtime, no build step that needs network access. Anything backend-dependent must degrade to the localStorage path.

## Adding a feature: where things go

| Change | Files |
| --- | --- |
| New field on a ticket/list/board | `kanban/types.ts`, `normalize*` in `kanban/store.ts`, the form in `components/modals.tsx`, and `kanban/mermaid.ts` if it should survive a round trip |
| New Mermaid syntax support | `kanban/mermaid.ts` (both directions) |
| New backend | a class in `src/storage/`, wired in `createStorageAdapter()` |
| New view/tab | `VIEWS` in `src/preferences.ts` plus a panel in `components/KanbanManager.tsx` |
| Docs a user would read | `docs/user-guide.md` |

Update `docs/` in the same change as the behaviour. A stale user guide is a bug.

## Style

- Match the surrounding code: named exports, `function` declarations for components, `useCallback` for handlers passed down, `clsx` for conditional classes.
- Comments explain a constraint or trade-off that the code cannot show. Do not narrate what the next line does, and do not leave comments describing your change or its history.
- No `any`, no non-null `!` on external data, no `@ts-ignore`.
- User-facing copy is plain sentences with no emoji.
