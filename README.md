# Tasks

A Kanban board that is also a [Mermaid kanban diagram](https://mermaid.js.org/syntax/kanban.html). Create boards, lists and tickets with generated ticket ids and arbitrary metadata, then copy the diagram source straight into a Markdown file, a pull request, or a wiki page.

It is a static single-page React app: no server, no account, no build-time data. It runs on GitHub Pages and works offline, and the persistence layer is a swappable adapter so boards can move to a real database later without touching the UI.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |

Requires Node 20.19 or newer.

## Documentation

| Document | Audience |
| --- | --- |
| [docs/user-guide.md](docs/user-guide.md) | People using the board |
| [docs/architecture.md](docs/architecture.md) | Developers changing the code |
| [docs/database.md](docs/database.md) | Wiring a backend / database |
| [AGENTS.md](AGENTS.md) | AI coding agents working in this repo |

## Where data is stored

By default every board lives in this browser's `localStorage`, which is what makes GitHub Pages hosting possible. The header badge always names the current backend, and the JSON export is the escape hatch for moving boards elsewhere.

Setting `VITE_API_BASE_URL` switches the app to a REST backend instead; see [docs/database.md](docs/database.md) for the contract and [`.env.example`](.env.example) for the variables.

## Deploying to GitHub Pages

1. Push this project to a GitHub repository.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes it.

The workflow passes `BASE_PATH=/<repo-name>/` so asset URLs match a project site at `https://<user>.github.io/<repo>/`. For a user or organisation site (`<user>.github.io`), remove that `env` block so the base stays `/`.

## License

MIT
