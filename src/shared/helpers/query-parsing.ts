import { getPaginationParams } from './pagination.js';
import { parseFilters, type ParsedFilters } from './filtering.js';
import { parseSort, type ParsedSort } from './sorting.js';
import type { QueryParams, PaginationParams } from '../types/common.js';

export const parseQueryParams = (
  query: Record<string, unknown>
): QueryParams => {
  const pagination = getPaginationParams(query);
  const filters = parseFilters(query);
  const sort = parseSort(query);

  // Raw params excluding processed ones
  const raw: Record<string, unknown> = {};
  const processedKeys = new Set([
    'page',
    'limit',
    'sort',
    ...Object.keys(query).filter((key) => key.startsWith('filter['))
  ]);

  for (const [key, value] of Object.entries(query)) {
    if (!processedKeys.has(key)) {
      raw[key] = value;
    }
  }

  return {
    pagination,
    filters,
    sort,
    raw
  };
};
