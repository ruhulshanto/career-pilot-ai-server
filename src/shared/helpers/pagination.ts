import type { PaginationParams, PaginationMeta } from '../types/common.js';

export const getPaginationParams = (
  query: Record<string, unknown>
): PaginationParams => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10)); // max 100, default 10
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev
  };
};
