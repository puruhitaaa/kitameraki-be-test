import { SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { GetTasksQuery } from '../models/taskQuery';

export interface TaskCosmosQueries {
  filteredCountQuery: SqlQuerySpec;
  itemsQuery: SqlQuerySpec;
  /** Present only when at least one filter is active; otherwise filteredCount === totalCount. */
  totalCountQuery?: SqlQuerySpec;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, string>, {
    title: 'c.title',
    priority: 'c.priority',
    status: 'c.status',
    dueDate: 'c.dueDate',
  }),
);

export function buildTaskQueries(query: GetTasksQuery, hasFilters: boolean): TaskCosmosQueries {
  const baseWhere = 'c.organizationId = @organizationId';
  const baseParams: SqlParameter[] = [
    { name: '@organizationId', value: query.organizationId },
  ];

  // Build filter conditions
  const filterConditions: string[] = [baseWhere];
  const filterParams: SqlParameter[] = [...baseParams];

  const searchTrimmed = query.search?.trim();
  if (searchTrimmed) {
    filterConditions.push(
      '(CONTAINS(c.title, @search, true) OR CONTAINS(c.description, @search, true) OR ARRAY_CONTAINS(c.tags, @searchRaw))'
    );
    filterParams.push(
      { name: '@search', value: searchTrimmed },
      { name: '@searchRaw', value: searchTrimmed }
    );
  }

  if (query.status && query.status.length > 0) {
    filterConditions.push('ARRAY_CONTAINS(@statuses, c.status)');
    filterParams.push({ name: '@statuses', value: query.status });
  }

  if (query.priority && query.priority.length > 0) {
    filterConditions.push('ARRAY_CONTAINS(@priorities, c.priority)');
    filterParams.push({ name: '@priorities', value: query.priority });
  }

  const whereClause = filterConditions.join(' AND ');

  // Filtered count query
  const filteredCountQuery: SqlQuerySpec = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`,
    parameters: [...filterParams],
  };

  // Safe sort column & direction
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortColumn] ?? 'c.title';
  const sortDir = query.sortDirection === 'desc' || query.sortDirection === 'descending' ? 'DESC' : 'ASC';

  const offset = query.page * query.pageSize;
  const limit = query.pageSize;

  const itemsParams: SqlParameter[] = [
    ...filterParams,
    { name: '@offset', value: offset },
    { name: '@limit', value: limit },
  ];

  const itemsQuery: SqlQuerySpec = {
    query: `SELECT * FROM c WHERE ${whereClause} ORDER BY ${sortCol} ${sortDir} OFFSET @offset LIMIT @limit`,
    parameters: itemsParams,
  };

  const result: TaskCosmosQueries = { filteredCountQuery, itemsQuery };

  if (hasFilters) {
    result.totalCountQuery = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE ${baseWhere}`,
      parameters: [...baseParams],
    };
  }

  return result;
}
