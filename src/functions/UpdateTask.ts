import { PatchOperation } from '@azure/cosmos';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TaskSchema, UpdateTaskSchema } from '../models/task';
import { getFormSettingsByOrg, getTasksContainer, isCosmosNotFound } from '../shared/cosmosClient';
import { CustomFieldValidationError, validateCustomFields } from '../shared/customFieldValidation';
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
  QueryParamError,
  requireQueryParam,
} from '../shared/http';

const KNOWN_KEYS = new Set(Object.keys(TaskSchema.shape));
export function escapeJsonPointer(key: string): string {
  return `/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

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

  try {
    const container = getTasksContainer();
    const settings = await getFormSettingsByOrg(organizationId);

    const data = parseResult.data as Record<string, unknown>;
    try {
      validateCustomFields(data, settings, KNOWN_KEYS);
    } catch (err) {
      if (err instanceof CustomFieldValidationError) {
        return badRequest('Validation failed', { message: err.message });
      }
      throw err;
    }

    // Allowlist: only known task keys or configured custom fields may be patched.
    // (createdAt/updatedAt are reserved and can never be configured, so they are dropped here.)
    const entries = Object.entries(data).filter(
      ([key]) => KNOWN_KEYS.has(key) || settings.fields.some((f) => f.name === key),
    );

    const patchOperations: PatchOperation[] = entries.map(([key, value]) => ({
      op: 'set',
      path: escapeJsonPointer(key),
      value,
    }));

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
  authLevel: 'function',
  handler: UpdateTask,
});
