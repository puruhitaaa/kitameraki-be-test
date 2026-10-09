import { beforeEach, describe, expect, it } from 'vitest';
import { BulkDeleteTasks } from '../../src/functions/BulkDeleteTasks';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('BulkDeleteTasks', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);

    tasksContainer.seed([
      { id: 'b1', organizationId: 'org-bulk', title: 'Task B1', status: 'todo' },
      { id: 'b2', organizationId: 'org-bulk', title: 'Task B2', status: 'todo' },
      { id: 'b3', organizationId: 'org-bulk', title: 'Task B3', status: 'todo' },
    ]);
  });

  it('awaits and deletes all specified tasks in batch', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: ['b1', 'b2'],
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      totalRequested: 2,
      deletedCount: 2,
      failedCount: 0,
      failures: [],
    });

    // Verify deleted in in-memory storage
    expect(tasksContainer.itemsMap.has('org-bulk:b1')).toBe(false);
    expect(tasksContainer.itemsMap.has('org-bulk:b2')).toBe(false);
    expect(tasksContainer.itemsMap.has('org-bulk:b3')).toBe(true);
  });

  it('reports failed deletions when some items do not exist without failing entire batch', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: ['b1', 'non-existent-b'],
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      totalRequested: 2,
      deletedCount: 1,
      failedCount: 1,
    });
    const body = res.jsonBody as { failures: Array<{ id: string; reason: string }> };
    expect(body.failures[0].id).toBe('non-existent-b');
    expect(body.failures[0].reason).toBe('Task not found');
  });

  it('rejects empty array with 400 Bad Request', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: [],
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed: expected a non-empty array of task IDs',
    });
  });

  it('rejects non-array body with 400 Bad Request', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: { notAnArray: true },
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed: expected a non-empty array of task IDs',
    });
  });

  it('rejects batch exceeding 100 tasks with 400 Bad Request', async () => {
    const over100Ids = Array.from({ length: 101 }, (_, i) => `task-${i}`);
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: over100Ids,
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed: expected a non-empty array of task IDs',
    });
  });

  it('sanitizes unexpected database error messages to avoid information disclosure', async () => {
    // Override delete on tasksContainer to throw an internal DB connection error
    const originalItem = tasksContainer.item.bind(tasksContainer);
    tasksContainer.item = (id: string, partitionKey: string) => {
      const itemHandler = originalItem(id, partitionKey);
      return {
        ...itemHandler,
        delete: async () => {
          throw new Error('CosmosDB connection timeout at 10.0.4.15:443 with secret key xyz');
        },
      };
    };

    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-bulk' },
      body: ['b1'],
    });

    const res = await BulkDeleteTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { failures: Array<{ id: string; reason: string }> };
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0].reason).toBe('Failed to delete task');
    expect(body.failures[0].reason).not.toContain('CosmosDB connection timeout');
  });
});
