# Storage and future database

The UI only knows two operations. Everything else about persistence is an implementation detail behind `StorageAdapter`:

```ts
// src/storage/types.ts
export interface StorageAdapter {
  readonly label: string;   // shown in the header badge
  readonly isLocal: boolean; // drives the "export to move devices" hint
  load(): Promise<KanbanStore | null>; // null = nothing stored yet
  save(store: KanbanStore): Promise<void>;
}
```

Both calls are already `async` and both failure paths are already handled in the UI, so adding a network backend does not change a single component.

## Today: localStorage

`LocalStorageAdapter` keeps the whole store as JSON under `tasks-kanban-store`. If that value is ever unparseable it is copied to `tasks-kanban-store-corrupt-backup` and an error is surfaced instead of being thrown away.

This is the mode GitHub Pages runs in: no server, offline capable, data private to the browser.

## Switching backends

`createStorageAdapter()` reads build-time config:

```bash
VITE_API_BASE_URL=https://api.example.com   # empty -> localStorage
VITE_API_TOKEN=                             # optional bearer token
```

`VITE_` variables are compiled into the public bundle. Never put a real secret there — for anything user-specific, authenticate with a cookie or an interactive login and drop `VITE_API_TOKEN`.

## The REST contract

`RestAdapter` speaks the smallest possible API — one document, two verbs:

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/store` | — | `200` `KanbanStore` · `404` when nothing is stored yet |
| `PUT` | `/store` | `KanbanStore` | `200` or `204` |

Requests send `content-type: application/json` and, when configured, `authorization: Bearer <token>`. Any other non-2xx status is surfaced to the user as a failed save, and the client retries the same payload when they press **Retry**.

`KanbanStore` is the shape in `src/kanban/types.ts`; `version` exists so a server can recognise and migrate older documents.

## Suggested relational schema

The document API is the fastest route to a working backend, but the data is relational and a server that intends to query it (reports, cross-board search, per-user permissions) should store it as tables:

```sql
create table boards (
  id              text primary key,
  owner_id        text not null,
  name            text not null,
  description     text,
  ticket_prefix   text not null default 'TASK',
  ticket_counter  integer not null default 0,
  ticket_base_url text,
  position        integer not null,
  created_at      timestamptz not null,
  updated_at      timestamptz not null
);

create table lists (
  id        text primary key,
  board_id  text not null references boards(id) on delete cascade,
  title     text not null,
  wip_limit integer,
  position  integer not null
);

create table tickets (
  id          text primary key,
  list_id     text not null references lists(id) on delete cascade,
  title       text not null,
  ticket_ref  text,             -- 'TASK-42', unique per board, nullable
  assigned    text,
  priority    text,             -- see TicketPriority
  description text,
  position    integer not null,
  created_at  timestamptz not null,
  updated_at  timestamptz not null
);

-- Metadata is user-defined, so it stays key/value rather than columns.
create table ticket_metadata (
  ticket_id text not null references tickets(id) on delete cascade,
  key       text not null,
  value     text not null,
  primary key (ticket_id, key)
);

create index tickets_list_position on tickets (list_id, position);
```

Ticket refs are unique per board, not per list, so enforcing that needs `board_id` denormalised onto `tickets` plus `create unique index on tickets (board_id, ticket_ref)`. Uniqueness is currently a warning in the UI rather than a constraint — decide deliberately whether the database should reject duplicates or keep tolerating them.

Notes that matter when mapping to these tables:

- **Ids are client-generated** (`tkt_…`, `list_…`, `board_…`) and safe as primary keys. Keep them — the Mermaid source uses the same ids as node ids, so rewriting them server-side breaks description/WIP-limit merging on round trips.
- **Order is explicit.** JSON array order becomes a `position` column; drag and drop rewrites positions.
- **`ticket_counter` must be server-owned** once several clients share a board, otherwise two users generate `TASK-7` at the same time. The UI already tolerates duplicates by flagging them, but a server should hand out ids instead.
- **Reserved metadata keys** (`ticket`, `assigned`, `priority`, `label`, `icon`, `shape`) are rejected by the client because Mermaid uses them; validate the same set server-side.

## Moving beyond one document

Whole-store `PUT` is last-write-wins: two people editing the same board will overwrite each other, silently. It is fine for a single user across devices, and not fine for a team. When that becomes a requirement:

1. **Add optimistic concurrency first.** Return an `ETag` from `GET /store`, require `If-Match` on `PUT`, and treat `412` as "reload and reapply" in `RestAdapter.save`. This is a few lines of adapter code and removes the silent data loss.
2. **Then narrow the writes.** Extend `StorageAdapter` with optional granular methods (`saveTicket`, `moveTicket`, `deleteList`, …). `useKanbanStore` can call them when present and fall back to `save()` when they are not, so the localStorage adapter stays a five-line class.
3. **Then push updates.** Server-sent events or a WebSocket feeding `updateStore` gives live collaboration. The store is already replaced immutably from the outside, so incoming remote state fits the existing flow.

## Checklist for adding a backend

1. Implement the two methods (or reuse `RestAdapter` if you can match the contract).
2. Validate and normalise on the server as well — `normalizeStore` protects the client, not the database.
3. Set `VITE_API_BASE_URL` in the deploy environment. Note that GitHub Pages is a static host: the API must be reachable from the browser with CORS enabled for the Pages origin.
4. Keep JSON import/export working. It is the users' backup and migration path, and the fastest way to seed a new backend from existing local boards.
