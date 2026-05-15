import { errorMiddleware } from '@middlewares/error.middleware.js';
import { notFoundMiddleware } from '@middlewares/not-found.middleware.js';
import { requestContextMiddleware } from '@middlewares/request-context.middleware.js';
import { requestLogger } from '@middlewares/request-logger.middleware.js';
import { sanitizeBody } from '@middlewares/sanitize.middleware.js';
import { securityMiddleware } from '@middlewares/security.middleware.js';
import express from 'express';

import '@ai/prompts/interview.prompts.js';
import '@ai/prompts/roadmap.prompts.js';
import '@ai/prompts/chatbot.prompts.js';
import '@ai/prompts/resume.prompts.js';
import appRoutes from '@/app/routes.js';
import { env } from '@/config/env.js';
import { systemHealthService } from '@/system/system-health.service.js';
import { apiErrorResponse } from '@shared/responses/api-response.js';
import path from 'node:path';

export const app = express();

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 1. Initialize Request Context (Traceability)
app.use(requestContextMiddleware);

// 2. Logging & Security
app.use(requestLogger);
app.use(securityMiddleware);

// 3. Payload Processing
app.use(sanitizeBody);

// 4. API Routes
app.get('/health', async (_req, res) => {
  const health = await systemHealthService.getSystemStatus();
  res.status(health.status === 'offline' ? 503 : 200).json(health);
});

app.get('/status', async (_req, res) => {
  const status = await systemHealthService.getSystemStatus({ includeDetails: true });
  res.status(status.status === 'offline' ? 503 : 200).json(status);
});

app.use('/uploads/private', (_req, res) => {
  res.status(404).json(apiErrorResponse('File not found'));
});
app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR)));
app.use(env.API_PREFIX, appRoutes);

// 5. Error Handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);
