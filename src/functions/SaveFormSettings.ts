import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { FormSettingsSchema } from '../models/formSettings';
import { getFormSettingsContainer } from '../shared/cosmosClient';
import { badRequest, internalServerError, ok } from '../shared/http';

export async function SaveFormSettings(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing SaveFormSettings request for url "${request.url}"`);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parseResult = FormSettingsSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return badRequest('Validation failed', parseResult.error.format());
  }

  const settingsToSave = {
    ...parseResult.data,
    id: 'default', // singleton doc per org; client-supplied ids are overwritten
    updatedAt: new Date().toISOString(),
  };

  try {
    const container = getFormSettingsContainer();
    const { resource } = await container.items.upsert(settingsToSave);
    return ok(resource);
  } catch (error) {
    return internalServerError(error, context);
  }
}

app.http('SaveFormSettings', {
  methods: ['POST'],
  authLevel: 'function',
  handler: SaveFormSettings,
});
