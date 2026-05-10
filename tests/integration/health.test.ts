import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '@/app/app.js';
import { env } from '@config/env.js';

describe('Health Check Integration', () => {
  it('should return 200 OK for the health endpoint', async () => {
    const response = await request(app).get(`${env.API_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Career platform API is healthy'
    });
  });
});
