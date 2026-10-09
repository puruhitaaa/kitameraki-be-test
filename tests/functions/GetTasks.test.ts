import { beforeEach, describe, expect, it } from 'vitest';
import { GetTasks } from '../../src/functions/GetTasks';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('GetTasks', () => {
  let tasksContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    tasksContainer = mock.tasksContainer;
    setCosmosClient(mock.mockClient);

    tasksContainer.seed([
      {
        id: 'task-1',
        organizationId: 'org-aaa',
        title: 'Task Alpha',
        status: 'todo',
      },
      {
        id: 'task-2',
        organizationId: 'org-aaa',
        title: 'Task Beta',
        status: 'in-progress',
      },
      {
        id: 'task-3',
        organizationId: 'org-bbb',
        title: 'Confidential Task Org B',
        status: 'todo',
      },
    ]);
  });

  it('returns only tasks belonging to the requested organization', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-aaa' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as Array<{ id: string; title: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((t) => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('prevents SQL injection attack and does not leak tasks of other tenants', async () => {
    // Attempt SQL injection through organizationId query parameter
    const maliciousPayload = "' OR '1'='1";
    const req = createMockRequest({ query: { organizationId: maliciousPayload } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as Array<{ id: string }>;
    // Parameterized query matches literal value, never evaluates raw SQL boolean
    expect(body).toHaveLength(0);
  });

  it('returns 400 Bad Request when organizationId is missing or empty', async () => {
    const req = createMockRequest({ query: {} });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'organizationId' is required.",
    });
  });

  it('returns empty array when organization has no tasks', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-empty' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual([]);
  });
});
