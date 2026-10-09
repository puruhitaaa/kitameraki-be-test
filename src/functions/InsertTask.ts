import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { InsertTaskSchema } from '../models/task';
import { getTasksContainer } from '../shared/cosmosClient';
import { badRequest, created, internalServerError } from '../shared/http';

export async function InsertTask(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing InsertTask request for url "${request.url}"`);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parseResult = InsertTaskSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return badRequest('Validation failed', parseResult.error.format());
  }

  try {
    const container = getTasksContainer();
    const createdTask = await container.items.create(parseResult.data);
    return created(createdTask.resource);
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('InsertTask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: InsertTask,
});
