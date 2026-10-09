import { PatchOperation } from '@azure/cosmos';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { UpdateTaskSchema } from '../models/task';
import { getTasksContainer, isCosmosNotFound } from '../shared/cosmosClient';
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
  QueryParamError,
  requireQueryParam,
} from '../shared/http';

export async function UpdateTask(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing UpdateTask request for url "${request.url}"`);

  let taskId: string;
  let organizationId: string;
  try {
    taskId = requireQueryParam(request, 'id');
    organizationId = requireQueryParam(request, 'organizationId');
  } catch (error) {
    if (error instanceof QueryParamError) {
      return badRequest(error.message);
    }
    return badRequest('Invalid query parameters');
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parseResult = UpdateTaskSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return badRequest('Validation failed', parseResult.error.format());
  }

  const patchOperations: PatchOperation[] = Object.entries(parseResult.data).map(
    ([key, value]) => ({
      op: 'set',
      path: `/${key}`,
      value,
    }),
  );

  try {
    const container = getTasksContainer();
    const updated = await container.item(taskId, organizationId).patch(patchOperations);

    if (!updated.resource) {
      return notFound(`Task with ID '${taskId}' was not found`);
    }

    return ok(updated.resource);
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return notFound(`Task with ID '${taskId}' was not found`);
    }
    return internalServerError(error, context);
  }
}

app.http('UpdateTask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: UpdateTask,
});
