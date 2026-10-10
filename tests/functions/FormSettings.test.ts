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

  it('forces id to default regardless of client-supplied id', async () => {
    const savePayload = {
      id: 'shadow-1',
      organizationId: 'org-x',
      fields: [
        {
          id: 'field-1',
          name: 'clientEmail',
          label: 'Client Email',
          type: 'email',
          row: 0,
          column: 0,
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
    expect(saveRes.jsonBody).toMatchObject({ id: 'default', organizationId: 'org-x' });

    // GET for that org reads the singleton doc and returns the saved fields
    const getReq = createMockRequest({
      query: { organizationId: 'org-x' },
    });
    const getRes = await GetFormSettings(getReq, createMockContext());
    expect(getRes.status).toBe(200);
    const body = getRes.jsonBody as { id: string; fields: Array<{ name: string }> };
    expect(body.id).toBe('default');
    expect(body.fields).toHaveLength(1);
    expect(body.fields[0].name).toBe('clientEmail');

    // Only the singleton doc exists for the org (no orphaned shadow doc)
    const orgKeys = [...formSettingsContainer.itemsMap.keys()].filter((k) =>
      k.startsWith('org-x:'),
    );
    expect(orgKeys).toEqual(['org-x:default']);
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

  it('rejects custom fields that collide with reserved task attributes (400 Bad Request)', async () => {
    const reservedCollisions = ['id', 'title', 'status', 'organizationId', 'dueDate', '_ts'];
    for (const reservedName of reservedCollisions) {
      const payload = {
        organizationId: 'org-reserved',
        fields: [
          {
            id: `f-${reservedName}`,
            name: reservedName,
            label: `Label for ${reservedName}`,
            type: 'text',
            row: 0,
            column: 0,
          },
        ],
      };

      const req = createMockRequest({
        method: 'POST',
        body: payload,
      });

      const res = await SaveFormSettings(req, createMockContext());
      expect(res.status).toBe(400);
      expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
    }
  });

  it('rejects duplicate field names and duplicate field IDs (400 Bad Request)', async () => {
    // Duplicate field names
    const duplicateNamePayload = {
      organizationId: 'org-dup',
      fields: [
        {
          id: 'field-1',
          name: 'notes',
          label: 'Notes 1',
          type: 'text',
          row: 0,
          column: 0,
        },
        {
          id: 'field-2',
          name: 'notes',
          label: 'Notes 2',
          type: 'text',
          row: 1,
          column: 0,
        },
      ],
    };

    const req1 = createMockRequest({
      method: 'POST',
      body: duplicateNamePayload,
    });
    const res1 = await SaveFormSettings(req1, createMockContext());
    expect(res1.status).toBe(400);
    expect(res1.jsonBody).toMatchObject({ error: 'Validation failed' });

    // Duplicate field IDs
    const duplicateIdPayload = {
      organizationId: 'org-dup',
      fields: [
        {
          id: 'field-same',
          name: 'fieldOne',
          label: 'Field One',
          type: 'text',
          row: 0,
          column: 0,
        },
        {
          id: 'field-same',
          name: 'fieldTwo',
          label: 'Field Two',
          type: 'text',
          row: 1,
          column: 0,
        },
      ],
    };

    const req2 = createMockRequest({
      method: 'POST',
      body: duplicateIdPayload,
    });
    const res2 = await SaveFormSettings(req2, createMockContext());
    expect(res2.status).toBe(400);
    expect(res2.jsonBody).toMatchObject({ error: 'Validation failed' });
  });

  it('rejects malformed field names (400 Bad Request)', async () => {
    const malformedNames = ['123numericStart', 'has space', 'special-char', 'dollar$ign', ''];
    for (const badName of malformedNames) {
      const payload = {
        organizationId: 'org-malformed',
        fields: [
          {
            id: 'f-1',
            name: badName,
            label: 'Label',
            type: 'text',
            row: 0,
            column: 0,
          },
        ],
      };

      const req = createMockRequest({
        method: 'POST',
        body: payload,
      });

      const res = await SaveFormSettings(req, createMockContext());
      expect(res.status).toBe(400);
      expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
    }
  });

  it('rejects more than 50 custom fields (400 Bad Request)', async () => {
    const payload = {
      organizationId: 'org-limit',
      fields: Array.from({ length: 51 }, (_, i) => ({
        id: `f-${i}`,
        name: `customField_${i}`,
        label: `Custom Field ${i}`,
        type: 'text',
        row: i,
        column: 0 as const,
      })),
    };

    const req = createMockRequest({
      method: 'POST',
      body: payload,
    });

    const res = await SaveFormSettings(req, createMockContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Validation failed' });
  });
});
