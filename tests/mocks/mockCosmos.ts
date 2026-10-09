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
      query: (querySpec: SqlQuerySpec | string) => {
        let orgIdParam: string | undefined;

        if (typeof querySpec === 'object' && querySpec.parameters) {
          const match = querySpec.parameters.find(
            (p) => p.name === '@organizationId',
          );
          if (match) {
            orgIdParam = String(match.value);
          }
        }

        return {
          fetchAll: async () => {
            const all = Array.from(this.itemsMap.values());
            const filtered = orgIdParam
              ? all.filter((doc) => doc.organizationId === orgIdParam)
              : all;
            return { resources: structuredClone(filtered) };
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
