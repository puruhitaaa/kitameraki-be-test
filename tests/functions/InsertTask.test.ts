import { beforeEach, describe, expect, it } from 'vitest';
import { InsertTask } from '../../src/functions/InsertTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('InsertTask', () => {
  let tasksContainer: MockCosmosContainer;
  let formSettingsContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    formSettingsContainer = mock.formSettingsContainer;
    setCosmosClient(mock.mockClient);
  });

  it('creates task and returns 201 on valid input (server-generated id)', async () => {
    const payload = {
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
    const body = res.jsonBody as { id: string; status: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(res.jsonBody).toMatchObject({
      organizationId: 'org-test',
      title: 'Valid New Task',
      status: 'in-progress',
    });

    // Verify persisted in mock storage under the server-generated id
    expect(tasksContainer.itemsMap.size).toBe(1);
    const [key] = tasksContainer.itemsMap.keys();
    expect(key.startsWith('org-test:')).toBe(true);
  });

  it('ignores client-supplied id and server-owned fields', async () => {
    const payload = {
      id: 'client-id',
      organizationId: 'org-test',
      title: 'Task with client-supplied system fields',
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
      _rid: 'x',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(201);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.id).not.toBe('client-id');

    const [persisted] = tasksContainer.itemsMap.values();
    expect(persisted.id).not.toBe('client-id');
    expect(persisted).not.toHaveProperty('createdAt');
    expect(persisted).not.toHaveProperty('updatedAt');
    expect(persisted).not.toHaveProperty('_rid');
  });

  it('accepts configured custom fields', async () => {
    formSettingsContainer.seed([
      {
        id: 'default',
        organizationId: 'org-test',
        fields: [
          {
            id: 'f1',
            name: 'clientEmail',
            label: 'Client Email',
            type: 'email',
            row: 0,
            column: 0,
            required: false,
          },
        ],
      },
    ]);

    const payload = {
      organizationId: 'org-test',
      title: 'Task with custom field',
      clientEmail: 'a@b.com',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(201);
    const [persisted] = tasksContainer.itemsMap.values();
    expect(persisted.clientEmail).toBe('a@b.com');
  });

  it('rejects unconfigured custom fields with 400', async () => {
    // No form settings seeded: fallback is empty field list, so any custom key is unknown.
    const payload = {
      organizationId: 'org-test',
      title: 'Task with unknown custom field',
      unknownField: 'x',
    };

    const req = createMockRequest({ method: 'POST', body: payload });
    const res = await InsertTask(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
  });

  it('rejects type-mismatched custom field values with 400', async () => {
    formSettingsContainer.seed([
      {
        id: 'default',
        organizationId: 'org-test',
        fields: [
          {
            id: 'f1',
            name: 'clientEmail',
            label: 'Client Email',
            type: 'email',
            row: 0,
            column: 0,
            required: false,
          },
        ],
      },
    ]);

    for (const clientEmail of [42, 'not-an-email']) {
      const req = createMockRequest({
        method: 'POST',
        body: {
          organizationId: 'org-test',
          title: 'Task with bad email',
          clientEmail,
        },
      });
      const res = await InsertTask(req, createMockContext());

      expect(res.status).toBe(400);
      expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
    }
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
