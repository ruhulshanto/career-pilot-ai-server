import { AppError } from '@shared/errors/app-error.js';

export class ApiError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    super({ statusCode, message, details });
    this.name = 'ApiError';
  }
}
