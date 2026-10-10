import { beforeEach, describe, expect, it } from 'vitest';
import { escapeJsonPointer, UpdateTask } from '../../src/functions/UpdateTask';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('UpdateTask', () => {
  let tasksContainer: MockCosmosContainer;
  let formSettingsContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    formSettingsContainer = mock.formSettingsContainer;
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

  it('rejects prototype pollution keys with 400 Bad Request', async () => {
    const cases = [
      JSON.parse('{"__proto__": {"polluted": true}}'),
      { constructor: 'polluted' },
      { prototype: 'polluted' },
    ];

    for (const body of cases) {
      const req = createMockRequest({
        method: 'POST',
        query: { id: 'task-u1', organizationId: 'org-u' },
        body,
      });

      const res = await UpdateTask(req, createMockContext());
      expect(res.status).toBe(400);
      expect(res.jsonBody).toMatchObject({
        error: 'Validation failed',
      });
    }
  });

  it('escapes JSON pointer characters per RFC 6901 without corrupting patch paths', async () => {
    expect(escapeJsonPointer('title')).toBe('/title');
    expect(escapeJsonPointer('custom/field')).toBe('/custom~1field');
    expect(escapeJsonPointer('custom~field')).toBe('/custom~0field');
    expect(escapeJsonPointer('a/b~c/d')).toBe('/a~1b~0c~1d');

    // NOTE: `/` and `~` can no longer appear in custom field names (FIELD_NAME_REGEX
    // forbids them), so only regex-safe names can be patched over HTTP. The RFC-6901
    // escaping above remains as pure unit coverage.
    formSettingsContainer.seed([
      {
        id: 'default',
        organizationId: 'org-u',
        fields: [
          {
            id: 'f1',
            name: 'customNote',
            label: 'Custom Note',
            type: 'text',
            row: 0,
            column: 0,
            required: false,
          },
        ],
      },
    ]);

    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: {
        customNote: 'hello',
        title: 'T2',
      },
    });

    const res = await UpdateTask(req, createMockContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      id: 'task-u1',
      customNote: 'hello',
      title: 'T2',
    });
  });

  it('rejects invalid known-field values with 400', async () => {
    for (const body of [{ status: 'not-a-valid-status' }, { title: 123 }]) {
      const req = createMockRequest({
        method: 'POST',
        query: { id: 'task-u1', organizationId: 'org-u' },
        body,
      });

      const res = await UpdateTask(req, createMockContext());
      expect(res.status).toBe(400);
      expect(res.jsonBody).toMatchObject({
        error: 'Validation failed',
      });
    }
  });

  it('rejects unconfigured custom fields with 400', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: { unknownField: 'x' },
    });

    const res = await UpdateTask(req, createMockContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: 'Validation failed',
    });
  });

  it('silently drops createdAt/updatedAt overwrites while applying allowed fields', async () => {
    // createdAt is a reserved name and can never be a configured custom field,
    // so the patch allowlist drops it instead of rejecting the request.
    const req = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: { title: 'X', createdAt: '2000-01-01T00:00:00.000Z' },
    });

    const res = await UpdateTask(req, createMockContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ id: 'task-u1', title: 'X' });

    const persisted = tasksContainer.itemsMap.get('org-u:task-u1')!;
    expect(persisted.title).toBe('X');
    expect(persisted).not.toHaveProperty('createdAt');
  });

  it('validates custom field value types against form settings', async () => {
    formSettingsContainer.seed([
      {
        id: 'default',
        organizationId: 'org-u',
        fields: [
          {
            id: 'f1',
            name: 'followUp',
            label: 'Follow Up',
            type: 'datetime',
            row: 0,
            column: 0,
            required: false,
          },
        ],
      },
    ]);

    const badReq = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: { followUp: 'not-a-date' },
    });
    const badRes = await UpdateTask(badReq, createMockContext());
    expect(badRes.status).toBe(400);
    expect(badRes.jsonBody).toMatchObject({ error: 'Validation failed' });

    const goodReq = createMockRequest({
      method: 'POST',
      query: { id: 'task-u1', organizationId: 'org-u' },
      body: { followUp: '2026-01-01T00:00:00.000Z' },
    });
    const goodRes = await UpdateTask(goodReq, createMockContext());
    expect(goodRes.status).toBe(200);
    expect(goodRes.jsonBody).toMatchObject({ followUp: '2026-01-01T00:00:00.000Z' });
  });
});
