import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request ID from context
 */
export const getRequestId = () => requestContext.getStore()?.requestId;

/**
 * Get the current user ID from context
 */
export const getUserId = () => requestContext.getStore()?.userId;
