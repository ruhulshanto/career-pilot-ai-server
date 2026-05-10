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
import appRoutes from '@/app/routes.js';
import { env } from '@/config/env.js';

export const app = express();

// 1. Initialize Request Context (Traceability)
app.use(requestContextMiddleware);

// 2. Logging & Security
app.use(requestLogger);
app.use(securityMiddleware);

// 3. Payload Processing
app.use(sanitizeBody);

// 4. API Routes
app.use(env.API_PREFIX, appRoutes);

// 5. Error Handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);
