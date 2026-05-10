export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
};

export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type QueryParams = {
  pagination: PaginationParams;
  filters: {
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
    raw: Record<string, unknown>;
  };
  sort: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  raw: Record<string, unknown>;
};

export type Id = string | number;

export type Timestamp = Date | string;

export type Email = string;

export type UUID = string;
