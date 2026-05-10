export type AppErrorOptions = {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor({
    statusCode,
    message,
    code,
    details,
    isOperational = true
  }: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}
