import { beforeEach, describe, expect, it } from 'vitest';
import { GetFormSettings } from '../../src/functions/GetFormSettings';
import { SaveFormSettings } from '../../src/functions/SaveFormSettings';
import { setCosmosClient } from '../../src/shared/cosmosClient';
import { createMockCosmosClient, MockCosmosContainer } from '../mocks/mockCosmos';
import { createMockContext, createMockRequest } from '../mocks/mockHelpers';

describe('FormSettings', () => {
  let formSettingsContainer: MockCosmosContainer;

  beforeEach(() => {
    const mock = createMockCosmosClient();
    formSettingsContainer = mock.formSettingsContainer;
    setCosmosClient(mock.mockClient);
  });

  it('returns default empty form settings when organization has not configured them yet', async () => {
    const req = createMockRequest({
      query: { organizationId: 'org-new' },
    });

    const res = await GetFormSettings(req, createMockContext());

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({
      id: 'default',
      organizationId: 'org-new',
      fields: [],
    });
  });

  it('saves and retrieves customized form settings', async () => {
    const savePayload = {
      id: 'default',
      organizationId: 'org-custom',
      fields: [
        {
          id: 'field-1',
          name: 'clientEmail',
          label: 'Client Email',
          type: 'email',
          row: 0,
          column: 0,
          required: true,
        },
        {
          id: 'field-2',
          name: 'meetingTime',
          label: 'Meeting Time',
          type: 'datetime',
          row: 0,
          column: 1,
          required: false,
        },
      ],
    };

    const saveReq = createMockRequest({
      method: 'POST',
      body: savePayload,
    });

    const saveRes = await SaveFormSettings(saveReq, createMockContext());
    expect(saveRes.status).toBe(200);
    expect(saveRes.jsonBody).toMatchObject({
      organizationId: 'org-custom',
      fields: expect.arrayContaining([
        expect.objectContaining({ name: 'clientEmail', type: 'email' }),
      ]),
    });

    // Now retrieve via GetFormSettings
    const getReq = createMockRequest({
      query: { organizationId: 'org-custom' },
    });
    const getRes = await GetFormSettings(getReq, createMockContext());
    expect(getRes.status).toBe(200);
    const body = getRes.jsonBody as { fields: Array<{ name: string; column: number }> };
    expect(body.fields).toHaveLength(2);
    expect(body.fields[0].name).toBe('clientEmail');
  });

  it('rejects invalid field types or invalid columns with 400 Bad Request', async () => {
    const invalidPayload = {
      organizationId: 'org-bad',
      fields: [
        {
          id: 'f-bad',
          name: 'badField',
          label: 'Bad',
          type: 'unsupported-type',
          row: 0,
          column: 3, // Only 0 or 1 allowed (up to 2 columns)
        },
      ],
    };

    const req = createMockRequest({
      method: 'POST',
      body: invalidPayload,
    });

    const res = await SaveFormSettings(req, createMockContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
  });
});
