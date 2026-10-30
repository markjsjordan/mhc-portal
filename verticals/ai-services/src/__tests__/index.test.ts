/**
 * AI Services Routes & Security Tests (HIPAA-002)
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createAIRoutes } from '../routes/ai-routes.js';
import type { Database } from '@folkcare/core';

describe('AI Services Routes (HIPAA-002)', () => {
  it('requires authentication on /ai/* endpoints and rejects unauthenticated requests with 401', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    const router = createAIRoutes(mockDb);
    const req = {
      method: 'POST',
      url: '/ai/summarize-note',
      path: '/ai/summarize-note',
      headers: {},
      body: {},
    } as unknown as Request;

    let statusCode = 200;
    let responseBody: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        responseBody = payload;
        return this;
      },
    } as unknown as Response;

    await new Promise<void>((resolve) => {
      router.handle(req, res, () => resolve());
      setTimeout(resolve, 20);
    });

    expect(statusCode).toBe(401);
    expect(responseBody).toMatchObject({
      success: false,
      code: 'AUTH_REQUIRED',
    });
  });
});
