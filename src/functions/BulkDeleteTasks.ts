import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BulkDeleteSchema } from '../models/task';
import { getTasksContainer } from '../shared/cosmosClient';
import {
  badRequest,
  internalServerError,
  ok,
  QueryParamError,
  requireQueryParam,
} from '../shared/http';

export async function BulkDeleteTasks(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing BulkDeleteTasks request for url "${request.url}"`);

  let organizationId: string;
  try {
    organizationId = requireQueryParam(request, 'organizationId');
  } catch (error) {
    if (error instanceof QueryParamError) {
      return badRequest(error.message);
    }
    return badRequest('Invalid query parameter');
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parseResult = BulkDeleteSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return badRequest('Validation failed: expected a non-empty array of task IDs', parseResult.error.format());
  }

  const taskIds = parseResult.data;
  const container = getTasksContainer();

  try {
    const results = await Promise.allSettled(
      taskIds.map((id) => container.item(id, organizationId).delete()),
    );

    let deletedCount = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        deletedCount += 1;
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : 'Unknown delete error';
        failures.push({ id: taskIds[index], reason });
      }
    });

    return ok({
      totalRequested: taskIds.length,
      deletedCount,
      failedCount: failures.length,
      failures,
    });
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('BulkDeleteTasks', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: BulkDeleteTasks,
});
