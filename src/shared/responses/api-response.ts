import type {
  ApiResponse,
  ApiErrorResponse,
  PaginationMeta
} from '@shared/types/common.js';

export type ApiResponseMeta = PaginationMeta & Record<string, unknown>;

export const apiResponse = <T>(
  message: string,
  data?: T,
  meta?: ApiResponseMeta
): ApiResponse<T> => ({
  success: true,
  message,
  data,
  ...(meta ? { meta } : {})
});

export const apiErrorResponse = (
  message: string,
  options?: { code?: string; details?: unknown; stack?: string; requestId?: string }
): ApiErrorResponse => ({
  success: false,
  message,
  ...(options?.code ? { code: options.code } : {}),
  ...(options?.details ? { details: options.details } : {}),
  ...(options?.stack ? { stack: options.stack } : {}),
  ...(options?.requestId ? { requestId: options.requestId } : {})
});
