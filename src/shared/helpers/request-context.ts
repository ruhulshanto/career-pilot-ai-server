import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  requestId: string;
  userId?: string;
  startTime: Date;
  [key: string]: unknown;
};

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export const createRequestContext = (
  requestId: string,
  userId?: string
): RequestContext => ({
  requestId,
  userId,
  startTime: new Date()
});

export const runWithContext = <T>(
  context: RequestContext,
  callback: () => T | Promise<T>
): T | Promise<T> => {
  return asyncLocalStorage.run(context, callback);
};

export const getRequestContext = (): RequestContext | undefined => {
  return asyncLocalStorage.getStore();
};

export const setContextValue = (key: string, value: unknown): void => {
  const context = getRequestContext();
  if (context) {
    context[key] = value;
  }
};

export const getContextValue = (key: string): unknown => {
  const context = getRequestContext();
  return context?.[key];
};
