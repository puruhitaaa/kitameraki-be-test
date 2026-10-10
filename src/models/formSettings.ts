import { z } from 'zod';

export const FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const FormFieldTypeEnum = z.enum(['text', 'date', 'datetime', 'email']);
export type FormFieldType = z.infer<typeof FormFieldTypeEnum>;

export const RESERVED_FIELD_NAMES = new Set([
  'id',
  'organizationId',
  'title',
  'description',
  'dueDate',
  'priority',
  'status',
  'tags',
  'createdAt',
  'updatedAt',
  '_rid',
  '_self',
  '_etag',
  '_ts',
  '_attachments',
]);

export const FormFieldSchema = z.object({
  id: z.string().min(1, 'Field ID is required'),
  name: z
    .string()
    .min(1, 'Field name is required')
    .max(50, 'Field name cannot exceed 50 characters')
    .regex(
      FIELD_NAME_REGEX,
      'Field name must be a valid identifier (alphanumeric and underscore)',
    )
    .refine((name) => !RESERVED_FIELD_NAMES.has(name), {
      message: 'Field name collides with a reserved system or task attribute',
    }),
  label: z.string().min(1, 'Field label is required'),
  type: FormFieldTypeEnum,
  row: z.number().int().nonnegative('Row must be >= 0'),
  column: z.union([z.literal(0), z.literal(1)]), // Up to 2 columns (0 or 1)
  required: z.boolean().optional().default(false),
});

export type FormField = z.infer<typeof FormFieldSchema>;

export const FormSettingsSchema = z.object({
  id: z.string().default('default'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  fields: z
    .array(FormFieldSchema)
    .max(50, 'Cannot configure more than 50 custom fields')
    .refine(
      (fields) => {
        const ids = new Set<string>();
        for (const f of fields) {
          if (ids.has(f.id)) return false;
          ids.add(f.id);
        }
        return true;
      },
      { message: 'Field IDs must be unique across all fields' },
    )
    .refine(
      (fields) => {
        const names = new Set<string>();
        for (const f of fields) {
          if (names.has(f.name)) return false;
          names.add(f.name);
        }
        return true;
      },
      { message: 'Field names must be unique across all fields' },
    )
    .default([]),
  updatedAt: z.string().datetime().optional(),
});
export type FormSettings = z.infer<typeof FormSettingsSchema>;

export function createDefaultFormSettings(organizationId: string): FormSettings {
  return {
    id: 'default',
    organizationId,
    fields: [],
    updatedAt: new Date().toISOString(),
  };
}
