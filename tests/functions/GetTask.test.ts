import { beforeEach, describe, expect, it } from 'vitest';
import { GetTask } from '../../src/functions/GetTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('GetTask', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);

    tasksContainer.seed([
      {
        id: 'task-100',
        organizationId: 'org-1',
        title: 'Single Task Test',
        status: 'todo',
        priority: 'high',
      },
    ]);
  });

  it('returns task when found', async () => {
    const req = createMockRequest({
      query: { id: 'task-100', organizationId: 'org-1' },
    });
    const res = await GetTask(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      id: 'task-100',
      title: 'Single Task Test',
      priority: 'high',
    });
  });

  it('returns 404 when task does not exist', async () => {
    const req = createMockRequest({
      query: { id: 'non-existent-task', organizationId: 'org-1' },
    });
    const res = await GetTask(req, createMockContext());

    expect(res.status).toBe(404);
    expect(res.jsonBody).toMatchObject({
      error: "Task with ID 'non-existent-task' was not found",
    });
  });

  it('returns 400 when id is missing', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-1' },
    });
    const res = await GetTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'id' is required.",
    });
  });

  it('returns 400 when organizationId is missing', async () => {
    const req = createMockRequest({
      query: { id: 'task-100' },
    });
    const res = await GetTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'organizationId' is required.",
    });
  });
});
