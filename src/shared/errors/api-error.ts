import { AppError } from '@shared/errors/app-error.js';

export class ApiError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    const code =
      details &&
      typeof details === 'object' &&
      'code' in details &&
      typeof (details as { code?: unknown }).code === 'string'
        ? (details as { code: string }).code
        : undefined;

    super({ statusCode, message, code, details });
    this.name = 'ApiError';
  }
}
