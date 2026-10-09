import type { Container, CosmosClient, PatchOperation, SqlQuerySpec } from '@azure/cosmos';

export interface StoredDocument {
  id: string;
  organizationId: string;
  [key: string]: unknown;
}

export class MockCosmosContainer {
  public itemsMap = new Map<string, StoredDocument>();

  private makeKey(id: string, partitionKey: string): string {
    return `${partitionKey}:${id}`;
  }

  public seed(items: StoredDocument[]): void {
    this.itemsMap.clear();
    for (const item of items) {
      this.itemsMap.set(this.makeKey(item.id, item.organizationId), structuredClone(item));
    }
  }

  public get items() {
    return {
      query: <T = StoredDocument>(querySpec: SqlQuerySpec | string) => {
        let sql = typeof querySpec === 'string' ? querySpec : querySpec.query;
        const params: Record<string, unknown> = {};
        if (typeof querySpec === 'object' && querySpec.parameters) {
          for (const p of querySpec.parameters) {
            params[p.name] = p.value;
          }
        }

        return {
          fetchAll: async () => {
            let list = Array.from(this.itemsMap.values());
            const orgId = params['@organizationId'] as string | undefined;
            if (orgId !== undefined) {
              list = list.filter((doc) => doc.organizationId === orgId);
            }

            const search = params['@search'] as string | undefined;
            if (search) {
              const sLower = search.toLowerCase();
              list = list.filter((doc) => {
                const titleMatch = typeof doc.title === 'string' && doc.title.toLowerCase().includes(sLower);
                const descMatch = typeof doc.description === 'string' && doc.description.toLowerCase().includes(sLower);
                const tagsMatch = Array.isArray(doc.tags) && doc.tags.some((t: unknown) => String(t) === search);
                return titleMatch || descMatch || tagsMatch;
              });
            }

            const statuses = params['@statuses'] as string[] | undefined;
            if (statuses && statuses.length > 0) {
              list = list.filter((doc) => statuses.includes(String(doc.status)));
            }

            const priorities = params['@priorities'] as string[] | undefined;
            if (priorities && priorities.length > 0) {
              list = list.filter((doc) => priorities.includes(String(doc.priority)));
            }

            if (sql.includes('SELECT VALUE COUNT(1)')) {
              return { resources: [list.length] as unknown as T[] };
            }

            const orderMatch = sql.match(/ORDER BY c\.(\w+)\s+(ASC|DESC)/i);
            if (orderMatch) {
              const [, field, direction] = orderMatch;
              const isDesc = direction.toUpperCase() === 'DESC';
              list.sort((a, b) => {
                const valA = a[field] ?? '';
                const valB = b[field] ?? '';
                if (valA < valB) return isDesc ? 1 : -1;
                if (valA > valB) return isDesc ? -1 : 1;
                return 0;
              });
            }

            const offset = typeof params['@offset'] === 'number' ? params['@offset'] : 0;
            const limit = typeof params['@limit'] === 'number' ? params['@limit'] : list.length;
            const paginated = list.slice(offset, offset + limit);

            return { resources: structuredClone(paginated) as unknown as T[] };
          },
        };
      },
      create: async (doc: StoredDocument) => {
        const copy = structuredClone(doc);
        this.itemsMap.set(this.makeKey(copy.id, copy.organizationId), copy);
        return { resource: copy };
      },
      upsert: async (doc: StoredDocument) => {
        const copy = structuredClone(doc);
        this.itemsMap.set(this.makeKey(copy.id, copy.organizationId), copy);
        return { resource: copy };
      },
    };
  }

  public item(id: string, partitionKey: string) {
    const key = this.makeKey(id, partitionKey);
    return {
      read: async () => {
        const found = this.itemsMap.get(key);
        if (!found) {
          const err = new Error('Resource Not Found');
          Object.assign(err, { code: 404, statusCode: 404 });
          throw err;
        }
        return { resource: structuredClone(found) };
      },
      patch: async (operations: PatchOperation[]) => {
        const found = this.itemsMap.get(key);
        if (!found) {
          const err = new Error('Resource Not Found');
          Object.assign(err, { code: 404, statusCode: 404 });
          throw err;
        }
        const updated = structuredClone(found);
        for (const op of operations) {
          if (op.op === 'set') {
            const cleanKey = op.path
              .replace(/^\//, '')
              .replace(/~1/g, '/')
              .replace(/~0/g, '~');
            updated[cleanKey] = op.value;
          }
        }
        this.itemsMap.set(key, updated);
        return { resource: updated };
      },
      delete: async () => {
        const exists = this.itemsMap.has(key);
        if (!exists) {
          const err = new Error('Resource Not Found');
          Object.assign(err, { code: 404, statusCode: 404 });
          throw err;
        }
        this.itemsMap.delete(key);
        return { resource: undefined };
      },
    };
  }
}

export function createMockCosmosClient(): {
  mockClient: CosmosClient;
  tasksContainer: MockCosmosContainer;
  formSettingsContainer: MockCosmosContainer;
} {
  const tasksContainer = new MockCosmosContainer();
  const formSettingsContainer = new MockCosmosContainer();

  const mockClient = {
    database: (name: string) => ({
      container: (containerName: string) => {
        if (containerName === 'FormSettings') {
          return formSettingsContainer as unknown as Container;
        }
        return tasksContainer as unknown as Container;
      },
    }),
  } as unknown as CosmosClient;

  return {
    mockClient,
    tasksContainer,
    formSettingsContainer,
  };
}
