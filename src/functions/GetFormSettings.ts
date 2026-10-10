import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createDefaultFormSettings } from '../models/formSettings';
import { getFormSettingsContainer, isCosmosNotFound } from '../shared/cosmosClient';
import {
  badRequest,
  internalServerError,
  ok,
  QueryParamError,
  requireQueryParam,
} from '../shared/http';

export async function GetFormSettings(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Processing GetFormSettings request for url "${request.url}"`);

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
    const container = getFormSettingsContainer();
    const { resource } = await container.item('default', organizationId).read();

    if (!resource) {
      return ok(createDefaultFormSettings(organizationId));
    }

    return ok(resource);
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return ok(createDefaultFormSettings(organizationId));
    }
    return internalServerError(error, context);
  }
}

app.http('GetFormSettings', {
  methods: ['GET'],
  authLevel: 'function',
  handler: GetFormSettings,
});
