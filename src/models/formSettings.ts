import { z } from 'zod';

export const FormFieldTypeEnum = z.enum(['text', 'date', 'datetime', 'email']);
export type FormFieldType = z.infer<typeof FormFieldTypeEnum>;

export const FormFieldSchema = z.object({
  id: z.string().min(1, 'Field ID is required'),
  name: z.string().min(1, 'Field name is required'),
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
  fields: z.array(FormFieldSchema).default([]),
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
