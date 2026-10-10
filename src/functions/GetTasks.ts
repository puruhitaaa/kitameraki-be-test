import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { GetTasksQuerySchema, PaginatedTasksResult } from '../models/taskQuery';
import { getTasksContainer } from '../shared/cosmosClient';
import { badRequest, internalServerError, ok, parseQueryParams } from '../shared/http';
import { buildTaskQueries } from '../shared/taskQueryBuilder';

export async function GetTasks(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing GetTasks request for url "${request.url}"`);

  const rawParams = parseQueryParams(request);
  const parseResult = GetTasksQuerySchema.safeParse(rawParams);

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return badRequest(issue?.message ?? 'Invalid query parameters');
  }

  const query = parseResult.data;

  const filtersActive =
    (query.search?.trim().length ?? 0) > 0 ||
    (query.status?.length ?? 0) > 0 ||
    (query.priority?.length ?? 0) > 0;

  try {
    const container = getTasksContainer();
    const { totalCountQuery, filteredCountQuery, itemsQuery } = buildTaskQueries(query, filtersActive);
    const feedOptions = { partitionKey: query.organizationId };

    const [totalCountResponse, filteredCountResponse, itemsResponse] = await Promise.all([
      totalCountQuery ? container.items.query<number>(totalCountQuery, feedOptions).fetchAll() : null,
      container.items.query<number>(filteredCountQuery, feedOptions).fetchAll(),
      container.items.query(itemsQuery, feedOptions).fetchAll(),
    ]);

    const filteredCount = Number(filteredCountResponse.resources[0] ?? 0);
    const totalCount = totalCountResponse ? Number(totalCountResponse.resources[0] ?? 0) : filteredCount;
    const items = itemsResponse.resources;
    const totalPages = Math.ceil(filteredCount / query.pageSize);

    const result: PaginatedTasksResult = {
      items,
      totalCount,
      filteredCount,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    };

    return ok(result);
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('GetTasks', {
  methods: ['GET'],
  authLevel: 'function',
  handler: GetTasks,
});
