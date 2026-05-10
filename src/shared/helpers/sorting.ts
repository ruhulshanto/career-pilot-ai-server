import type { SortDirection } from '../constants/common.js';

export type SortField = {
  field: string;
  direction: SortDirection;
};

export type ParsedSort = SortField[];

export const parseSort = (query: Record<string, unknown>): ParsedSort => {
  const sortParam = query.sort as string | undefined;
  if (!sortParam) return [];

  // Support multiple sorts: sort=field1:asc,field2:desc
  const sortFields = sortParam.split(',').map((s) => s.trim());

  const parsed: SortField[] = [];

  for (const sortField of sortFields) {
    const [field, direction] = sortField.split(':');
    if (field && isValidDirection(direction)) {
      parsed.push({
        field: field.trim(),
        direction: direction.trim() as SortDirection
      });
    } else if (field) {
      // Default to asc if no direction
      parsed.push({
        field: field.trim(),
        direction: 'asc'
      });
    }
  }

  return parsed;
};

const isValidDirection = (dir: string | undefined): dir is SortDirection => {
  return dir === 'asc' || dir === 'desc';
};

export const applySortToPrisma = <T extends Record<string, unknown>>(
  sortFields: ParsedSort,
  baseOrderBy: T = {} as T
): unknown => {
  if (sortFields.length === 0) return baseOrderBy;

  const orderBy: Record<string, SortDirection>[] = [];

  for (const { field, direction } of sortFields) {
    orderBy.push({ [field]: direction });
  }

  // If baseOrderBy exists, combine them
  if (Object.keys(baseOrderBy).length > 0) {
    return [baseOrderBy, ...orderBy];
  }

  return orderBy;
};
