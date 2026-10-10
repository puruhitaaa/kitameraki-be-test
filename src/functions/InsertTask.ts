import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { InsertTaskSchema, TaskSchema } from '../models/task';
import { getFormSettingsByOrg, getTasksContainer } from '../shared/cosmosClient';
import {
  CustomFieldValidationError,
  stripSystemFields,
  validateCustomFields,
} from '../shared/customFieldValidation';
import { badRequest, created, internalServerError } from '../shared/http';

const KNOWN_KEYS = new Set(Object.keys(TaskSchema.shape));

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
    const settings = await getFormSettingsByOrg(parseResult.data.organizationId);

    try {
      validateCustomFields(parseResult.data, settings, KNOWN_KEYS);
    } catch (err) {
      if (err instanceof CustomFieldValidationError) {
        return badRequest('Validation failed', { message: err.message });
      }
      throw err;
    }

    const data = parseResult.data as Record<string, unknown>;
    const { createdAt: _c, updatedAt: _u, ...sanitized } = data;
    // stripSystemFields removes `id`/`organizationId` (both in FORBIDDEN_PATCH_KEYS);
    // re-attach the server-generated UUID and validated partition key so the client
    // can never choose the document id.
    const createdTask = await container.items.create({
      ...stripSystemFields(sanitized),
      id: parseResult.data.id,
      organizationId: parseResult.data.organizationId,
    });
    return created(createdTask.resource);
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('InsertTask', {
  methods: ['POST'],
  authLevel: 'function',
  handler: InsertTask,
});
