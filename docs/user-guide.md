# User guide

Tasks is a Kanban board that keeps a Mermaid diagram of itself. Everything you create is saved automatically — the badge next to the title tells you where it went and whether the last save succeeded.

## The three views

Switch with the tabs in the toolbar:

- **Board** — the interactive Kanban board. This is where you edit.
- **Diagram** — the same board rendered by Mermaid. Copy the source or download a `.mmd` file.
- **Mermaid source** — the diagram as text, editable. Paste a diagram from elsewhere and apply it to the board.

## Boards

The toolbar's **Board** picker switches between boards, and the buttons beside it create, duplicate and delete them.

**Settings** opens the board's own options:

- **Name** and **description** — the description shows under the toolbar.
- **Ticket prefix** — the prefix for generated ids, e.g. `TASK` produces `TASK-1`, `TASK-2`. Letters, digits, `_` and `-` only; it is upper-cased for you.
- **Ticket link template** — a URL with `#TICKET#` where the id belongs, for example `https://your-tracker/browse/#TICKET#`. Ticket ids then become links on the cards and inside the diagram.

Deleting a board asks first and cannot be undone, so export before you clean up.

## Lists

**+ Add list** appends a column. Each list has a title and an optional **WIP limit** — when a list holds more tickets than its limit, its counter turns red. Nothing is blocked; it is a signal, not a gate.

Lists can be reordered by dragging their header, renamed, cleared and deleted. Deleting a list deletes the tickets inside it.

## Tickets

**+ Add ticket** inside a list opens the ticket form:

- **Title** — required, and the only required field.
- **Ticket id** — pre-filled with the next id for this board (`TASK-7`). Clear it if a ticket should have no id. Ids reused across the board are flagged as duplicates under the toolbar.
- **Assignee** and **priority** — both optional. Priority tints the card's left edge, from Very High down to Very Low.
- **Description** — free text. Kept in the app, but not part of the Mermaid diagram (see below).
- **Metadata** — any key/value pairs you want, e.g. `sprint: 24` or `repo: api`. Keys are lower-cased and stripped of characters Mermaid cannot carry. A handful of keys are reserved because Mermaid already uses them: `ticket`, `assigned`, `priority`, `label`, `icon`, `shape`.

### Form layout

The **New** switch beside the form's close button widens it into two columns: every field on the left, the description alone on the right, where it grows as tall as the fields beside it. Turn it off for the single-column form. Like the theme, the choice is remembered on this device and applies to both creating and editing a ticket.

### Moving tickets

Drag a card to another list, or drop it between cards to reorder. The arrow buttons on each card move it one list left or right, which is often faster and works without a mouse.

### Finding tickets

The search box (or `Ctrl`/`Cmd` + `K`) filters cards as you type across titles, ids, assignees, descriptions and metadata. Non-matching cards are hidden and the count appears next to the box; `Esc` clears the search.

## Mermaid round trips

**Diagram** and **Mermaid source** show the same board as a `kanban` diagram, so you can paste it into anything that renders Mermaid — GitHub Markdown, Confluence, Docusaurus, Obsidian.

Editing the source and pressing **Apply to board** replaces the board's lists with what you typed. Two fields are not expressible in Mermaid and are re-attached afterwards by matching node ids: **ticket descriptions** and **list WIP limits**. If you rename a node id in the source, the ticket keeps its title but loses its description. Anything the parser could not use is reported as a warning under the editor.

## Import, export, reset

- **Export JSON** downloads every board, ready to import elsewhere. This is the backup format.
- **Import JSON** accepts a previous export or a single board object and adds those boards alongside the existing ones — nothing is overwritten, and ids are renumbered if they would collide.
- **Download .mmd** saves the current board's diagram source.
- **Reset** replaces every board with the starter board. It asks first, and export is the only way back.

## Themes

Four themes — pink, light, dark and high contrast. The choice is remembered on this device and never leaves it, even when boards are stored on a server.

## Where your data lives

With no backend configured, boards are saved in this browser's `localStorage`: private to this browser and this device, and cleared if you wipe site data. Export regularly if the boards matter. When an administrator configures a backend, the badge names the host instead, and the same boards follow you between devices.
