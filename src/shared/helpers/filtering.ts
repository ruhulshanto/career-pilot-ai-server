import type { FilterOperator } from '../constants/common.js';

export type FilterCondition = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

export type ParsedFilters = {
  conditions: FilterCondition[];
  raw: Record<string, unknown>;
};

export const parseFilters = (query: Record<string, unknown>): ParsedFilters => {
  const conditions: FilterCondition[] = [];
  const raw: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('filter[') && key.endsWith(']')) {
      // Parse filter[field__operator]
      const match = key.match(/^filter\[(.+?)__(.+?)\]$/);
      if (match) {
        const [, field, operator] = match;
        if (isValidOperator(operator)) {
          conditions.push({
            field,
            operator: operator as FilterOperator,
            value: parseFilterValue(value)
          });
        }
      }
    } else if (!['page', 'limit', 'sort', 'order'].includes(key)) {
      // Other query params as raw
      raw[key] = value;
    }
  }

  return { conditions, raw };
};

const isValidOperator = (op: string): op is FilterOperator => {
  const validOps: FilterOperator[] = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'nin',
    'contains',
    'icontains',
    'startswith',
    'endswith',
    'isnull',
    'isnotnull'
  ];
  return validOps.includes(op as FilterOperator);
};

const parseFilterValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    // Try to parse as number or boolean
    if (!isNaN(Number(value))) return Number(value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    // For 'in' and 'nin', split by comma
    if (value.includes(',')) return value.split(',').map((v) => v.trim());
  }
  return value;
};

export const applyFiltersToPrisma = <T extends Record<string, unknown>>(
  conditions: FilterCondition[],
  baseWhere: T = {} as T
): T => {
  const where: Record<string, unknown> = { ...baseWhere };

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    const prismaCondition = buildPrismaCondition(operator, value);
    if (prismaCondition !== undefined) {
      where[field] = prismaCondition;
    }
  }

  return where as T;
};

const buildPrismaCondition = (
  operator: FilterOperator,
  value: unknown
): unknown => {
  switch (operator) {
    case 'eq':
      return value;
    case 'ne':
      return { not: value };
    case 'gt':
      return { gt: value };
    case 'gte':
      return { gte: value };
    case 'lt':
      return { lt: value };
    case 'lte':
      return { lte: value };
    case 'in':
      return { in: value };
    case 'nin':
      return { notIn: value };
    case 'contains':
      return { contains: value };
    case 'icontains':
      return { contains: value, mode: 'insensitive' };
    case 'startswith':
      return { startsWith: value };
    case 'endswith':
      return { endsWith: value };
    case 'isnull':
      return null;
    case 'isnotnull':
      return { not: null };
    default:
      return undefined;
  }
};
