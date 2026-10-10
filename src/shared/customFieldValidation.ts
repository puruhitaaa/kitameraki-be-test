import { FORBIDDEN_PATCH_KEYS } from '../models/task';
import {
  FIELD_NAME_REGEX,
  RESERVED_FIELD_NAMES,
  type FormSettings,
} from '../models/formSettings';

export const MAX_CUSTOM_FIELDS = 50;
export const MAX_CUSTOM_VALUE_LENGTH = 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomFieldValidationError';
  }
}

/** Strips forbidden keys (FORBIDDEN_PATCH_KEYS), `createdAt`/`updatedAt`, and any key starting with `_`. */
export function stripSystemFields(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.prototype.hasOwnProperty.call(FORBIDDEN_PATCH_KEYS, key)) continue;
    if (key === 'createdAt' || key === 'updatedAt') continue;
    if (key.startsWith('_')) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Validates the custom-field subset (keys outside `knownKeys`) of `fields`
 * against the org's saved settings. Throws CustomFieldValidationError on violation.
 * Keys that are always dropped before persistence (`createdAt`/`updatedAt`,
 * `_`-prefixed system keys) are skipped: they are silently discarded, not validated.
 */
export function validateCustomFields(
  fields: Record<string, unknown>,
  settings: FormSettings,
  knownKeys: ReadonlySet<string>,
): void {
  const customEntries = Object.entries(fields).filter(
    ([key]) =>
      !knownKeys.has(key) && key !== 'createdAt' && key !== 'updatedAt' && !key.startsWith('_'),
  );

  if (customEntries.length > MAX_CUSTOM_FIELDS) {
    throw new CustomFieldValidationError('Too many custom fields: maximum is 50');
  }

  for (const [key, value] of customEntries) {
    if (!FIELD_NAME_REGEX.test(key) || RESERVED_FIELD_NAMES.has(key)) {
      throw new CustomFieldValidationError(`Invalid custom field name: ${key}`);
    }

    const field = settings.fields.find((f) => f.name === key);
    if (!field) {
      throw new CustomFieldValidationError(`Unknown custom field: ${key}`);
    }

    if (value === null || value === undefined) continue; // null clears the field

    switch (field.type) {
      case 'text':
        if (typeof value !== 'string' || value.length > MAX_CUSTOM_VALUE_LENGTH) {
          throw new CustomFieldValidationError(`Invalid value for text field: ${key}`);
        }
        break;
      case 'email':
        if (
          typeof value !== 'string' ||
          value.length > MAX_CUSTOM_VALUE_LENGTH ||
          !EMAIL_REGEX.test(value)
        ) {
          throw new CustomFieldValidationError(`Invalid value for email field: ${key}`);
        }
        break;
      case 'date':
      case 'datetime':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw new CustomFieldValidationError(`Invalid value for date field: ${key}`);
        }
        break;
    }
  }
}
