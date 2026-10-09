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
    const body = res.jsonBody as { failures: Array<{ id: string }> };
    expect(body.failures[0].id).toBe('non-existent-b');
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
});
