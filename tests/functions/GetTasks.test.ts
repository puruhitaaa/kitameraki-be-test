import { beforeEach, describe, expect, it } from 'vitest';
import { GetTasks } from '../../src/functions/GetTasks';
import { PaginatedTasksResult } from '../../src/models/taskQuery';
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
        description: 'Alpha details',
        priority: 'high',
        status: 'todo',
        tags: ['urgent'],
      },
      {
        id: 'task-2',
        organizationId: 'org-aaa',
        title: 'Task Beta',
        description: 'Beta details',
        priority: 'low',
        status: 'in-progress',
        tags: ['routine'],
      },
      {
        id: 'task-3',
        organizationId: 'org-bbb',
        title: 'Confidential Task Org B',
        priority: 'high',
        status: 'todo',
        tags: ['secret'],
      },
    ]);
  });

  it('returns only tasks belonging to the requested organization in paginated envelope', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-aaa' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(2);
    expect(body.filteredCount).toBe(2);
    expect(body.page).toBe(0);
    expect(body.pageSize).toBe(10);
    expect(body.totalPages).toBe(1);
    expect(body.items.map((t) => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('supports pagination with page and pageSize', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-aaa', page: '0', pageSize: '1' },
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(2);
    expect(body.filteredCount).toBe(2);
    expect(body.totalPages).toBe(2);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('task-1');

    const reqPage1 = createMockRequest({
      query: { organizationId: 'org-aaa', page: '1', pageSize: '1' },
    });
    const resPage1 = await GetTasks(reqPage1, createMockContext());
    const bodyPage1 = resPage1.jsonBody as PaginatedTasksResult;
    expect(bodyPage1.items).toHaveLength(1);
    expect(bodyPage1.items[0].id).toBe('task-2');
  });

  it('filters by search keyword matching title, description, or tags', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-aaa', search: 'Beta' },
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.filteredCount).toBe(1);
    expect(body.totalCount).toBe(2);
    expect(body.items[0].id).toBe('task-2');

    const tagReq = createMockRequest({
      query: { organizationId: 'org-aaa', search: 'urgent' },
    });
    const tagRes = await GetTasks(tagReq, createMockContext());
    const tagBody = tagRes.jsonBody as PaginatedTasksResult;
    expect(tagBody.filteredCount).toBe(1);
    expect(tagBody.items[0].id).toBe('task-1');
  });

  it('filters by status and priority lists', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-aaa', status: 'in-progress' },
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.filteredCount).toBe(1);
    expect(body.items[0].id).toBe('task-2');

    const multiReq = createMockRequest({
      query: { organizationId: 'org-aaa', status: 'todo,in-progress', priority: 'high' },
    });
    const multiRes = await GetTasks(multiReq, createMockContext());
    const multiBody = multiRes.jsonBody as PaginatedTasksResult;
    expect(multiBody.filteredCount).toBe(1);
    expect(multiBody.items[0].id).toBe('task-1');
  });

  it('sorts tasks by column and direction', async () => {
    const req = createMockRequest({
      query: {
        organizationId: 'org-aaa',
        sortColumn: 'title',
        sortDirection: 'desc',
      },
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.items.map((t) => t.id)).toEqual(['task-2', 'task-1']);
  });

  it('prevents SQL injection attack and does not leak tasks of other tenants', async () => {
    const maliciousPayload = "' OR '1'='1";
    const req = createMockRequest({ query: { organizationId: maliciousPayload } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(0);
    expect(body.filteredCount).toBe(0);
    expect(body.items).toHaveLength(0);
  });

  it('returns 400 Bad Request when organizationId is missing or empty', async () => {
    const req = createMockRequest({ query: {} });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'organizationId' is required.",
    });
  });

  it('returns 400 Bad Request on invalid pagination or filter parameters', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-aaa', page: '-1' },
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(400);

    const invalidStatusReq = createMockRequest({
      query: { organizationId: 'org-aaa', status: 'invalid-status' },
    });
    const invalidStatusRes = await GetTasks(invalidStatusReq, createMockContext());
    expect(invalidStatusRes.status).toBe(400);
  });

  it('returns empty result envelope when organization has no tasks', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-empty' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(0);
    expect(body.filteredCount).toBe(0);
    expect(body.items).toEqual([]);
    expect(body.totalPages).toBe(0);
  });

  it('rejects a page beyond the maximum bound with 400', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-aaa', page: '10001' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Page cannot exceed 10000' });
  });

  it('accepts the maximum page bound and returns an empty page', async () => {
    const req = createMockRequest({ query: { organizationId: 'org-aaa', page: '10000' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(2);
    expect(body.filteredCount).toBe(2);
    expect(body.totalPages).toBe(1);
    expect(body.items).toEqual([]);
  });

  it('trims surrounding whitespace from organizationId', async () => {
    const req = createMockRequest({ query: { organizationId: '  org-aaa  ' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.totalCount).toBe(2);
    expect(body.filteredCount).toBe(2);
    expect(body.items.map((t) => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('rejects a whitespace-only organizationId with 400', async () => {
    const req = createMockRequest({ query: { organizationId: '   ' } });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      error: "Query parameter 'organizationId' is required.",
    });
  });

  it('joins repeated query keys instead of dropping filters', async () => {
    const req = createMockRequest({
      queryString: 'organizationId=org-aaa&status=todo&status=in-progress',
    });
    const res = await GetTasks(req, createMockContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as PaginatedTasksResult;
    expect(body.filteredCount).toBe(2);
    expect(body.items.map((t) => t.id)).toEqual(['task-1', 'task-2']);
  });
});
