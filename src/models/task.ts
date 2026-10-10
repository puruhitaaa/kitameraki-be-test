import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const TaskPriorityEnum = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const TaskStatusEnum = z.enum(['todo', 'in-progress', 'completed']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskSchema = z
  .object({
    id: z.string().min(1, 'Task ID cannot be empty'),
    organizationId: z.string().min(1, 'Organization ID cannot be empty'),
    title: z.string().min(1, 'Title cannot be empty').max(100, 'Title cannot exceed 100 characters'),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
    dueDate: z.string().datetime({ message: 'Due date must be a valid ISO 8601 date string' }).optional().nullable(),
    priority: TaskPriorityEnum.optional().nullable(),
    status: TaskStatusEnum.default('todo'),
    tags: z.array(z.string().max(50)).optional().default([]),
  })
  .passthrough(); // allows custom fields configured via form settings

export type Task = z.infer<typeof TaskSchema>;

export const InsertTaskSchema = TaskSchema.extend({
  id: z.string().optional(),
}).transform((data) => ({
  ...data,
  id: randomUUID(), // always server-generated; client-supplied ids are ignored
}));

export type InsertTaskInput = z.input<typeof InsertTaskSchema>;

export const FORBIDDEN_PATCH_KEYS: Record<string, boolean> = {
  id: true,
  organizationId: true,
  __proto__: true,
  constructor: true,
  prototype: true,
  _rid: true,
  _self: true,
  _etag: true,
  _ts: true,
  _attachments: true,
};

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    priority: TaskPriorityEnum.optional().nullable(),
    status: TaskStatusEnum.optional(),
    tags: z.array(z.string().max(50)).optional(),
  })
  .passthrough()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Update payload must contain at least one field to update',
  })
  .refine(
    (data) =>
      !Object.keys(data).some((key) =>
        Object.prototype.hasOwnProperty.call(FORBIDDEN_PATCH_KEYS, key),
      ),
    {
      message: `Cannot update immutable or system keys: ${Object.keys(FORBIDDEN_PATCH_KEYS).join(', ')}`,
    },
  );

export const BulkDeleteSchema = z
  .array(z.string().min(1, 'Task ID in bulk delete cannot be empty'))
  .min(1, 'Bulk delete list cannot be empty')
  .max(100, 'Bulk delete batch cannot exceed 100 tasks');
