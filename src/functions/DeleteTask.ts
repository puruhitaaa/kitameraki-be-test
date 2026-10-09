import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTasksContainer, isCosmosNotFound } from '../shared/cosmosClient';
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
  QueryParamError,
  requireQueryParam,
} from '../shared/http';

export async function DeleteTask(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing DeleteTask request for url "${request.url}"`);

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

  try {
    const container = getTasksContainer();
    await container.item(taskId, organizationId).delete();
    return ok({ message: 'Task deleted successfully' });
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return notFound(`Task with ID '${taskId}' was not found`);
    }
    return internalServerError(error, context);
  }
}

app.http('DeleteTask', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: DeleteTask,
});
