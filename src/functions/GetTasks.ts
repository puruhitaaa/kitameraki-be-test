import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmosClient';
import { badRequest, internalServerError, ok, QueryParamError, requireQueryParam } from '../shared/http';

export async function GetTasks(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing GetTasks request for url "${request.url}"`);

  let organizationId: string;
  try {
    organizationId = requireQueryParam(request, 'organizationId');
  } catch (error) {
    if (error instanceof QueryParamError) {
      return badRequest(error.message);
    }
    return badRequest('Invalid query parameter');
  }

  try {
    const container = getTasksContainer();
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.organizationId = @organizationId',
      parameters: [{ name: '@organizationId', value: organizationId }],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    return ok(resources);
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('GetTasks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: GetTasks,
});
