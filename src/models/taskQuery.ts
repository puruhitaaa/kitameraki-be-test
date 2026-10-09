import { z } from 'zod';
import { Task, TaskPriorityEnum, TaskStatusEnum } from './task';

export const TaskSortColumnEnum = z.enum(['title', 'priority', 'status', 'dueDate']);
export type TaskSortColumn = z.infer<typeof TaskSortColumnEnum>;

export const TaskSortDirectionEnum = z.enum(['asc', 'desc', 'ascending', 'descending']);
export type TaskSortDirection = z.infer<typeof TaskSortDirectionEnum>;

export const GetTasksQuerySchema = z.object({
  organizationId: z
    .string({
      required_error: "Query parameter 'organizationId' is required.",
    })
    .trim()
    .min(1, "Query parameter 'organizationId' is required.")
    .max(100, "Query parameter 'organizationId' cannot exceed 100 characters."),
  search: z.string().trim().max(100).optional().default(''),
  status: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parts = val.split(',').map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts : undefined;
    }
    return val;
  }, z.array(TaskStatusEnum).optional()),
  priority: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parts = val.split(',').map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts : undefined;
    }
    return val;
  }, z.array(TaskPriorityEnum).optional()),
  sortColumn: TaskSortColumnEnum.default('title'),
  sortDirection: TaskSortDirectionEnum.default('asc'),
  page: z.coerce.number().int().min(0, 'Page must be >= 0').max(10_000, 'Page cannot exceed 10000').default(0),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'PageSize must be >= 1')
    .max(100, 'PageSize cannot exceed 100')
    .default(10),
});

export type GetTasksQuery = z.infer<typeof GetTasksQuerySchema>;

export interface PaginatedTasksResult {
  items: Task[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
