import { beforeEach, describe, expect, it } from 'vitest';
import { DeleteTask } from '../../src/functions/DeleteTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('DeleteTask', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);

    tasksContainer.seed([
      {
        id: 'task-del-1',
        organizationId: 'org-d',
        title: 'Task To Delete',
        status: 'todo',
      },
    ]);
  });

  it('deletes task successfully and returns 200', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { id: 'task-del-1', organizationId: 'org-d' },
    });

    const res = await DeleteTask(req, createMockContext());

    expect(res.status).toBe(200);
    expect(tasksContainer.itemsMap.has('org-d:task-del-1')).toBe(false);
  });

  it('returns 404 when task to delete does not exist', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { id: 'non-existent-task', organizationId: 'org-d' },
    });

    const res = await DeleteTask(req, createMockContext());

    expect(res.status).toBe(404);
    expect(res.jsonBody).toMatchObject({
      error: "Task with ID 'non-existent-task' was not found",
    });
  });

  it('returns 400 when id is missing', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { organizationId: 'org-d' },
    });

    const res = await DeleteTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'id' is required.",
    });
  });
});
