import { asyncHandler } from '@shared/utils/async-handler.js';
import { analyticsService } from '../services/analytics.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import type { Request, Response } from 'express';

export const analyticsController = {
  /**
   * GET /api/analytics/dashboard
   */
  getDashboardSummary: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const summary = await analyticsService.getDashboardSummary(userId);
    
    res.status(200).json(apiResponse('Dashboard summary retrieved', summary));
  }),

  /**
   * GET /api/analytics/ai
   */
  getAiMetrics: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const metrics = await analyticsService.getAiMetrics(userId);
    
    res.status(200).json(apiResponse('AI metrics retrieved', metrics));
  }),

  /**
   * GET /api/analytics/interviews
   */
  getInterviewMetrics: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const metrics = await analyticsService.getInterviewMetrics(userId);
    
    res.status(200).json(apiResponse('Interview metrics retrieved', metrics));
  }),

  /**
   * GET /api/analytics/resumes
   */
  getResumeTrends: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const trends = await analyticsService.getResumeTrends(userId);
    
    res.status(200).json(apiResponse('Resume trends retrieved', trends));
  }),

  /**
   * GET /api/analytics/activity
   */
  getActivityLog: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const logs = await analyticsService.getActivityLog(userId);
    
    res.status(200).json(apiResponse('Activity log retrieved', logs));
  })
};
