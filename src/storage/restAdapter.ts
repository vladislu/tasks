import type {KanbanStore} from '../kanban/types';
import type {StorageAdapter} from './types';

export interface RestAdapterOptions {
  /** API root without a trailing slash, e.g. https://api.example.com */
  baseUrl: string;
  /** Optional bearer token. See the warning in .env.example. */
  token?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Backend for a real database, speaking the contract in docs/database.md:
 *
 *   GET /store -> 200 KanbanStore | 404 (nothing stored yet)
 *   PUT /store <- KanbanStore, 200/204 on success
 *
 * The whole store is sent as one document, which keeps the client simple and
 * matches how the UI already works. docs/database.md describes how to move to
 * per-board or per-ticket endpoints when concurrent editing becomes a concern.
 */
export class RestAdapter implements StorageAdapter {
  readonly label: string;
  readonly isLocal = false;

  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor({baseUrl, token, fetchImpl}: RestAdapterOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.label = safeHost(this.baseUrl);
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {'content-type': 'application/json'};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    return headers;
  }

  async load(): Promise<KanbanStore | null> {
    const response = await this.fetchImpl(`${this.baseUrl}/store`, {
      headers: this.headers(),
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `Loading boards failed: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as KanbanStore;
  }

  async save(store: KanbanStore): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/store`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(store),
    });

    if (!response.ok) {
      throw new Error(
        `Saving boards failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
