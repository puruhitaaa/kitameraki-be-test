import { beforeEach, describe, expect, it } from 'vitest';
import { UpdateTask } from '../../src/functions/UpdateTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('UpdateTask', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);

    tasksContainer.seed([
      {
        id: 'task-u1',
        organizationId: 'org-u',
        title: 'Original Title',
        description: 'Original Description',
        status: 'todo',
        priority: 'low',
      },
    ]);
  });

  it('updates allowed task fields and returns 200', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: {
        title: 'Updated Title',
        status: 'completed',
      },
    });

    const res = await UpdateTask(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      id: 'task-u1',
      organizationId: 'org-u',
      title: 'Updated Title',
      status: 'completed',
      description: 'Original Description',
    });
  });

  it('rejects attempt to modify partition key organizationId (400 Bad Request)', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: {
        organizationId: 'different-org-id',
      },
    });

    const res = await UpdateTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed',
    });
  });

  it('rejects attempt to modify document id or internal metadata (400 Bad Request)', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: {
        id: 'new-id',
        _rid: 'fake-rid',
      },
    });

    const res = await UpdateTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed',
    });
  });

  it('returns 400 Bad Request when update payload is empty', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: {},
    });

    const res = await UpdateTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed',
    });
  });

  it('returns 404 Not Found when task does not exist', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'missing-id', organizationId: 'org-u' },
      body: { title: 'New Title' },
    });

    const res = await UpdateTask(req, createMockContext());

    expect(res.status).toBe(404);
    expect(res.jsonBody).toMatchObject({
      error: "Task with ID 'missing-id' was not found",
    });
  });
});
