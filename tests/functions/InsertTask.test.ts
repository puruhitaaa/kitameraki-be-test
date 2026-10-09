import { beforeEach, describe, expect, it } from 'vitest';
import { InsertTask } from '../../src/functions/InsertTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('InsertTask', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);
  });

  it('creates task and returns 201 on valid input', async () => {
    const payload = {
      id: 'custom-uuid-1',
      organizationId: 'org-test',
      title: 'Valid New Task',
      description: 'A test description',
      status: 'in-progress',
      priority: 'high',
      tags: ['backend', 'test'],
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(201);
    expect(res.jsonBody).toMatchObject({
      id: 'custom-uuid-1',
      organizationId: 'org-test',
      title: 'Valid New Task',
      status: 'in-progress',
    });

    // Verify persisted in mock storage
    expect(tasksContainer.itemsMap.has('org-test:custom-uuid-1')).toBe(true);
  });

  it('generates a UUID id when id is omitted from input', async () => {
    const payload = {
      organizationId: 'org-test',
      title: 'Task without explicit id',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(201);
    const body = res.jsonBody as { id: string; status: string };
    expect(body.id).toBeDefined();
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.status).toBe('todo'); // Default status
  });

  it('returns 400 Bad Request when title is empty', async () => {
    const payload = {
      organizationId: 'org-test',
      title: '',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
  });

  it('returns 400 Bad Request when status is invalid enum', async () => {
    const payload = {
      organizationId: 'org-test',
      title: 'Invalid Status Task',
      status: 'not-a-valid-status',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
  });

  it('returns 400 Bad Request when request body is not valid JSON', async () => {
    const req = createMockRequest({ method: 'POST', body: undefined });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Request body must be valid JSON' });
  });
});
