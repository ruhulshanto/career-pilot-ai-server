import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { jobsService } from '../services/jobs.service.js';

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? '';

export const jobsController = {
  getRecommendations: asyncHandler(async (req: Request, res: Response) => {
    const jobs = await jobsService.getRecommendations(req.user!.id);
    return res.status(StatusCodes.OK).json(apiResponse('Job matches retrieved', jobs));
  }),

  refreshRecommendations: asyncHandler(async (req: Request, res: Response) => {
    const jobs = await jobsService.refreshRecommendations(req.user!.id);
    return res.status(StatusCodes.OK).json(apiResponse('Job matches refreshed', jobs));
  }),

  applyToJob: asyncHandler(async (req: Request, res: Response) => {
    const applications = await jobsService.applyToJob(req.user!.id, firstParam(req.params.id));
    return res.status(StatusCodes.CREATED).json(apiResponse('Job lead saved', applications));
  }),

  saveJobLead: asyncHandler(async (req: Request, res: Response) => {
    const applications = await jobsService.saveJobLead(req.user!.id, firstParam(req.params.id));
    return res.status(StatusCodes.CREATED).json(apiResponse('Job lead saved', applications));
  }),

  getApplications: asyncHandler(async (req: Request, res: Response) => {
    const applications = await jobsService.getApplications(req.user!.id);
    return res.status(StatusCodes.OK).json(apiResponse('Applications retrieved', applications));
  }),

  createApplication: asyncHandler(async (req: Request, res: Response) => {
    const application = await jobsService.createApplication(req.user!.id, req.body);
    return res.status(StatusCodes.CREATED).json(apiResponse('Application tracked', application));
  }),

  updateApplication: asyncHandler(async (req: Request, res: Response) => {
    const application = await jobsService.updateApplication(req.user!.id, firstParam(req.params.id), req.body);
    return res.status(StatusCodes.OK).json(apiResponse('Application updated', application));
  }),

  analyzeJobDescription: asyncHandler(async (req: Request, res: Response) => {
    const analysis = await jobsService.analyzeJobDescription(req.user!.id, req.body);
    return res.status(StatusCodes.OK).json(apiResponse('Job fit analysis completed', analysis));
  }),

  getGoals: asyncHandler(async (req: Request, res: Response) => {
    const goals = await jobsService.getGoals(req.user!.id);
    return res.status(StatusCodes.OK).json(apiResponse('Career goals retrieved', goals));
  }),

  createGoal: asyncHandler(async (req: Request, res: Response) => {
    const goal = await jobsService.createGoal(req.user!.id, req.body);
    return res.status(StatusCodes.CREATED).json(apiResponse('Career goal created', goal));
  }),

  updateGoal: asyncHandler(async (req: Request, res: Response) => {
    const goal = await jobsService.updateGoal(req.user!.id, firstParam(req.params.id), req.body);
    return res.status(StatusCodes.OK).json(apiResponse('Career goal updated', goal));
  })
};
