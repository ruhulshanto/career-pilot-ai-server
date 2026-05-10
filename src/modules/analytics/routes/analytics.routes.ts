import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware.js';
import { analyticsController } from '../controllers/analytics.controller.js';

const router = Router();

/**
 * Analytics Routes
 * All routes require authentication
 */

// Dashboard overview
router.get('/dashboard', authenticate, analyticsController.getDashboardSummary);

// AI usage metrics
router.get('/ai', authenticate, analyticsController.getAiMetrics);

// Interview performance
router.get('/interviews', authenticate, analyticsController.getInterviewMetrics);

// Resume trends
router.get('/resumes', authenticate, analyticsController.getResumeTrends);

// Activity log
router.get('/activity', authenticate, analyticsController.getActivityLog);

export default router;
